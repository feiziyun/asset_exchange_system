const crypto = require('node:crypto');
const db = require('../db/index').promise();
const asset = require('./asset');
const alipayConfig = require('../config/alipay');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const money = (value) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw fail('金额格式不正确');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) throw fail('金额超出允许范围');
  return cents;
};
const decimal = (cents) => (cents / 100).toFixed(2);
const balanceCents = (value) => {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
};
const balanceDecimal = (cents) => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
const alipay = () => require('./alipay');

async function getBalance(userId) {
  const [users] = await db.query('SELECT balance FROM users WHERE id=?', [userId]);
  if (!users.length) throw fail('用户不存在', 404);
  return { balance: balanceDecimal(balanceCents(users[0].balance)) };
}

async function getLedger(userId, page = 1) {
  const offset = (Math.max(1, Math.min(100000, Number(page) || 1)) - 1) * 20;
  const [rows] = await db.query(
    'SELECT event_type, amount, balance_after, order_no, created_at FROM wallet_ledger WHERE user_id=? ORDER BY id DESC LIMIT 20 OFFSET ?',
    [userId, offset],
  );
  return rows;
}

async function getOrderAmount(orderNo, userId) {
  const [rows] = await db.query('SELECT ao.deal_price,ao.buy_qty,ao.order_status,da.price_unit FROM asset_order ao JOIN digital_asset da ON da.id=ao.asset_id WHERE ao.order_no=? AND ao.buyer_id=?',
    [orderNo, userId]);
  if (!rows.length) throw fail('订单不存在', 404);
  if (rows[0].price_unit !== '人民币') throw fail('余额仅支持人民币订单');
  return { amount: (Number(rows[0].deal_price) * Number(rows[0].buy_qty)).toFixed(2),
    order_status: Number(rows[0].order_status) };
}

async function changeBalance(conn, userId, cents, key, type, orderNo = null) {
  const [users] = await conn.query('SELECT balance FROM users WHERE id=? FOR UPDATE', [userId]);
  if (!users.length) throw fail('用户不存在', 404);
  const current = balanceCents(users[0].balance);
  const next = current + BigInt(cents);
  if (next < 0n) throw fail('余额不足');
  if (next > 999999999999999999n) throw fail('余额超出账户上限');
  await conn.query('UPDATE users SET balance=? WHERE id=?', [balanceDecimal(next), userId]);
  await conn.query(
    'INSERT INTO wallet_ledger (user_id,event_key,event_type,amount,balance_after,order_no) VALUES (?,?,?,?,?,?)',
    [userId, key, type, decimal(Math.abs(cents)), balanceDecimal(next), orderNo],
  );
}

