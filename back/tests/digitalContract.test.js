'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.DIGITAL_CONTRACT_ENABLED = '1';
const service = require('../service/digitalContract');
const sample = () => ({ expiration_time: '2099-01-01T00:00:00Z', delivery_limit: 1,
  delivery_count: 0, asset_file_hash: 'asset-data-hash', order_status: 1, pc_type: 'HE' });

test('SHA-256 known vector and raw 64-character lowercase format', () => {
  assert.equal(service.sha256(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(service.HEX64.test(service.sha256(Buffer.from('abc'))), true);
  assert.equal(service.HEX64.test('sha256:' + 'a'.repeat(64)), false);
});
test('legacy asset hash is never emitted as model hash', () => {
  assert.equal(service.buildPlainContract({ ...sample(), model_file_hash: 'a'.repeat(64) }).control_machine_learning_models, undefined);
});
test('expiry, counter and paid-state checks reject invalid execution', () => {
  assert.throws(() => service.buildPlainContract({ ...sample(), expiration_time: '2000-01-01' }), /过期/);
  assert.throws(() => service.buildPlainContract({ ...sample(), delivery_count: 1 }), /次数/);
  assert.throws(() => service.buildPlainContract({ ...sample(), order_status: 0 }), /未付款/);
});
test('caller cannot override trusted hashes, timestamp or counters through policy JSON', () => {
  for (const field of ['fileHash', 'timestamp', 'delivery_cnt', 'control_machine_learning_models', 'control_count']) {
    assert.throws(() => service.sanitizePolicy({ [field]: 'fake' }), /不允许/);
  }
});
test('FL requires two packages and uses deterministic manifest commitment', () => {
  const top = { sha256: service.sha256(Buffer.from('top')) };
  const bottom = { sha256: service.sha256(Buffer.from('bottom')) };
  assert.throws(() => service.modelCommitment({ top }, 'FL'), /Top和Bottom/);
  const hash = service.modelCommitment({ top, bottom }, 'FL');
  assert.equal(hash, service.modelCommitment({ bottom, top }, 'FL'));
  assert.equal(service.HEX64.test(hash), true);
  assert.throws(() => service.buildPlainContract({ ...sample(), pc_type: 'FL', model_manifest_json: { top, bottom }, model_file_hash: hash }), /未绑定/);
  assert.equal(service.buildPlainContract({ ...sample(), pc_type: 'FL', model_manifest_json: { top, bottom }, model_file_hash: hash, model_hash_verified: 1 }).control_machine_learning_models, hash);
});
test('order ownership is checked on the backend', async () => {
  const conn = { query: async () => [[{ order_buyer_id: 1, order_seller_id: 2 }]] };
  await assert.rejects(service.loadContract(conn, 'ORDER', { id: 3 }), /无权限/);
  await assert.rejects(service.loadContract(conn, 'ORDER', {}), /无权限/);
  assert.ok(await service.loadContract(conn, 'ORDER', { id: 2 }));
});
test('actual FL package bytes must match the committed model manifest', () => {
  const top = Buffer.from('top'), bottom = Buffer.from('bottom');
  const manifest = { top: { sha256: service.sha256(top) }, bottom: { sha256: service.sha256(bottom) } };
  const contract = { model_manifest_json: manifest, model_file_hash: service.modelCommitment(manifest, 'FL'), model_hash_verified: 1 };
  service.assertFlPackages(contract, top, bottom);
  assert.throws(() => service.assertFlPackages(contract, Buffer.from('changed'), bottom), /不一致/);
});

test('offline ECDH/AES-GCM key exchange and SM4 encrypted request round trip', async () => {
  const client = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const server = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const clientPublic = client.publicKey.export({ type: 'spki', format: 'pem' });
  const clientPrivate = client.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const salt = crypto.randomBytes(16), nonce = crypto.randomBytes(12), sm4Key = crypto.randomBytes(16);
  const secret = crypto.diffieHellman({ privateKey: server.privateKey, publicKey: client.publicKey });
  const aesKey = crypto.createHash('sha256').update(secret).update(salt).update(Buffer.from('HENC2-P256-AES256GCM')).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(sm4Key), cipher.final()]);
  const keyResponse = { code: 200, ephPub: server.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    salt: salt.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  const plain = service.buildPlainContract(sample());
  let calls = 0;
  const options = { baseUrl: 'http://offline.invalid/api', publicKeyPath: 'pub', privateKeyPath: 'priv',
    readFile: async (name) => name === 'pub' ? clientPublic : clientPrivate,
    request: async (path, body) => {
      calls++;
      if (path === '/receive-key') { assert.equal(body.ecPublicKey, clientPublic.trim()); return keyResponse; }
      assert.equal(path, '/receive-json');
      const decrypt = (encoded) => {
        const decipher = crypto.createDecipheriv('sm4-cbc', sm4Key, Buffer.from(body.iv, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(encoded, 'base64')), decipher.final()]).toString('utf8');
      };
      assert.deepEqual(JSON.parse(decrypt(body.ciphertext)), plain);
      assert.equal(decrypt(body.delivered_cnt), '0');
      return { code: 200 };
    } };
  assert.equal((await service.verifyRemote(plain, 0, 'vm-test', options)).code, 200);
  assert.equal(calls, 2);
  await assert.rejects(service.verifyRemote(plain, 0, 'vm-test', { ...options,
    request: async (path) => path === '/receive-key' ? keyResponse : { code: 403 } }), /未通过/);
});

test('remote failure cannot mark a contract verified or insert a success log', async () => {
  let writes = 0;
  const conn = { query: async (sql) => {
    if (sql.includes('SELECT')) return [[{ ...sample(), order_buyer_id: 1, order_seller_id: 2 }]];
    writes++; return [];
  } };
  await assert.rejects(service.verifyForOrder(conn, 'ORDER', { id: 2 }, {
    baseUrl: 'http://offline.invalid', publicKeyPath: 'pub', privateKeyPath: 'priv',
    readFile: async () => 'unused', request: async () => { throw new Error('offline timeout'); },
  }), /timeout/);
  assert.equal(writes, 0);
});
