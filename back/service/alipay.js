const crypto = require('crypto');
const { AlipaySdk } = require('alipay-sdk');
const db = require('../db/index').promise();
const assetService = require('./asset');
const config = require('../config/alipay');
const { PAYMENT_TIMEOUT_MINUTES } = require('./paymentTimeout');

const sdk = config.appId && config.privateKey && config.alipayPublicKey
  ? new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    gateway: config.gateway,
    signType: 'RSA2',
  }) : null;

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const requireSdk = () => {
  if (!sdk) throw fail('支付宝沙箱尚未配置', 503);
  return sdk;
};
const amountOf = (order) => (Number(order.deal_price) * Number(order.buy_qty)).toFixed(2);
const paidTrade = (result) => ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(result?.tradeStatus || result?.trade_status);

async function execAlipay(method, params) {
  const outTradeNo = params.bizContent?.out_trade_no;
  try {
    const result = await requireSdk().exec(method, params);
    console.info('[alipay] gateway response', {
      method,
      outTradeNo,
      appId: config.appId,
      gateway: config.gateway,
      code: result?.code,
      msg: result?.msg,
      subCode: result?.subCode ?? result?.sub_code,
      subMsg: result?.subMsg ?? result?.sub_msg,
      tradeStatus: result?.tradeStatus ?? result?.trade_status,
      totalAmount: result?.totalAmount ?? result?.total_amount,
    });
    return result;
  } catch (error) {
    console.error('[alipay] gateway request failed', {
      method,
      outTradeNo,
      appId: config.appId,
      gateway: config.gateway,
      message: error?.message,
    });
    throw error;
  }
}

async function queryTrade(outTradeNo) {
  const result = await execAlipay('alipay.trade.query', { bizContent: { out_trade_no: outTradeNo } });
  if (result?.code === '10000') return result;
  if (result?.subCode === 'ACQ.TRADE_NOT_EXIST' || result?.sub_code === 'ACQ.TRADE_NOT_EXIST') return null;
  throw fail(result?.subMsg || result?.sub_msg || '支付宝查单失败，请稍后重试', 502);
}

async function settle(payment, result) {
  if (!paidTrade(result)) return false;
  if (result.outTradeNo && result.outTradeNo !== payment.out_trade_no) throw fail('支付宝订单号不匹配');
  if (result.out_trade_no && result.out_trade_no !== payment.out_trade_no) throw fail('支付宝订单号不匹配');
  const amount = result.totalAmount ?? result.total_amount;
  if (amount == null || Number(amount).toFixed(2) !== Number(payment.amount).toFixed(2)) {
    throw fail('支付宝支付金额不匹配');
  }
  const [orders] = await db.query('SELECT buyer_id, order_status FROM asset_order WHERE order_no=?', [payment.order_no]);
  const order = orders[0];
  if (!order) throw fail('订单不存在', 404);
  if (Number(order.order_status) === 4) throw fail('订单已取消，不能确认付款');
  if (Number(order.order_status) === 0) {
    try {
      await assetService.payOrder(payment.order_no, order.buyer_id, {}, { verifiedAlipay: true });
    } catch (error) {
      const [fresh] = await db.query('SELECT order_status FROM asset_order WHERE order_no=?', [payment.order_no]);
      if (![1, 2, 3].includes(Number(fresh[0]?.order_status))) throw error;
    }
  }
  const tradeNo = result.tradeNo || result.trade_no || null;
  await db.query(
    "UPDATE alipay_payment SET status='PAID', trade_no=?, paid_at=COALESCE(paid_at,NOW()) WHERE id=?",
    [tradeNo, payment.id],
  );
  return true;
}

async function getOrder(orderNo, buyerId, conn = db) {
  const [rows] = await conn.query(
    `SELECT ao.order_no, ao.buyer_id, ao.order_status, ao.deal_price, ao.buy_qty,
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(ao.created_at, INTERVAL ${PAYMENT_TIMEOUT_MINUTES} MINUTE)) AS remaining_seconds,
            da.asset_name, da.price_unit
       FROM asset_order ao JOIN digital_asset da ON da.id=ao.asset_id
      WHERE ao.order_no=?`, [orderNo],
  );
  if (!rows.length) throw fail('订单不存在', 404);
  if (Number(rows[0].buyer_id) !== Number(buyerId)) throw fail('无权访问该订单', 403);
  if (rows[0].price_unit !== '人民币') throw fail('支付宝仅支持人民币订单');
  return rows[0];
}