async function payOrder(orderNo, userId) {
  if (alipayConfig.skipPayment === true) throw fail('当前已跳过付款，无需扣余额');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      'SELECT ao.buyer_id,ao.order_status,ao.deal_price,ao.buy_qty,ao.created_at,da.price_unit FROM asset_order ao JOIN digital_asset da ON da.id=ao.asset_id WHERE ao.order_no=? FOR UPDATE', [orderNo],
    );
    const order = orders[0];
    if (!order) throw fail('订单不存在', 404);
    if (Number(order.buyer_id) !== Number(userId)) throw fail('无权支付该订单', 403);
    if (order.price_unit !== '人民币') throw fail('余额仅支持人民币订单');
    if (Number(order.order_status) !== 0) throw fail('订单当前状态不可支付');
    if (Date.now() - new Date(order.created_at).getTime() >= 15 * 60000) throw fail('订单已超过付款时间');
    const [alipayRows] = await conn.query('SELECT id FROM alipay_payment WHERE order_no=? AND status=\'PAID\' LIMIT 1', [orderNo]);
    if (alipayRows.length) throw fail('支付宝已支付该订单');
    await alipay().closeUnpaidPaymentsForOrder(orderNo, conn);
    const cents = money((Number(order.deal_price) * Number(order.buy_qty)).toFixed(2));
    await changeBalance(conn, userId, -cents, `PAY:${orderNo}`, 'PAY', orderNo);
    await conn.query('INSERT INTO wallet_order_payment (order_no,user_id,amount) VALUES (?,?,?)',
      [orderNo, userId, decimal(cents)]);
    await asset.payOrder(orderNo, userId, {}, { verifiedWallet: true, connection: conn });
    await conn.commit();
    return { order_no: orderNo, status: 'PAID' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

async function refundOrder(conn, orderNo, userId) {
  const [rows] = await conn.query('SELECT amount,status FROM wallet_order_payment WHERE order_no=? FOR UPDATE', [orderNo]);
  const payment = rows[0];
  if (!payment || payment.status !== 'PAID') throw fail('余额付款记录不存在或已退款');
  await changeBalance(conn, userId, money(payment.amount), `REFUND:${orderNo}`, 'REFUND', orderNo);
  await conn.query("UPDATE wallet_order_payment SET status='REFUNDED',refunded_at=NOW() WHERE order_no=?", [orderNo]);
}

async function createRecharge(userId, amount) {
  const cents = money(amount);
  const outTradeNo = `REC${Date.now()}${crypto.randomBytes(5).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60000);
  const params = { bizContent: { out_trade_no: outTradeNo, total_amount: decimal(cents),
    subject: '账户余额充值', timeout_express: '15m' } };
  if (alipayConfig.notifyUrl) params.notifyUrl = alipayConfig.notifyUrl;
  await db.query(
    "INSERT INTO wallet_recharge (user_id,out_trade_no,amount,status,expires_at) VALUES (?,?,?,'PENDING',?)",
    [userId, outTradeNo, decimal(cents), expiresAt],
  );
  const result = await alipay().execAlipay('alipay.trade.precreate', params);
  if (result?.code !== '10000' || !result.qrCode) throw fail(result?.subMsg || '充值二维码生成失败', 502);
  await db.query(
    'UPDATE wallet_recharge SET qr_code=? WHERE out_trade_no=?', [result.qrCode, outTradeNo],
  );
  return { out_trade_no: outTradeNo, amount: decimal(cents), qr_code: result.qrCode, expires_at: expiresAt };
}

async function settleRecharge(outTradeNo, trade) {
  if (!alipay().paidTrade(trade)) return false;
  if (String(trade.outTradeNo || trade.out_trade_no) !== outTradeNo) throw fail('充值交易号不匹配');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM wallet_recharge WHERE out_trade_no=? FOR UPDATE', [outTradeNo]);
    const recharge = rows[0];
    if (!recharge) throw fail('充值单不存在', 404);
    if (Number(trade.totalAmount ?? trade.total_amount).toFixed(2) !== Number(recharge.amount).toFixed(2)) {
      throw fail('充值金额不匹配');
    }
    if (recharge.status === 'PAID') { await conn.commit(); return true; }
    if (recharge.status !== 'PENDING') throw fail('充值单已关闭');
    await changeBalance(conn, recharge.user_id, money(recharge.amount), `RECHARGE:${outTradeNo}`, 'RECHARGE', outTradeNo);
    await conn.query("UPDATE wallet_recharge SET status='PAID',trade_no=?,paid_at=NOW() WHERE id=?",
      [trade.tradeNo || trade.trade_no || null, recharge.id]);
    await conn.commit();
    return true;
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}

async function getRechargeStatus(outTradeNo, userId) {
  const [rows] = await db.query('SELECT * FROM wallet_recharge WHERE out_trade_no=? AND user_id=?', [outTradeNo, userId]);
  const recharge = rows[0];
  if (!recharge) throw fail('充值单不存在', 404);
  if (recharge.status === 'PAID') return { status: 'PAID' };
  const trade = await alipay().queryTrade(outTradeNo);
  if (alipay().paidTrade(trade)) {
    await settleRecharge(outTradeNo, trade);
    return { status: 'PAID' };
  }
  if (new Date(recharge.expires_at).getTime() <= Date.now()) return { status: 'EXPIRED' };
  return { status: 'PENDING' };
}

module.exports = { getBalance, getLedger, getOrderAmount, payOrder, refundOrder, createRecharge,
  settleRecharge, getRechargeStatus };
