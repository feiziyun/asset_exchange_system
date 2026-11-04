'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');

const originalPromise = db.promise;
const calls = [];
const oldTradeNo = 'OLD_TRADE';
const connection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  query: async (sql) => {
    if (sql.includes('FROM asset_order ao JOIN digital_asset')) {
      return [[{ order_no: 'ORDER1', buyer_id: 7, order_status: 0,
        deal_price: '12.00', buy_qty: 1, remaining_seconds: 300,
        asset_name: 'Test', price_unit: '人民币' }]];
    }
    if (sql.includes('FROM alipay_payment WHERE order_no')) {
      return [[{ id: 1, out_trade_no: oldTradeNo, status: 'PENDING',
        qr_code: 'OLD_QR', expires_at: new Date(Date.now() - 1000) }]];
    }
    return [{ affectedRows: 1 }];
  },
};
db.promise = () => ({ getConnection: async () => connection });

const sdkPath = require.resolve('alipay-sdk');
require.cache[sdkPath] = {
  id: sdkPath, filename: sdkPath, loaded: true,
  exports: { AlipaySdk: class {
    async exec(method, params) {
      calls.push([method, params.bizContent]);
      if (method === 'alipay.trade.query') {
        return { code: '40004', subCode: 'ACQ.TRADE_NOT_EXIST', subMsg: '交易不存在' };
      }
      if (method === 'alipay.trade.precreate') return { code: '10000', qrCode: 'NEW_QR' };
      throw new Error(`Unexpected SDK method: ${method}`);
    }
  } },
};
const configPath = require.resolve('../config/alipay');
require.cache[configPath] = {
  id: configPath, filename: configPath, loaded: true,
  exports: { appId: 'TEST_APP', privateKey: 'TEST_KEY', alipayPublicKey: 'TEST_PUBLIC',
    gateway: 'https://sandbox.invalid/gateway.do', notifyUrl: '' },
};
const assetPath = require.resolve('../service/asset');
require.cache[assetPath] = { id: assetPath, filename: assetPath, loaded: true, exports: {} };
const alipay = require('../service/alipay');
db.promise = originalPromise;

test('expired QR with missing Alipay trade creates a fresh QR without closing the missing trade', async () => {
  const result = await alipay.createPayment('ORDER1', 7);
  assert.equal(result.qr_code, 'NEW_QR');
  assert.equal(result.amount, '12.00');
  assert.deepEqual(calls.map(([method]) => method), [
    'alipay.trade.query', 'alipay.trade.precreate',
  ]);
  assert.equal(calls[1][1].timeout_express, '5m');
});