async function createPayment(orderNo, buyerId) {
  requireSdk();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT id FROM asset_order WHERE order_no=? FOR UPDATE', [orderNo]);
    const order = await getOrder(orderNo, buyerId, conn);
    if (Number(order.order_status) !== 0) throw fail('订单当前状态不可支付');
    if (Number(order.remaining_seconds) <= 0) throw fail('订单支付时间已结束，请刷新订单状态');
    const amount = amountOf(order);
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0.01) throw fail('支付金额必须至少为0.01元');
    const [rows] = await conn.query(
      'SELECT * FROM alipay_payment WHERE order_no=? ORDER BY id DESC LIMIT 1', [orderNo],
    );
    const previous = rows[0];
    if (previous && previous.status !== 'PAID') {
      const trade = await queryTrade(previous.out_trade_no);
      if (paidTrade(trade)) {
        await conn.commit();
        await settle(previous, trade);
        return { order_no: orderNo, status: 'PAID' };
      }
      const tradeStatus = trade?.tradeStatus || trade?.trade_status;
      if (previous.qr_code && tradeStatus !== 'TRADE_CLOSED' &&
          new Date(previous.expires_at).getTime() > Date.now()) {
        await conn.commit();
        return { order_no: orderNo, status: 'PENDING', qr_code: previous.qr_code,
          amount: Number(previous.amount).toFixed(2), expires_at: previous.expires_at };
      }
      if (tradeStatus === 'WAIT_BUYER_PAY') {
        const closed = await execAlipay('alipay.trade.close', {
          bizContent: { out_trade_no: previous.out_trade_no },
        });
        if (closed?.code !== '10000') {
          const refreshed = await queryTrade(previous.out_trade_no);
          if (paidTrade(refreshed)) {
            await conn.commit();
            await settle(previous, refreshed);
            return { order_no: orderNo, status: 'PAID' };
          }
          if (refreshed) throw fail(closed?.subMsg || '旧支付订单尚未关闭，请稍后重试', 502);
        }
      }
      await conn.query("UPDATE alipay_payment SET status='EXPIRED' WHERE id=?", [previous.id]);
    }
    const outTradeNo = `ALI${Date.now()}${crypto.randomBytes(5).toString('hex')}`;
    const params = {
      bizContent: { out_trade_no: outTradeNo, total_amount: amount,
        subject: `购买数字资产-${String(order.asset_name).slice(0, 80)}`,
        timeout_express: `${Math.max(1, Math.ceil(Number(order.remaining_seconds) / 60))}m` },
    };
    if (config.notifyUrl) params.notifyUrl = config.notifyUrl;
    const result = await execAlipay('alipay.trade.precreate', params);
    if (result?.code !== '10000' || !result.qrCode) throw fail(result?.subMsg || '支付宝创建二维码失败', 502);
    const expiresAt = new Date(Date.now() + Number(order.remaining_seconds) * 1000);
    await conn.query(
      `INSERT INTO alipay_payment (order_no,out_trade_no,amount,status,qr_code,expires_at)
       VALUES (?,?,?,'PENDING',?,?)`, [orderNo, outTradeNo, amount, result.qrCode, expiresAt],
    );
    await conn.commit();
    return { order_no: orderNo, status: 'PENDING', qr_code: result.qrCode, amount, expires_at: expiresAt };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getPaymentStatus(orderNo, buyerId) {
  const order = await getOrder(orderNo, buyerId);
  if (Number(order.order_status) === 4) return { status: 'CANCELLED' };
  const [rows] = await db.query('SELECT * FROM alipay_payment WHERE order_no=? ORDER BY id DESC LIMIT 1', [orderNo]);
  const payment = rows[0];
  if (!payment) return { status: Number(order.order_status) === 0 ? 'PENDING' : 'PAID' };
  if (payment.status === 'PAID') return { status: 'PAID' };
  const trade = await queryTrade(payment.out_trade_no);
  if (paidTrade(trade)) {
    await settle(payment, trade);
    return { status: 'PAID' };
  }
  if ((trade?.tradeStatus || trade?.trade_status) === 'TRADE_CLOSED') return { status: 'EXPIRED' };
  if (new Date(payment.expires_at).getTime() <= Date.now()) return { status: 'EXPIRED' };
  return { status: 'PENDING' };
}

async function closeUnpaidPaymentsForOrder(orderNo, conn) {
  let rows;
  try {
    [rows] = await conn.query(
      "SELECT id, out_trade_no, status FROM alipay_payment WHERE order_no=? AND status NOT IN ('CANCELLED') ORDER BY id FOR UPDATE",
      [orderNo],
    );
  } catch (error) {
    if (config.skipPayment === true && error.code === 'ER_NO_SUCH_TABLE') return;
    throw error;
  }
  for (const payment of rows) {
    if (payment.status === 'PAID') throw fail('订单已付款，不能取消');
    const trade = await queryTrade(payment.out_trade_no);
    if (paidTrade(trade)) throw fail('支付宝已收到付款，请刷新订单状态');
    const tradeStatus = trade?.tradeStatus || trade?.trade_status;
    if (tradeStatus === 'WAIT_BUYER_PAY') {
      const closed = await execAlipay('alipay.trade.close', {
        bizContent: { out_trade_no: payment.out_trade_no },
      });
      if (closed?.code !== '10000') {
        const refreshed = await queryTrade(payment.out_trade_no);
        if (paidTrade(refreshed)) throw fail('支付宝已收到付款，请刷新订单状态');
        if (refreshed && (refreshed.tradeStatus || refreshed.trade_status) !== 'TRADE_CLOSED') {
          throw fail(closed?.subMsg || '支付单尚未关闭，请稍后重试', 502);
        }
      }
    } else if (trade && tradeStatus !== 'TRADE_CLOSED') {
      throw fail('支付宝交易状态暂不可取消，请稍后重试', 502);
    }
    await conn.query("UPDATE alipay_payment SET status='CANCELLED' WHERE id=?", [payment.id]);
  }
}

async function handleNotify(params) {
  requireSdk();
  if (typeof sdk.checkNotifySign !== 'function' || !(await sdk.checkNotifySign(params))) {
    throw fail('支付宝通知验签失败');
  }
  if (String(params.app_id) !== String(config.appId)) throw fail('支付宝应用ID不匹配');
  if (String(params.out_trade_no || '').startsWith('REC')) {
    await require('./wallet').settleRecharge(params.out_trade_no, params);
    return;
  }
  const [rows] = await db.query('SELECT * FROM alipay_payment WHERE out_trade_no=?', [params.out_trade_no]);
  if (!rows.length) throw fail('支付记录不存在', 404);
  if (paidTrade(params)) await settle(rows[0], params);
}

module.exports = { createPayment, getPaymentStatus, handleNotify, closeUnpaidPaymentsForOrder,
  execAlipay, queryTrade, paidTrade };
