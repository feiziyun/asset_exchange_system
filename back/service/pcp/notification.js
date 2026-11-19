const crypto = require('crypto');
const { services } = require('../../config/services');

const seenNonces = new Map();
const MAX_AGE_MS = 5 * 60 * 1000;

function callbackUrl(method) {
  const base = String(services.pcpCallbackBaseUrl || '').trim();
  if (!base) throw new Error('请在 config/pcp.local.json 配置 PCC callbackBaseUrl');
  const url = new URL(`/api/privacy/${method}/result-notify`, `${base.replace(/\/$/, '')}/`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PCC 回调地址必须使用 HTTP(S)');
  return url.toString();
}

function verifyNotification(req, res, next) {
  const secret = String(services.pcpNotifyClientSecret || '').trim();
  const clientId = String(services.pcpNotifyClientId || '').trim();
  if (!secret || !clientId) return res.status(503).json({ success: false, message: 'PCC 通知凭据未配置' });
  const receivedId = String(req.get('x-client-id') || '');
  const timestamp = String(req.get('x-timestamp') || '');
  const nonce = String(req.get('x-nonce') || '');
  const signature = String(req.get('x-signature') || '');
  const now = Date.now();
  if (receivedId !== clientId || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > MAX_AGE_MS ||
      !nonce || !/^[0-9a-f]{64}$/i.test(signature) || !Buffer.isBuffer(req.rawBody)) {
    return res.status(401).json({ success: false, message: 'PCC 通知签名无效' });
  }
  for (const [key, expiry] of seenNonces) if (expiry < now) seenNonces.delete(key);
  const nonceKey = `${receivedId}:${nonce}`;
  if (seenNonces.has(nonceKey)) return res.status(401).json({ success: false, message: 'PCC 通知重复' });
  const digest = `sha256:${crypto.createHash('sha256').update(req.rawBody).digest('hex')}`;
  const canonical = ['POST', req.originalUrl, timestamp, nonce, digest].join('\n');
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ success: false, message: 'PCC 通知签名无效' });
  }
  const event = req.body || {};
  const method = req.path.split('/')[3]?.toUpperCase();
  if (event.event_type !== 'PCC_TOKEN_READY' || event.method !== method ||
      !event.pcc_contract_id || !event.trade_contract_id || !event.result_role ||
      !event.receiver_id || !event.download_token) {
    return res.status(400).json({ success: false, message: 'PCC 通知字段不完整' });
  }
  seenNonces.set(nonceKey, now + MAX_AGE_MS);
  next();
}

module.exports = { callbackUrl, verifyNotification };
