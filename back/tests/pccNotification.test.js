const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { services } = require('../config/services');
const { callbackUrl, verifyNotification } = require('../service/pcp/notification');
const { isPrivacyResultReady, mapHeOrderRecord, mapPreOrderRecord, mapFlRecordRow } = require('../service/delivery');
const { assertTradeActor, assertTradeWritable } = require('../service/pcp/access');
const { buildHeAttemptMetadata } = require('../service/pcp/he');
const { buildPreAttemptMetadata } = require('../service/pcp/pre');
const { preview } = require('../service/httpLogger');

test('PCC callback uses the trading backend and verifies the raw signed body', () => {
  const old = {
    pcpCallbackBaseUrl: services.pcpCallbackBaseUrl,
    pcpNotifyClientId: services.pcpNotifyClientId,
    pcpNotifyClientSecret: services.pcpNotifyClientSecret
  };
  try {
    services.pcpCallbackBaseUrl = 'http://trade.example:3007';
    services.pcpNotifyClientId = 'pcc-notifier';
    services.pcpNotifyClientSecret = 'notify-secret';
    assert.equal(callbackUrl('he'), 'http://trade.example:3007/api/privacy/he/result-notify');
    const event = {
      event_type: 'PCC_TOKEN_READY', method: 'HE', pcc_contract_id: 'PCC_HE_1',
      trade_contract_id: 'TRADE_1', result_role: 'he_result', receiver_id: 'buyer',
      download_token: 'token'
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const timestamp = String(Date.now());
    const nonce = 'unique-nonce';
    const path = '/api/privacy/he/result-notify';
    const digest = `sha256:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
    const signature = crypto.createHmac('sha256', 'notify-secret')
      .update(['POST', path, timestamp, nonce, digest].join('\n')).digest('hex');
    const headers = { 'x-client-id': 'pcc-notifier', 'x-timestamp': timestamp,
      'x-nonce': nonce, 'x-signature': signature };
    const req = { body: event, rawBody, path, originalUrl: path,
      get: (name) => headers[name] };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; } };
    let accepted = false;
    verifyNotification(req, res, () => { accepted = true; });
    assert.equal(accepted, true);
    verifyNotification(req, res, () => { accepted = true; });
    assert.equal(res.statusCode, 401);
  } finally {
    Object.assign(services, old);
  }
});

test('order delivery requires PCC audit pass and a result credential', () => {
  const ready = (status, token) => isPrivacyResultReady({
    digitalContract: { pc_type: 'HE' },
    heRecord: { pcp_status: status, download_token: token }
  });
  assert.equal(ready('PAMING', 'token'), false);
  assert.equal(ready('PAM_PASSED', null), false);
  assert.equal(ready('PAM_PASSED', 'token'), true);
});

test('order list maps privacy records to the fields used by delivery buttons', () => {
  const he = mapHeOrderRecord({
    paillier_public_key_json: '{"n":"123"}', elgamal_public_key_json: '{"p":"123"}',
    pcp_status: 'PAM_PASSED', download_token: 'he-token'
  });
  assert.equal(he.public_keys_ready, true);
  assert.equal(he.result_ready, true);
  assert.equal(mapHeOrderRecord({ ...he, pcp_status: 'PAMING' }).result_ready, false);

  const pre = mapPreOrderRecord({
    buyer_public_key: '{"key":"value"}', pcp_status: 'PAM_PASSED', download_token: 'pre-token'
  });
  assert.equal(pre.buyer_public_key_ready, true);
  assert.equal(pre.result_ready, true);
  assert.equal(mapFlRecordRow({ pcp_status: 'PAM_PASSED', buyer_download_token: 'fl-token' }).buyer_result_ready, true);
});

test('privacy submissions require the trade participant and a confirmed active trade', () => {
  const trade = { buyer_id: 11, seller_id: 12, status: '已确认' };
  assert.doesNotThrow(() => assertTradeActor({ auth: { id: 11 } }, trade, 'buyer'));
  assert.throws(() => assertTradeActor({ auth: { id: 12 } }, trade, 'buyer'), /无权操作/);
  assert.doesNotThrow(() => assertTradeWritable(trade));
  assert.throws(() => assertTradeWritable({ ...trade, status: '待确认' }), /交易尚未确认/);
  assert.throws(() => assertTradeWritable({ ...trade, expiration_time: new Date(0) }), /已过期/);
});

test('repeating the same PCC attempt keeps its idempotency key', () => {
  const heInput = { contractId: 'PCC_HE_1', sellerId: 'seller', publicKey: { n: '1' } };
  assert.equal(buildHeAttemptMetadata(heInput).idempotency_key,
    buildHeAttemptMetadata(heInput).idempotency_key);
  const preInput = { contractId: 'PCC_PRE_1', sourcePublicKey: {}, targetPublicKey: {}, reencryptionKey: {} };
  assert.equal(buildPreAttemptMetadata(preInput).idempotency_key,
    buildPreAttemptMetadata(preInput).idempotency_key);
});

test('PCC download credentials are removed from external service logs', () => {
  assert.equal(preview('{"download_token":"private-token"}').download_token, '[REDACTED]');
});
