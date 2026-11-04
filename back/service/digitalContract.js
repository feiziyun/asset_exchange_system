'use strict';

// Local review preview. No connection is opened until an exported function is called.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { services } = require('../config/services');
const { loggedFetch } = require('./httpLogger');
const isEnabled = () => services.digitalContractEnabled;
function ensureEnabled() {
  if (!isEnabled()) throw new Error('数字合约增强功能尚未启用：请先完成迁移和服务配置');
}
const HEX64 = /^[0-9a-f]{64}$/;
const POLICY_KEYS = new Set([
  'actions', 'control_time', 'control_time_window', 'control_frequency',
  'control_region', 'control_network_address', 'control_provider_node_id',
  'control_consumer_node_id', 'control_data_status', 'control_data_size',
  'control_distribution_data_size', 'control_data_field', 'control_execution_env',
  'control_algorithm', 'control_application', 'action_transform', 'action_anonymize',
  'action_desensitize', 'action_encrypt', 'action_access', 'action_read',
  'action_reproduce', 'action_download', 'action_compute', 'action_process',
  'action_joint_develop', 'action_distribute', 'action_policy_transmit', 'action_sell',
  'action_delete', 'action_result_download', 'action_log_record_send',
  'action_use_notify', 'action_expansion_item',
]);

function parse(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}
function sha256(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('模型内容必须为文件字节');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function sanitizePolicy(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('策略必须为对象');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!POLICY_KEYS.has(key)) throw new Error(`不支持或不允许覆盖的策略字段: ${key}`);
    if (value !== null && value !== '') result[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 32768) throw new Error('策略超过32KB');
  return result;
}
function modelCommitment(manifest, pcType) {
  if (pcType === 'FL') {
    const top = manifest.top?.sha256;
    const bottom = manifest.bottom?.sha256;
    if (!HEX64.test(top || '') || !HEX64.test(bottom || '')) throw new Error('请先上传Top和Bottom模型');
    // Fixed field order defines this preview's aggregate commitment protocol.
    return sha256(Buffer.from(JSON.stringify({ top_model_sha256: top, bottom_model_sha256: bottom })));
  }
  const value = manifest.primary?.sha256;
  if (value && !HEX64.test(value)) throw new Error('模型SHA-256格式错误');
  return value || null;
}
function assertFlPackages(contract, topBytes, bottomBytes) {
  const manifest = parse(contract.model_manifest_json);
  const commitment = modelCommitment(manifest, 'FL');
  if (contract.model_hash_verified !== 1 || commitment !== contract.model_file_hash ||
      sha256(topBytes) !== manifest.top.sha256 || sha256(bottomBytes) !== manifest.bottom.sha256) {
    throw new Error('实际FL模型文件与数字合约绑定的模型不一致');
  }
}
function buildPlainContract(row, now = new Date()) {
  const expiry = new Date(row.expiration_time);
  if (!row.expiration_time || !Number.isFinite(expiry.getTime()) || expiry <= now) throw new Error('合约未设置有效期或已过期');
  const limit = Number(row.delivery_limit);
  const count = Number(row.delivery_count);
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(count) || count < 0 || count >= limit) {
    throw new Error('交付次数已耗尽或配置无效');
  }
  if (!row.asset_file_hash) throw new Error('缺少资产文件哈希');
  if (![1, 2, 3].includes(Number(row.order_status))) throw new Error('订单未付款或不可执行');
  const policy = sanitizePolicy(parse(row.policy_json));
  const manifest = parse(row.model_manifest_json);
  const modelHash = modelCommitment(manifest, row.pc_type);
  if (modelHash && (row.model_hash_verified !== 1 || row.model_file_hash !== modelHash)) throw new Error('模型哈希未绑定或与清单不一致');
  return {
    ...policy,
    delivery_cnt: String(limit),
    fileHash: String(row.asset_file_hash),
    timestamp: expiry.toISOString(),
    ...(modelHash ? { control_machine_learning_models: modelHash } : {}),
  };
}

