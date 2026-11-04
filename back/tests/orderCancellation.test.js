'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const originalPromise = db.promise;
let connection;
db.promise = () => ({ getConnection: async () => connection });
const assetService = require('../service/asset');
db.promise = originalPromise;
const alipayPath = require.resolve('../service/alipay');
require.cache[alipayPath] = {
  id: alipayPath,
  filename: alipayPath,
  loaded: true,
  exports: { closeUnpaidPaymentsForOrder: async () => {} },
};

const makeConnection = (orderStatus = 0, buyerId = 7) => {
  const state = {
    orderStatus,
    buyerId,
    remaining: 0,
    sold: 1,
    publishStatus: 2,
    deleted: false,
    updates: [],
  };
  connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.startsWith('SELECT id, publish_id, asset_id, buyer_id, buy_qty, order_status')) {
        return [[{ id: 11, publish_id: 21, asset_id: 31, buyer_id: state.buyerId,
          buy_qty: 1, order_status: state.orderStatus }]];
      }
      if (sql.startsWith('SELECT id, buyer_id, order_status, buyer_deleted_at')) {
        return [[{ id: 11, buyer_id: state.buyerId, order_status: state.orderStatus,
          buyer_deleted_at: state.deleted ? new Date() : null }]];
      }
      if (sql.startsWith('SELECT id, status FROM digital_asset')) return [[{ id: 31, status: 1 }]];
      if (sql.startsWith('SELECT id, pricing_mode, publish_status')) {
        return [[{ id: 21, pricing_mode: 'fixed', publish_status: state.publishStatus,
          remaining_qty: state.remaining, sold_qty_total: state.sold }]];
      }
      state.updates.push(sql);
      if (sql.includes('SET remaining_qty=remaining_qty+?')) {
        state.remaining += params[0];
        state.sold -= params[1];
        state.publishStatus = 1;
      }
      if (sql.includes('SET order_status=4')) state.orderStatus = 4;
      if (sql.includes('SET buyer_deleted_at=NOW()')) state.deleted = true;
      return [{ affectedRows: 1 }];
    },
  };
  return state;
};

test('unpaid fixed-price order closes and returns reserved stock exactly once', async () => {
  const state = makeConnection();
  assert.equal((await assetService.cancelOrder('OD1', 7)).order_status, 4);
  assert.equal(state.orderStatus, 4);
  assert.equal(state.remaining, 1);
  assert.equal(state.sold, 0);
  assert.equal(state.publishStatus, 1);
  await assetService.cancelOrder('OD1', 7);
  assert.equal(state.remaining, 1);
});

test('only the buyer can cancel an unpaid order', async () => {
  const state = makeConnection();
  await assert.rejects(assetService.cancelOrder('OD1', 8), /无权取消/);
  assert.equal(state.remaining, 0);
});

test('a paid order without a refundable wallet payment cannot return stock', async () => {
  const state = makeConnection(1);
  await assert.rejects(assetService.cancelOrder('OD1', 7), /不是可退回的余额付款/);
  assert.equal(state.remaining, 0);
  assert.equal(state.sold, 1);
});

test('deletion hides a closed order without deleting its record', async () => {
  const state = makeConnection(4);
  await assetService.deleteClosedOrder('OD1', 7);
  assert.equal(state.deleted, true);
  assert.equal(state.orderStatus, 4);
  await assetService.deleteClosedOrder('OD1', 7);
  assert.equal(state.updates.filter((sql) => sql.includes('SET buyer_deleted_at=NOW()')).length, 1);
});

test('an unpaid order cannot be hidden before cancellation', async () => {
  const state = makeConnection();
  await assert.rejects(assetService.deleteClosedOrder('OD1', 7), /只有已关闭订单/);
  assert.equal(state.deleted, false);
});
