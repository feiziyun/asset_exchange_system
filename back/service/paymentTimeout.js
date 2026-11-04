const db = require('../db/index').promise();

const PAYMENT_TIMEOUT_MINUTES = 15;
const SCAN_INTERVAL_MS = 10000;

async function closeExpiredOrdersOnce() {
  const [orders] = await db.query(
    `SELECT order_no, buyer_id FROM asset_order
      WHERE order_status=0 AND created_at <= DATE_SUB(NOW(), INTERVAL ${PAYMENT_TIMEOUT_MINUTES} MINUTE)
      ORDER BY created_at LIMIT 50`,
  );
  const alipay = require('./alipay');
  const asset = require('./asset');
  for (const order of orders) {
    try {
      const payment = await alipay.getPaymentStatus(order.order_no, order.buyer_id);
      if (payment.status === 'PAID' || payment.status === 'CANCELLED') continue;
      await asset.cancelOrder(order.order_no, order.buyer_id);
      console.info('[alipay] unpaid order closed after timeout', { orderNo: order.order_no });
    } catch (error) {
      console.error('[alipay] timed order closure failed', {
        orderNo: order.order_no,
        message: error?.message,
      });
    }
  }
}

function startPaymentTimeoutScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await closeExpiredOrdersOnce();
    } catch (error) {
      console.error('[alipay] payment timeout scan failed', error?.message);
    } finally {
      running = false;
    }
  };
  run();
  const timer = setInterval(run, SCAN_INTERVAL_MS);
  return () => clearInterval(timer);
}

module.exports = { PAYMENT_TIMEOUT_MINUTES, closeExpiredOrdersOnce, startPaymentTimeoutScheduler };
