const jwt = require('jsonwebtoken');
const jwtConfig = require('../jwt_config');
const auditConfig = require('../config/audit.json');

const HUB_WEB_ORIGIN = auditConfig.hubWebOrigin || process.env.HUB_WEB_ORIGIN || '';
const HUB_API_BASE_URL = auditConfig.hubApiBaseUrl || process.env.HUB_API_BASE_URL || '';
const HUB_TRADING_TOKEN = auditConfig.hubTradingToken || process.env.HUB_TRADING_TOKEN || '';
const ENTRY_COOKIE = 'bupt_pam_trade_entry';
const ENTRY_COOKIE_TTL_MS = 300000;

const allowedIdentity = (identity) => identity === 'auditor' || identity === 'admin';

const readEntryCookie = (header = '') => {
  const entry = String(header).split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${ENTRY_COOKIE}=`));
  if (!entry) return '';
  try {
    return decodeURIComponent(entry.slice(ENTRY_COOKIE.length + 1));
  } catch (_error) {
    return '';
  }
};

const hubApiFetch = async (pathname, options = {}) => {
  if (!HUB_API_BASE_URL || !HUB_TRADING_TOKEN) {
    throw new Error('审计平台接口未配置');
  }
  const url = new URL(pathname, `${HUB_API_BASE_URL.replace(/\/$/, '')}/`);
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'x-trading-token': HUB_TRADING_TOKEN,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.detail || result.message || `审计平台请求失败: HTTP ${response.status}`);
  }
  return result;
};

exports.startPamEntry = (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    return res.status(403).json({ error: '仅审计方或管理员可进入审计平台' });
  }
  if (!HUB_WEB_ORIGIN || !HUB_TRADING_TOKEN) {
    return res.status(503).json({ error: '审计平台跳转未配置，请联系管理员' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: '缺少登录令牌' });

  const entryUrl = new URL('/entry/start', `${HUB_WEB_ORIGIN.replace(/\/$/, '')}/`);
  const contractId = String(req.body?.pcc_contract_id || '').trim();
  if (contractId) entryUrl.searchParams.set('pcc_contract_id', contractId);

  res.cookie(ENTRY_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ENTRY_COOKIE_TTL_MS,
  });
  return res.json({ message: '审计平台跳转地址已生成', entry_url: entryUrl.toString() });
};

exports.authorizePamEntry = async (req, res) => {
  const requestId = String(req.query?.request_id || '').trim();
  if (!requestId) return res.status(400).send('缺少 request_id');

  const token = readEntryCookie(req.headers.cookie);
  if (!token) return res.status(401).send('缺少交易交接凭据，请重新从交易系统进入');

  let claims;
  try {
    claims = jwt.verify(token, jwtConfig.businessSecretKey, { algorithms: ['HS256'] });
  } catch (_error) {
    return res.status(401).send('交易登录已过期，请重新登录');
  }
  if (!allowedIdentity(claims.identity)) {
    return res.status(403).send('仅审计方或管理员可进入审计平台');
  }

  try {
    const entry = await hubApiFetch(`/hub/web/requests/${encodeURIComponent(requestId)}`);
    if (entry.mode !== 'reader') return res.status(403).send('本次交接的角色不被允许');

    const launch = await hubApiFetch('/hub/web/launches', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId, subject: `trade:${claims.account || claims.id}` }),
    });
    if (!launch.launch_url) throw new Error('审计平台未返回跳转地址');

    res.clearCookie(ENTRY_COOKIE, { path: '/' });
    return res.redirect(303, launch.launch_url);
  } catch (error) {
    console.error('PAM 授权回调失败:', error);
    return res.status(502).send(error.message || '审计平台授权失败');
  }
};
