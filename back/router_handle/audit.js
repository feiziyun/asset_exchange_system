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
const nodeTickets = new Map();

const allowedIdentity = (identity) => identity === 'auditor' || identity === 'admin';

const sendEntryError = (req, res, status, message) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  return res.status(status).type('html').send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>审计入口暂不可用</title><body style="font:16px/1.6 sans-serif;color:#24292f;background:#f6f8fa"><main style="max-width:520px;margin:12vh auto;padding:32px;background:white;border:1px solid #d0d7de;border-radius:8px"><h1>暂时无法进入审计平台</h1><p>${pamNodes.escapeHtml(message)}</p><button onclick="history.back()">返回交易系统</button></main></body></html>`);
};

const hubApiFetch = async (pathname, options = {}) => {
  if (!HUB_API_BASE_URL || !HUB_INTEGRATION_TOKEN) {
    throw new Error('审计中台接入凭据未配置');
  }
  const url = new URL(pathname, `${HUB_API_BASE_URL.replace(/\/$/, '')}/`);
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'X-Integration-Token': HUB_INTEGRATION_TOKEN,
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

exports.startPamEntry = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    return res.status(403).json({ error: '仅审计方或管理员可进入审计平台' });
  }
  try {
    const user = await pamNodes.getUser(req.auth?.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      return res.status(403).json({ error: '当前账号没有审计入口权限' });
    }
    if (user.identity === 'auditor' && user.auditor_target !== 'HUB') {
      return res.status(403).json({ error: '管理员尚未分配 Hub 审计入口' });
    }
  } catch (error) {
    console.error('校验审计入口失败:', error);
    return res.status(500).json({ error: '校验审计权限失败' });
  }
  if (!HUB_API_BASE_URL || !HUB_INTEGRATION_TOKEN) {
    return res.status(503).json({ error: '审计中台接入凭据未配置，请联系管理员' });
  }

  const token = String(req.headers.authorization || req.body?.token || req.query?.token || '')
    .replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: '缺少登录令牌' });
  try {
    const claims = jwt.verify(token, jwtConfig.businessSecretKey, { algorithms: ['HS256'] });
    if (Number(claims.id) !== Number(req.auth?.id) || !allowedIdentity(claims.identity)) {
      return res.status(403).json({ error: '审计登录身份不一致，请重新登录' });
    }
  } catch (error) {
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
    if (!user || user.status !== 0 || !allowedIdentity(user.identity) ||
      (user.identity === 'auditor' && user.auditor_target !== 'HUB')) {
      return sendEntryError(req, res, 403, '当前账号没有 Hub 审计入口权限');
    }
    const launch = await hubApiFetch('/hub/web/launches', {
      method: 'POST', body: JSON.stringify({ subject: `trading-user-${user.id}` }),
    });
    const entry = new URL(launch.entry_url);
    if (!['http:', 'https:'].includes(entry.protocol) || entry.username || entry.password || !launch.ticket) {
      throw new Error('审计中台未返回有效入场票据');
    }
    return res.type('html').send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>进入审计中台</title><body><p>正在进入审计中台…</p><form id="hub-entry" method="post" action="${pamNodes.escapeHtml(entry.toString())}"><input type="hidden" name="ticket" value="${pamNodes.escapeHtml(launch.ticket)}"><noscript><button type="submit">继续进入</button></noscript></form><script>document.getElementById('hub-entry').submit();</script></body></html>`);
  } catch (error) {
    console.error('进入审计中台失败:', error);
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
      return res.status(403).json({ message: '当前账号没有审计入口权限' });
    }
    const nodes = await pamNodes.fetchNodes(true);
    const assigned = String(user.auditor_target || '');
    const visible = user.identity === 'admin' ? nodes :
      nodes.filter((node) => assigned === `NODE:${node.node_id}`);
    return res.json({ nodes: visible.map((node) => ({
      node_id: node.node_id,
      node_name: node.node_name,
      web_origin: node.web_origin,
      online: node.online,
      last_heartbeat: node.last_heartbeat,
    })) });
  } catch (error) {
    console.error('获取审计节点目录失败:', error);
    return res.status(502).json({ message: '获取审计节点目录失败' });
  }
};

exports.startNodeLogin = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) return res.status(403).json({ message: '当前账号没有审计入口权限' });
  try {
    const user = await pamNodes.getUser(req.auth.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      return res.status(403).json({ message: '当前账号没有审计入口权限' });
    }
    const nodeId = String(req.body?.node_id || '').trim();
    if (!nodeId || (user.identity !== 'admin' && user.auditor_target !== `NODE:${nodeId}`)) {
      return res.status(403).json({ message: '未分配该审计节点入口' });
    }
    const nodes = await pamNodes.fetchNodes(true);
    if (!nodes.some((node) => node.node_id === nodeId && node.web_origin)) {
      return res.status(404).json({ message: '审计节点不存在或没有配置访问地址' });
    }
    for (const [key, entry] of nodeTickets) {
      if (entry.expiresAt < Date.now()) nodeTickets.delete(key);
    }
    const ticket = crypto.randomBytes(24).toString('hex');
    nodeTickets.set(ticket, { userId: user.id, nodeId, expiresAt: Date.now() + 60000 });
    const path = `/api/pam/node-login?ticket=${encodeURIComponent(ticket)}`;
    const httpOrigin = String(auditIntegration.httpOrigin).replace(/\/$/, '');
    res.set('Cache-Control', 'no-store');
    return res.json({ url: httpOrigin ? `${httpOrigin}${path}` : path });
  } catch (error) {
    console.error('准备审计节点登录失败:', error);
    return res.status(502).json({ message: '无法获取审计节点目录' });
  }
};

exports.showNodeLogin = async (req, res) => {
  const ticket = String(req.query?.ticket || '').trim();
  const item = nodeTickets.get(ticket);
  nodeTickets.delete(ticket);
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  if (!item || item.expiresAt < Date.now()) return sendEntryError(req, res, 400, '审计入口已过期，请重新进入');
  try {
    const user = await pamNodes.getUser(item.userId);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity) ||
      (user.identity !== 'admin' && user.auditor_target !== `NODE:${item.nodeId}`)) {
      return sendEntryError(req, res, 403, '当前账号没有该审计节点入口权限');
    }
    const nodes = await pamNodes.fetchNodes(true);
    const node = nodes.find((entry) => entry.node_id === item.nodeId);
    if (!node?.web_origin) throw new Error('审计节点没有配置访问地址');
    const origin = new URL(node.web_origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('审计节点访问地址无效');
    const action = new URL('/auditor/web/login', origin).toString();
    return res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>登录审计节点</title><style>body{font:16px/1.5 sans-serif;background:#f6f8fa;color:#24292f}.card{max-width:420px;margin:12vh auto;padding:28px;background:white;border:1px solid #d0d7de;border-radius:8px}label{display:block;margin:16px 0}input{box-sizing:border-box;width:100%;height:38px;padding:8px;border:1px solid #d0d7de;border-radius:6px}button{height:38px;padding:0 18px;background:#0969da;border:1px solid #0969da;border-radius:6px;color:white;cursor:pointer}</style></head><body><main class="card"><h1>登录 ${pamNodes.escapeHtml(node.node_name || node.node_id)}</h1><form method="post" action="${pamNodes.escapeHtml(action)}"><label>查看账号<input name="username" autocomplete="username" required></label><label>查看密码<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">登录审计节点</button></form></main></body></html>`);
  } catch (error) {
    console.error('显示审计节点登录页失败:', error);
    return sendEntryError(req, res, 502, error.message || '审计节点暂不可用');
  }
};
