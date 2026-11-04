'use strict';
const express = require('express');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../db/index');
const service = require('../service/digitalContract');
const { services } = require('../config/services');
const router = express.Router();
const pool = db.promise();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

async function transaction(work) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const result = await work(conn); await conn.commit(); return result; }
  catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
const route = (handler) => async (req, res) => {
  try { res.send({ status: 0, data: await handler(req) }); }
  catch (error) { res.status(400).send({ status: 1, message: error.message }); }
};

router.get('/:orderNo/digital-contract', route(async (req) => {
  if (!service.isEnabled()) return { enabled: false, message: '数字合约增强代码已安装，等待数据库迁移和服务配置' };
  return { ...await service.loadContract(pool, req.params.orderNo, req.auth), enabled: true };
}));
router.use((req, res, next) => {
  try { service.ensureEnabled(); next(); }
  catch (error) { res.status(503).send({ status: 1, message: error.message }); }
});

router.put('/:orderNo/digital-contract/policy', route(async (req) => transaction(async (conn) => {
  const row = await service.loadContract(conn, req.params.orderNo, req.auth, true);
  if (Number(row.order_seller_id) !== Number(req.auth.id)) throw new Error('仅本订单卖方可配置策略');
  if (Number(row.order_status) !== 1) throw new Error('交付后不能修改策略');
  const policy = service.sanitizePolicy(req.body.policy || {});
  await conn.query(`UPDATE digital_contracts SET policy_json = ?, policy_version = policy_version + 1,
    verification_status = 'UNVERIFIED', verified_at = NULL WHERE id = ?`, [JSON.stringify(policy), row.id]);
  return { policy, policy_version: row.policy_version + 1 };
})));

router.post('/:orderNo/digital-contract/model', upload.single('model'), route(async (req) => transaction(async (conn) => {
  const row = await service.loadContract(conn, req.params.orderNo, req.auth, true);
  if (Number(row.order_buyer_id) !== Number(req.auth.id)) throw new Error('仅本订单买方可上传模型');
  if (Number(row.order_status) !== 1) throw new Error('请在付款后、卖方交付前绑定模型');
  if (!req.file?.buffer?.length) throw new Error('请上传非空模型文件');
  const kind = String(req.body.kind || 'primary');
  if (!(row.pc_type === 'FL' ? ['top', 'bottom'] : ['primary']).includes(kind)) throw new Error('模型类型与交付方式不匹配');
  const hash = service.sha256(req.file.buffer);
  const storage = services.digitalContractModelDir;
  if (!storage || !path.isAbsolute(storage)) throw new Error('请配置模型保存目录的绝对路径');
  await fs.mkdir(storage, { recursive: true });
  // Content-addressed files can be reused; never execute uploaded model packages.
  await fs.writeFile(path.join(storage, hash), req.file.buffer, { flag: 'w', mode: 0o600 });
  const manifest = typeof row.model_manifest_json === 'string' ? JSON.parse(row.model_manifest_json) : row.model_manifest_json || {};
  manifest[kind] = { sha256: hash, name: path.basename(req.file.originalname), size: req.file.size };
  const complete = row.pc_type !== 'FL' || (manifest.top && manifest.bottom);
  const commitment = complete ? service.modelCommitment(manifest, row.pc_type) : null;
  await conn.query(`UPDATE digital_contracts SET model_manifest_json = ?, model_file_hash = ?, model_hash_verified = ?,
    policy_version = policy_version + 1, verification_status = 'UNVERIFIED', verified_at = NULL WHERE id = ?`,
    [JSON.stringify(manifest), commitment, complete ? 1 : 0, row.id]);
  await conn.query('UPDATE transactions SET model_file_hash = ? WHERE transaction_id = ?', [commitment, row.transaction_id]);
  return { file_sha256: hash, model_file_hash: commitment, model_manifest: manifest, complete: Boolean(complete) };
})));

router.post('/:orderNo/digital-contract/verify', route(async (req) => transaction((conn) =>
  service.verifyForOrder(conn, req.params.orderNo, req.auth))));
module.exports = router;
