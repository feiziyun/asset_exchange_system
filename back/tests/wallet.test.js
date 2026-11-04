const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const state = { balance: 5, orderStatus: 0, rechargeStatus: 'PENDING', paymentStatus: null, ledger: [] };
const connection = {
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  query: async (sql, params = []) => {
    if (sql.includes('JOIN digital_asset da') && sql.includes('FOR UPDATE')) return [[{
      buyer_id: 7, order_status: state.orderStatus, deal_price: '10.00', buy_qty: 1,
      created_at: new Date(), price_unit: '人民币',
    }]];
    if (sql.includes('FROM alipay_payment')) return [[]];
    if (sql.includes('FROM users WHERE id=? FOR UPDATE')) return [[{ balance: state.balance }]];
    if (sql.startsWith('UPDATE users SET balance')) { state.balance = Number(params[0]); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('INSERT INTO wallet_ledger')) { state.ledger.push(params[1]); return [{ insertId: state.ledger.length }]; }
    if (sql.startsWith('INSERT INTO wallet_order_payment')) { state.paymentStatus = 'PAID'; return [{ insertId: 1 }]; }
    if (sql.includes('FROM wallet_order_payment WHERE order_no=? FOR UPDATE')) return [[
      state.paymentStatus ? { amount: '10.00', status: state.paymentStatus } : undefined,
    ].filter(Boolean)];
    if (sql.startsWith('UPDATE wallet_order_payment')) { state.paymentStatus = 'REFUNDED'; return [{ affectedRows: 1 }]; }
    if (sql.includes('FROM wallet_recharge WHERE out_trade_no=? FOR UPDATE')) return [[{
      id: 1, user_id: 7, amount: '3.00', status: state.rechargeStatus,
    }]];
    if (sql.startsWith('UPDATE wallet_recharge')) { state.rechargeStatus = 'PAID'; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
const originalPromise = db.promise;
db.promise = () => ({ getConnection: async () => connection });
for (const [file, exports] of [
  ['../service/asset', { payOrder: async () => { state.orderStatus = 1; } }],
  ['../service/alipay', { closeUnpaidPaymentsForOrder: async () => {}, paidTrade: () => true }],
  ['../config/alipay', { skipPayment: false }],
]) {
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const wallet = require('../service/wallet');
db.promise = originalPromise;

test('insufficient balance leaves order and ledger unchanged', async () => {
  await assert.rejects(wallet.payOrder('OD1', 7), /余额不足/);
  assert.equal(state.orderStatus, 0);
  assert.equal(state.balance, 5);
  assert.deepEqual(state.ledger, []);
});

test('repeated recharge settlement credits only once', async () => {
  const trade = { out_trade_no: 'REC1', total_amount: '3.00', trade_no: 'TRADE1' };
  await wallet.settleRecharge('REC1', trade);
  await wallet.settleRecharge('REC1', trade);
  assert.equal(state.balance, 8);
  assert.deepEqual(state.ledger, ['RECHARGE:REC1']);
});

test('wallet payment and refund each change balance once', async () => {
  state.balance = 20;
  await wallet.payOrder('OD1', 7);
  assert.equal(state.balance, 10);
  await assert.rejects(wallet.payOrder('OD1', 7), /不可支付/);
  assert.equal(state.ledger.filter((key) => key === 'PAY:OD1').length, 1);
  await wallet.refundOrder(connection, 'OD1', 7);
  assert.equal(state.balance, 20);
  await assert.rejects(wallet.refundOrder(connection, 'OD1', 7), /已退款/);
  assert.equal(state.ledger.filter((key) => key === 'REFUND:OD1').length, 1);
});
