const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const jwtConfig = require('../jwt_config');
const auditConfig = require('../config/audit.json');
const auditIntegration = require('../config/auditIntegration');
const pamNodes = require('../service/pamNodes');

const HUB_API_BASE_URL = auditConfig.hubApiBaseUrl || process.env.HUB_API_BASE_URL || '';
// Hub 运维台“安全与凭据”创建的接入凭据；旧交易令牌不能用于新接口。
const HUB_INTEGRATION_TOKEN = auditIntegration.token;
const hubTickets = new Map();

const allowedIdentity = (identity) => identity === 'auditor' || identity === 'admin';
const auditLog = (req, stage, details = {}) => console.info('[audit-entry]', {
  traceId: req.auditTraceId, stage, userId: req.auth?.id, ...details,
});
const auditError = (req, stage, error) => console.error('[audit-entry]', {
  traceId: req.auditTraceId, stage, userId: req.auth?.id,
  error: error instanceof Error ? error.message : String(error),
});

const sendEntryError = (req, res, status, message) => {
  auditLog(req, 'handoff-rejected', { status, reason: message });
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  return res.status(status).type('html').send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>审计入口暂不可用</title><body style="font:16px/1.6 sans-serif;color:#24292f;background:#f6f8fa"><main style="max-width:520px;margin:12vh auto;padding:32px;background:white;border:1px solid #d0d7de;border-radius:8px"><h1>暂时无法进入审计平台</h1><p>${pamNodes.escapeHtml(message)}</p><button onclick="history.back()">返回交易系统</button></main></body></html>`);
};

const hubApiFetch = async (pathname, options = {}, req) => {
  if (!HUB_API_BASE_URL || !HUB_INTEGRATION_TOKEN) {
    throw new Error('审计中台接入凭据未配置');
  }
  const url = new URL(pathname, `${HUB_API_BASE_URL.replace(/\/$/, '')}/`);
  const startedAt = Date.now();
  if (req) auditLog(req, 'hub-request', { path: pathname });
  const response = await fetch(url, {
    method: options.method || 'GET',
    signal: AbortSignal.timeout(8000),
    headers: {
      'X-Integration-Token': HUB_INTEGRATION_TOKEN,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body,
  });
  const result = await response.json().catch(() => ({}));
  if (req) auditLog(req, 'hub-response', {
    path: pathname, httpStatus: response.status, durationMs: Date.now() - startedAt,
  });
  if (!response.ok) {
    throw new Error(result.detail || result.message || `审计平台请求失败: HTTP ${response.status}`);
  }
  return result;
};

exports.startPamEntry = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    auditLog(req, 'hub-denied', { reason: 'role' });
    return res.status(403).json({ error: '仅审计方或管理员可进入审计平台' });
  }
  try {
    const user = await pamNodes.getUser(req.auth?.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      auditLog(req, 'hub-denied', { reason: 'user-status-or-role' });
      return res.status(403).json({ error: '当前账号没有审计入口权限' });
    }
    if (user.identity === 'auditor' && user.auditor_target !== 'HUB') {
      auditLog(req, 'hub-denied', { reason: 'target', target: user.auditor_target });
      return res.status(403).json({ error: '管理员尚未分配 Hub 审计入口' });
    }
  } catch (error) {
    auditError(req, 'hub-user-check', error);
    return res.status(500).json({ error: '校验审计权限失败' });
  }
  if (!HUB_API_BASE_URL || !HUB_INTEGRATION_TOKEN) {
    auditLog(req, 'hub-denied', { reason: 'integration-config-missing' });
    return res.status(503).json({ error: '审计中台接入凭据未配置，请联系管理员' });
  }

  const token = String(req.headers.authorization || req.body?.token || req.query?.token || '')
    .replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    auditLog(req, 'hub-denied', { reason: 'token-missing' });
    return res.status(401).json({ error: '缺少登录令牌' });
  }
  try {
    const claims = jwt.verify(token, jwtConfig.businessSecretKey, { algorithms: ['HS256'] });
    if (Number(claims.id) !== Number(req.auth?.id) || !allowedIdentity(claims.identity)) {
      auditLog(req, 'hub-denied', { reason: 'token-identity-mismatch' });
      return res.status(403).json({ error: '审计登录身份不一致，请重新登录' });
    }
  } catch (error) {
    auditLog(req, 'hub-denied', { reason: error.name || 'token-invalid' });
    return res.status(401).json({ error: error.name === 'TokenExpiredError' ? '交易登录已过期，请重新登录' : '交易登录令牌无效，请重新登录' });
  }

  for (const [key, entry] of hubTickets) {
    if (entry.expiresAt < Date.now()) hubTickets.delete(key);
  }
  const ticket = crypto.randomBytes(24).toString('hex');
  hubTickets.set(ticket, { userId: Number(req.auth.id), expiresAt: Date.now() + 60000 });
  res.set('Cache-Control', 'no-store');
  const path = `/api/pam/hub-launch?ticket=${encodeURIComponent(ticket)}`;
  const httpOrigin = String(auditIntegration.httpOrigin).replace(/\/$/, '');
  auditLog(req, 'hub-handoff-issued', { httpOriginConfigured: Boolean(httpOrigin) });
  return res.json({ message: '审计中台入口已生成', url: httpOrigin ? `${httpOrigin}${path}` : path });
};
exports.launchHub = async (req, res) => {
  const ticket = String(req.query?.ticket || '').trim();
  const item = hubTickets.get(ticket);
  hubTickets.delete(ticket);
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  if (!item || item.expiresAt < Date.now()) return sendEntryError(req, res, 400, '审计入口已过期，请重新进入');
  try {
    const user = await pamNodes.getUser(item.userId);
    auditLog(req, 'hub-handoff-opened', { userId: item.userId });
    if (!user || user.status !== 0 || !allowedIdentity(user.identity) ||
      (user.identity === 'auditor' && user.auditor_target !== 'HUB')) {
      return sendEntryError(req, res, 403, '当前账号没有 Hub 审计入口权限');
    }
    const launch = await hubApiFetch('/hub/web/launches', {
      method: 'POST', body: JSON.stringify({ subject: `trading-user-${user.id}` }),
    }, req);
    const entry = new URL(launch.entry_url);
    if (!['http:', 'https:'].includes(entry.protocol) || entry.username || entry.password || !launch.ticket) {
      throw new Error('审计中台未返回有效入场票据');
    }
    auditLog(req, 'hub-form-issued', { destinationOrigin: entry.origin });
    return res.type('html').send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>进入审计中台</title><body><p>正在进入审计中台…</p><form id="hub-entry" method="post" action="${pamNodes.escapeHtml(entry.toString())}"><input type="hidden" name="ticket" value="${pamNodes.escapeHtml(launch.ticket)}"><noscript><button type="submit">继续进入</button></noscript></form><script>document.getElementById('hub-entry').submit();</script></body></html>`);
  } catch (error) {
    auditError(req, 'hub-handoff-failed', error);
    return sendEntryError(req, res, 502, error.message || '审计中台暂不可用');
  }
};

