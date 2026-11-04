'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const originalPromise = db.promise;
db.promise = () => ({ query: async () => [[
  { order_no: 'UNPAID', buyer_id: 7 },
  { order_no: 'PAID', buyer_id: 8 },
]] });
const scheduler = require('../service/paymentTimeout');
db.promise = originalPromise;

const checked = [];
const closed = [];
const alipayPath = require.resolve('../service/alipay');
const assetPath = require.resolve('../service/asset');
require.cache[alipayPath] = {
  id: alipayPath,
  filename: alipayPath,
  loaded: true,
  exports: { getPaymentStatus: async (orderNo) => {
    checked.push(orderNo);
    return { status: orderNo === 'PAID' ? 'PAID' : 'EXPIRED' };
  } },
};
require.cache[assetPath] = {
  id: assetPath,
  filename: assetPath,
  loaded: true,
  exports: { cancelOrder: async (orderNo, buyerId) => {
    closed.push([orderNo, buyerId]);
  } },
};

test('timeout scan closes unpaid orders and preserves paid orders', async () => {
  assert.equal(scheduler.PAYMENT_TIMEOUT_MINUTES, 15);
  await scheduler.closeExpiredOrdersOnce();
  assert.deepEqual(checked, ['UNPAID', 'PAID']);
  assert.deepEqual(closed, [['UNPAID', 7]]);
});
