const test = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
let connectionCount = 0;
let mode = 'delegate';
const agentAddress = 'agent-address';
const ownerAddress = 'owner-address';
const asset = {
  id: 7, user_id: 11, file_hash: 'asset-hash', token_id: 'asset-hash',
  owner_address: ownerAddress, is_divisible: 0, can_sell_ownership: 1,
  can_sell_view_right: 1, can_sell_process_right: 0,
};
const connection = () => {
  connectionCount += 1;
  return {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (mode === 'revoke') {
        if (sql.includes('SELECT d.id FROM asset_delegations')) return [[{ id: 19 }]];
        if (sql.includes('SELECT * FROM asset_publish_record') && sql.includes('delegation_id=?')) {
          return [[{ id: 4, remaining_qty: 1 }]];
        }
        if (sql.includes('SELECT d.*, da.file_hash')) return [[{
          id: 19, asset_id: 7, owner_id: 11, agent_user_id: 22,
          owner_address: ownerAddress, agent_address: agentAddress,
          file_hash: 'asset-hash', is_divisible: 0, quantity_remaining: 1, status: 'ACTIVE',
        }]];
        if (sql.includes('SELECT id FROM asset_order')) return [[]];
      }
      if (sql.includes('SELECT da.*')) return [[asset]];
      if (sql.includes('SELECT * FROM asset_publish_record') && sql.includes('delegation_id IS NULL')) {
        return [[{ id: 3, publish_price: 120, remaining_qty: 4 }]];
      }
      if (sql.includes('SELECT id FROM asset_delegations')) return [[]];
      if (sql.includes('INSERT INTO asset_delegations')) return [{ insertId: 19 }];
      return [{ affectedRows: 1 }];
    },
  };
};
const dbPath = require.resolve('../db/index');
const chainPath = require.resolve('../service/chainClient');
const certPath = require.resolve('../service/certificate');
require.cache[dbPath] = { exports: { promise: () => ({
  getConnection: async () => connection(),
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT cr.user_id')) return [[{ user_id: 22, certificate_name: 'agent-cert', identity: 'seller' }]];
    if (sql.includes('SELECT certificate_name,org,address')) {
      return [[{ certificate_name: 'owner-cert', org: 'wx-org1', address: ownerAddress }]];
    }
    return [{ affectedRows: 1 }];
  },
}) } };
require.cache[chainPath] = { exports: {
  dynamicCertConfig: async () => ({ code: 0 }),
  ownerOf: async () => ({ result: ownerAddress }),
  setApproval: async (payload) => { calls.push({ approval: payload }); return { code: 0 }; },
  enApprove: async (payload) => { calls.push({ enApproval: payload }); return { code: 0 }; },
} };
require.cache[certPath] = { exports: {
  getDefaultTradeCertInfo: async () => ({ certificate_name: 'agent-cert', address: agentAddress }),
} };
const service = require('../service/delegation');

test('代理授权按原型字段预留一份库存并写入链上授权', async () => {
  const result = await service.delegate({
    asset_id: 'asset-hash', agent_address: agentAddress, quantity: 1,
    allowed_rights: '持有权', actor_user_id: 11,
  }, 11);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(result.quantity_remaining, 1);
  assert.ok(calls.some((call) => call.sql?.includes('INSERT INTO asset_delegations')));
  assert.ok(calls.some((call) => call.sql?.includes('INSERT INTO asset_publish_record')));
  assert.deepEqual(calls.find((call) => call.approval)?.approval, {
    owner: ownerAddress, to: agentAddress, tokenId: 'asset-hash', isApproval: 'true',
  });
  assert.equal(connectionCount, 2);
});

test('不可分割资产拒绝超过一份的代理数量', async () => {
  await assert.rejects(
    service.delegate({ asset_id: 'asset-hash', agent_address: agentAddress,
      quantity: 2, allowed_rights: '持有权', actor_user_id: 11 }, 11),
    /只能托管 1 份/,
  );
});

test('可分割资产按三份预留库存并使用 En-Approve', async () => {
  asset.is_divisible = 1;
  calls.length = 0;
  try {
    const result = await service.delegate({ asset_id: 'asset-hash', agent_address: agentAddress,
      quantity: 3, allowed_rights: '持有权', actor_user_id: 11 }, 11);
    assert.equal(result.quantity_remaining, 3);
    assert.deepEqual(calls.find((call) => call.enApproval)?.enApproval,
      { to: agentAddress, amount: '3' });
    assert.ok(calls.some((call) => call.sql?.includes('remaining_qty=remaining_qty-?') && call.params?.[1] === 3));
  } finally {
    asset.is_divisible = 0;
  }
});

test('取消授权先返还业务库存，再撤销链上授权', async () => {
  mode = 'revoke';
  calls.length = 0;
  const result = await service.revoke({ delegation_id: 19, actor_user_id: 11 }, 11);
  assert.equal(result.returned, 1);
  assert.ok(calls.some((call) => call.sql?.includes("status='REVOKED'")));
  assert.ok(calls.some((call) => call.sql?.includes('remaining_qty=remaining_qty+?,publish_status=1') && call.params?.[0] === 1));
  const approval = calls.find((call) => call.approval)?.approval;
  assert.equal(approval?.isApproval, 'false');
  assert.ok(calls.findIndex((call) => call === 'commit') < calls.findIndex((call) => call.approval));
});
