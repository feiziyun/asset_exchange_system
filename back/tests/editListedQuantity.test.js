'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const originalPromise = db.promise;
let connection;
db.promise = () => ({ getConnection: async () => connection });
const assetService = require('../service/asset');
db.promise = originalPromise;

const setup = () => {
  const state = { available: 80, listed: 15, sold: 5, commits: 0, rollbacks: 0 };
  connection = {
    beginTransaction: async () => {},
    commit: async () => { state.commits += 1; },
    rollback: async () => { state.rollbacks += 1; },
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM digital_asset') && sql.includes('LIMIT 1')) return [[{
        id: 11, user_id: 7, total_qty: 100, available_qty: state.available,
        price: 10, status: 1,
      }]];
      if (sql.includes('FROM asset_delegations')) return [[]];
      if (sql.includes('FROM asset_publish_record') && sql.includes('FOR UPDATE')) return [[{
        id: 21, publish_price: 10, publish_qty: state.listed + state.sold,
        remaining_qty: state.listed, sold_qty_total: state.sold,
        publish_status: 1, pricing_mode: 'fixed',
      }]];
      if (sql.startsWith('UPDATE digital_asset SET available_qty')) state.available = params[0];
      if (sql.includes('UPDATE asset_publish_record') && sql.includes('SET publish_price')) state.listed = params[2];
      return [{ affectedRows: 1 }];
    },
  };
  return state;
};

test('editing listed quantity moves only unsold inventory', async () => {
  const state = setup();
  await assetService.updateAssetByOwner(11, 7, { listed_qty: 20 }, 'seller');
  assert.deepEqual([state.available, state.listed, state.sold], [75, 20, 5]);
  await assetService.updateAssetByOwner(11, 7, { listed_qty: 10 }, 'seller');
  assert.deepEqual([state.available, state.listed, state.sold], [85, 10, 5]);
  assert.equal(state.commits, 2);
});

test('editing cannot list more than available inventory', async () => {
  const state = setup();
  await assert.rejects(assetService.updateAssetByOwner(11, 7, { listed_qty: 96 }, 'seller'), /不能超过剩余可用份数/);
  assert.deepEqual([state.available, state.listed, state.sold], [80, 15, 5]);
  assert.equal(state.rollbacks, 1);
});
