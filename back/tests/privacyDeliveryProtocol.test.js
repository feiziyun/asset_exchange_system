const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');

const { buildHeContractPayload } = require('../service/pcp/he');
const { buildPreContractPayload } = require('../service/pcp/pre');
const { buildFlContractPayload } = require('../service/pcp/fl');
const { extractPreResultNotificationPayload } = require('../service/pcp/result');
const { extractFlNotificationPayload } = require('../service/pcp/fl-routes');

const transaction = { buyer_address: 'buyer-1', seller_address: 'seller-1' };
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

test('HE, PRE and FL contracts use the PCC trade contract field', () => {
  const publicKeyPem = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
    .export({ type: 'spki', format: 'pem' });
  const payloads = [
    buildHeContractPayload({ transaction, businessContractId: 'trade-1', encType: 'Paillier', operation: 'ADD' }),
    buildPreContractPayload({ transaction, businessContractId: 'trade-1' }),
    buildFlContractPayload({
      transaction,
      businessContractId: 'trade-1',
      sellerIds: ['seller-1'],
      buyerResultPublicKey: Buffer.from(publicKeyPem).toString('hex')
    })
  ];

  for (const payload of payloads) {
    assert.equal(payload.trade_contract_id, 'trade-1');
    assert.equal(Object.hasOwn(payload, 'source_contract_id'), false);
  }
});

test('PRE result notification identifies a PCC contract', () => {
  const payload = extractPreResultNotificationPayload({
    data: { transaction_id: 'tx-1', pcc_contract_id: 'pcc-1', result_role: 'pre_result' }
  }, firstDefined);

  assert.equal(payload.transactionId, 'tx-1');
  assert.equal(payload.pcpContractId, 'pcc-1');
});

test('FL epoch notification identifies the PCC contract before a legacy contract id', () => {
  const payload = extractFlNotificationPayload({
    data: { transaction_id: 'tx-1', pcc_contract_id: 'pcc-1', contract_id: 'legacy-1',
      result_role: 'fl_gradient_epoch_bundle', receiver_id: 'seller-1' }
  }, firstDefined);
  assert.equal(payload.pcpContractId, 'pcc-1');
  assert.equal(payload.resultRole, 'fl_gradient_epoch_bundle');
  assert.equal(payload.receiverId, 'seller-1');
});
