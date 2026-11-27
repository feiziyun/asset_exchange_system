'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const originalPromise = db.promise;
let connection;
db.promise = () => ({ getConnection: async () => connection });
const assetService = require('../service/asset');
db.promise = originalPromise;

const setup = ({ status = 2, buyerId = 7, ready = true, received = false } = {}) => {
  const state = { status, received, updates: [], commits: 0, rollbacks: 0 };
  connection = {
    beginTransaction: async () => {},
    commit: async () => { state.commits += 1; },
    rollback: async () => { state.rollbacks += 1; },
    release: () => {},
    query: async (sql) => {
      if (sql.includes('FROM asset_order ao') && sql.includes('FOR UPDATE')) return [[{
        id: 11, asset_id: 31, buyer_id: buyerId, order_no: 'OD1', order_status: state.status,
        buyer_result_downloaded_at: state.received ? new Date() : null,
        transaction_id: 'TX1', pc_type: 'HE',
        he_pcp_status: ready ? 'PAM_PASSED' : 'PAMING',
        he_download_token: ready ? 'available' : null,
      }]];
      state.updates.push(sql);
      if (sql.includes('SET order_status = 7')) { state.status = 7; state.received = true; }
      if (sql.includes('SET order_status = 3')) state.status = 3;
      return [{ affectedRows: 1 }];
    },
  };
  return state;
};

test('only the buyer can report receipt of a ready result', async () => {
  const state = setup();
  await assert.rejects(assetService.markDeliveryResultReceived('OD1', 8), /无权限/);
  assert.equal(state.status, 2);
  assert.equal(state.commits, 0);
});

test('receipt is rejected while the result is not ready', async () => {
  const state = setup({ ready: false });
  await assert.rejects(assetService.markDeliveryResultReceived('OD1', 7), /尚未就绪/);
  assert.equal(state.status, 2);
});

test('receipt moves the order to pending confirmation and is idempotent', async () => {
  const state = setup();
  assert.equal((await assetService.markDeliveryResultReceived('OD1', 7)).order_status, 7);
  assert.equal((await assetService.markDeliveryResultReceived('OD1', 7)).already_received, true);
  assert.equal(state.updates.filter((sql) => sql.includes('SET order_status = 7')).length, 1);
});

test('confirmation requires receipt and then completes the order once', async () => {
  const state = setup();
  await assert.rejects(assetService.confirmDelivery('OD1', 7), /请先取得交付结果/);
  await assetService.markDeliveryResultReceived('OD1', 7);
  await assetService.confirmDelivery('OD1', 7);
  assert.equal(state.status, 3);
  assert.equal(state.updates.filter((sql) => sql.includes('trade_count = trade_count + 1')).length, 1);
  await assert.rejects(assetService.confirmDelivery('OD1', 7), /请先取得交付结果/);
});