exports.getPamNodes = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    return res.status(403).json({ message: '当前账号没有访问权限' });
  }
  try {
    const user = await pamNodes.getUser(req.auth?.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      auditLog(req, 'node-directory-denied', { reason: 'user-status-or-role' });
      return res.status(403).json({ message: '当前账号没有审计入口权限' });
    }
    const nodes = await pamNodes.fetchNodes(true);
    const assigned = String(user.auditor_target || '');
    const visible = user.identity === 'admin' ? nodes :
      nodes.filter((node) => assigned === `NODE:${node.node_id}`);
    auditLog(req, 'node-directory-loaded', { total: nodes.length, visible: visible.length });
    return res.json({ nodes: visible.map((node) => ({
      node_id: node.node_id,
      node_name: node.node_name,
      web_origin: node.web_origin,
      online: node.online,
      last_heartbeat: node.last_heartbeat,
    })) });
  } catch (error) {
    auditError(req, 'node-directory-failed', error);
    return res.status(502).json({ message: '获取审计节点目录失败' });
  }
};

exports.createNodeTicket = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    auditLog(req, 'node-denied', { reason: 'role' });
    return res.status(403).json({ message: '当前账号没有审计入口权限' });
  }
  try {
    const user = await pamNodes.getUser(req.auth.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      auditLog(req, 'node-denied', { reason: 'user-status-or-role' });
      return res.status(403).json({ message: '当前账号没有审计入口权限' });
    }
    const nodeId = String(req.body?.node_id || '').trim();
    auditLog(req, 'node-ticket-requested', { nodeId });
    if (!nodeId || (user.identity !== 'admin' && user.auditor_target !== `NODE:${nodeId}`)) {
      auditLog(req, 'node-denied', { nodeId, reason: 'target-mismatch' });
      return res.status(403).json({ message: '未分配该审计节点入口' });
    }
    const nodes = await pamNodes.fetchNodes(true);
    if (!nodes.some((node) => node.node_id === nodeId && node.web_origin)) {
      auditLog(req, 'node-denied', { nodeId, reason: 'node-not-in-directory' });
      return res.status(404).json({ message: '审计节点不存在或没有配置访问地址' });
    }
    const [credentials] = await pamNodes.pool.query('SELECT node_id FROM pam_node_credentials WHERE node_id = ? LIMIT 1', [nodeId]);
    if (!credentials.length) {
      auditLog(req, 'node-denied', { nodeId, reason: 'credentials-missing' });
      return res.status(503).json({ message: '该节点的查看凭据尚未配置，请联系管理员' });
    }
    const ticket = pamNodes.createTicket(user.id, nodeId);
    const path = `/api/pam/node-launch?ticket=${encodeURIComponent(ticket)}`;
    const httpOrigin = String(auditIntegration.httpOrigin).replace(/\/$/, '');
    res.set('Cache-Control', 'no-store');
    auditLog(req, 'node-handoff-issued', { nodeId, httpOriginConfigured: Boolean(httpOrigin) });
    return res.json({ url: httpOrigin ? `${httpOrigin}${path}` : path });
  } catch (error) {
    auditError(req, 'node-ticket-failed', error);
    return res.status(502).json({ message: '生成审计节点跳转失败' });
  }
};