async function loadContract(conn, orderNo, actor, lock = false) {
  const [rows] = await conn.query(`
    SELECT dc.*, t.delivery_count, t.delivery_limit, ao.order_status,
           ao.buyer_id AS order_buyer_id, apr.publisher_id AS order_seller_id,
           da.file_hash AS asset_file_hash
    FROM digital_contracts dc
    JOIN transactions t ON t.transaction_id = dc.transaction_id
    JOIN asset_order ao ON ao.order_no = dc.order_no
    JOIN asset_publish_record apr ON apr.id = ao.publish_id
    JOIN digital_asset da ON da.id = dc.asset_id
    WHERE dc.order_no = ? LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [orderNo]);
  const row = rows[0];
  if (!row) throw new Error('数字合约不存在，请先生成合约');
  if (!actor?.id || ![Number(row.order_buyer_id), Number(row.order_seller_id)].includes(Number(actor.id))) {
    throw new Error('无权限访问该订单合约');
  }
  return row;
}

function decryptKey(body, privatePem) {
  const ephemeral = crypto.createPublicKey({ key: Buffer.from(body.ephPub, 'base64'), format: 'der', type: 'spki' });
  const secret = crypto.diffieHellman({ privateKey: crypto.createPrivateKey(privatePem), publicKey: ephemeral });
  const aesKey = crypto.createHash('sha256').update(secret).update(Buffer.from(body.salt, 'base64'))
    .update(Buffer.from('HENC2-P256-AES256GCM', 'ascii')).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(body.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(body.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(body.ciphertext, 'base64')), decipher.final()]);
  if (plain.length === 16) return plain;
  if (plain.length >= 24 && [1, 2].includes(plain.readUInt32LE(0)) && plain.readUInt32LE(4) === 16) return plain.subarray(8, 24);
  throw new Error('远程SM4密钥格式不匹配');
}
function encryptSm4(key, iv, text) {
  if (!crypto.getCiphers().includes('sm4-cbc')) throw new Error('当前Node/OpenSSL不支持SM4-CBC');
  const cipher = crypto.createCipheriv('sm4-cbc', key, iv);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}
async function verifyRemote(plainContract, deliveredCnt, vmId, options = {}) {
  const base = options.baseUrl || services.digitalContractBaseUrl;
  const publicPath = options.publicKeyPath || services.digitalContractPublicKeyPath;
  const privatePath = options.privateKeyPath || services.digitalContractPrivateKeyPath;
  if (!base || !publicPath || !privatePath) throw new Error('请配置数字合约服务地址及公私钥路径');
  const request = options.request || (async (path, body) => {
    const response = await loggedFetch(`${base.replace(/\/$/, '')}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`数字合约服务返回HTTP ${response.status}`);
    return data;
  });
  const readFile = options.readFile || fs.readFile;
  const publicKey = (await readFile(publicPath, 'utf8')).trim();
  const keyResponse = await request('/receive-key', { vmId, key: publicKey, ecPublicKey: publicKey });
  if (!(keyResponse.code === 200 || keyResponse.status === 'ok')) throw new Error('数字合约密钥交换失败');
  const key = decryptKey(keyResponse, await readFile(privatePath, 'utf8'));
  const iv = crypto.randomBytes(16);
  const response = await request('/receive-json', {
    vmId, iv: iv.toString('base64'),
    delivered_cnt: encryptSm4(key, iv, String(deliveredCnt)),
    ciphertext: encryptSm4(key, iv, JSON.stringify(plainContract)),
  });
  if (response.code !== 200) throw new Error('远程数字合约策略验证未通过');
  return { code: response.code, message: String(response.message || '验证通过') };
}

// Caller owns the transaction and locks the contract/transaction rows before execution.
async function verifyForOrder(conn, orderNo, actor, options = {}) {
  ensureEnabled();
  const row = await loadContract(conn, orderNo, actor, true);
  const plainContract = buildPlainContract(row);
  const vmId = `vm-tx-${row.transaction_id}`;
  const remote = await verifyRemote(plainContract, row.delivery_count, vmId, options);
  await conn.query(`UPDATE digital_contracts SET verification_status = 'VERIFIED', verified_at = NOW() WHERE id = ?`, [row.id]);
  await conn.query(`INSERT INTO digital_contract_verification_log
    (contract_id, policy_version, actor_id, plain_contract_json, remote_result_json)
    VALUES (?, ?, ?, ?, ?)`, [row.contract_id, row.policy_version, actor.id, JSON.stringify(plainContract), JSON.stringify(remote)]);
  return { success: true, verified: true, message: '数字合约远程校验通过', transactionId: row.transaction_id,
    policyVersion: row.policy_version, vmId, plainContract, remote };
}

module.exports = { isEnabled, ensureEnabled, HEX64, sha256, sanitizePolicy, modelCommitment, assertFlPackages, buildPlainContract,
  loadContract, decryptKey, encryptSm4, verifyRemote, verifyForOrder };