exports.launchNode = async (req, res) => {
  const ticket = String(req.query?.ticket || '').trim();
  const item = pamNodes.takeTicket(ticket);
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  if (!item || item.expiresAt < Date.now()) return sendEntryError(req, res, 400, '审计入口已过期，请重新进入');
  try {
    const user = await pamNodes.getUser(item.userId);
    auditLog(req, 'node-handoff-opened', { userId: item.userId, nodeId: item.nodeId });
    if (!user || user.status !== 0 || !allowedIdentity(user.identity) ||
      (user.identity !== 'admin' && user.auditor_target !== `NODE:${item.nodeId}`)) {
      return sendEntryError(req, res, 403, '当前账号没有该审计节点入口权限');
    }
    const nodes = await pamNodes.fetchNodes(true);
    const node = nodes.find((entry) => entry.node_id === item.nodeId);
    if (!node?.web_origin) throw new Error('审计节点没有配置访问地址');
    const [rows] = await pamNodes.pool.query('SELECT username, password_enc FROM pam_node_credentials WHERE node_id = ? LIMIT 1', [item.nodeId]);
    if (!rows.length) throw new Error('该节点的查看凭据尚未配置');
    const username = rows[0].username;
    const password = pamNodes.decryptSecret(rows[0].password_enc);
    const origin = new URL(node.web_origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('审计节点访问地址无效');
    const action = new URL('/auditor/web/login', origin).toString();
    auditLog(req, 'node-form-issued', { nodeId: item.nodeId, destinationOrigin: origin.origin });
    return res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>正在进入审计节点</title></head><body><p>正在进入 ${pamNodes.escapeHtml(node.node_name || node.node_id)}…</p><form id="node-login-form" method="post" action="${pamNodes.escapeHtml(action)}"><input type="hidden" name="username" value="${pamNodes.escapeHtml(username)}"><input type="hidden" name="password" value="${pamNodes.escapeHtml(password)}"><noscript><button type="submit">继续进入节点</button></noscript></form><script>document.getElementById('node-login-form').submit();</script></body></html>`);
  } catch (error) {
    auditError(req, 'node-handoff-failed', error);
    return sendEntryError(req, res, 502, error.message || '审计节点暂不可用');
  }
};
