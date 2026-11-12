const jwt = require('jsonwebtoken');
const jwtConfig = require('../jwt_config');
const auditConfig = require('../config/audit.json');
const pamNodes = require('../service/pamNodes');

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
  if (!HUB_WEB_ORIGIN || !HUB_TRADING_TOKEN) {
    return res.status(503).json({ error: '审计平台跳转未配置，请联系管理员' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: '缺少登录令牌' });

  const entryUrl = new URL('/entry/start', `${HUB_WEB_ORIGIN.replace(/\/$/, '')}/`);
  const contractId = String(req.body?.pcc_contract_id || req.query?.pcc_contract_id || '').trim();
  if (contractId) entryUrl.searchParams.set('pcc_contract_id', contractId);

  res.cookie(ENTRY_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ENTRY_COOKIE_TTL_MS,
  });
  if (req.method === 'GET') return res.redirect(303, entryUrl.toString());
  return res.json({ message: '审计平台跳转地址已生成', entry_url: entryUrl.toString() });
};

exports.getPamNodes = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    return res.status(403).json({ message: '当前账号没有访问权限' });
  }
  try {
    const nodes = await pamNodes.fetchNodes(true);
    return res.json({ nodes });
  } catch (error) {
    console.error('获取审计节点目录失败:', error);
    return res.status(502).json({ message: '获取审计节点目录失败' });
  }
};

exports.createNodeTicket = async (req, res) => {
  if (!allowedIdentity(req.auth?.identity)) {
    return res.status(403).json({ message: '当前账号没有审计入口权限' });
  }
  try {
    const user = await pamNodes.getUser(req.auth?.id);
    if (!user || user.status !== 0 || !allowedIdentity(user.identity)) {
      return res.status(403).json({ message: '当前账号没有审计入口权限' });
    }
    const assigned = String(user.auditor_target || '');
    const nodeId = user.identity === 'admin' && req.body?.node_id
      ? String(req.body.node_id).trim()
      : assigned.startsWith('NODE:') ? assigned.slice(5) : '';
    if (!nodeId) return res.status(400).json({ message: '管理员尚未分配审计节点入口' });
    const nodes = await pamNodes.fetchNodes(true);
    const node = nodes.find((item) => item.node_id === nodeId);
    if (!node) return res.status(404).json({ message: '审计节点不存在或未启用' });
    const [credentials] = await pamNodes.pool.query('SELECT node_id FROM pam_node_credentials WHERE node_id = ? LIMIT 1', [nodeId]);
    if (!credentials.length) return res.status(503).json({ message: '该节点的查看凭据尚未配置，请联系管理员' });
    const ticket = pamNodes.createTicket(user.id, nodeId);
    return res.json({ success: true, node: { node_id: node.node_id, node_name: node.node_name, online: node.online }, url: `/api/pam/node-launch?ticket=${encodeURIComponent(ticket)}` });
  } catch (error) {
    console.error('生成审计节点跳转失败:', error);
    return res.status(502).json({ message: '生成审计节点跳转失败' });
  }
};

exports.launchNode = async (req, res) => {
  const item = pamNodes.takeTicket(String(req.query?.ticket || '').trim());
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  if (!item) return res.status(400).type('html').send('<!doctype html><meta charset="utf-8"><p>审计入口已过期，请返回交易系统重新进入。</p>');
  try {
    const nodes = await pamNodes.fetchNodes(true);
    const node = nodes.find((entry) => entry.node_id === item.nodeId);
    if (!node?.web_origin) throw new Error('审计节点不存在或缺少页面地址');
    const [rows] = await pamNodes.pool.query('SELECT username, password_enc FROM pam_node_credentials WHERE node_id = ? LIMIT 1', [item.nodeId]);
    if (!rows.length) throw new Error('该节点的查看凭据尚未配置');
    const username = rows[0].username;
    const password = pamNodes.decryptSecret(rows[0].password_enc);
    const action = `${String(node.web_origin).replace(/\/$/, '')}/auditor/web/login`;
    return res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>正在进入审计节点</title></head><body><p>正在进入 ${pamNodes.escapeHtml(node.node_name || node.node_id)}…</p><form id="node-login-form" method="post" action="${pamNodes.escapeHtml(action)}"><input type="hidden" name="username" value="${pamNodes.escapeHtml(username)}"><input type="hidden" name="password" value="${pamNodes.escapeHtml(password)}"><noscript><button type="submit">继续进入节点</button></noscript></form><script>document.getElementById('node-login-form').submit();</script></body></html>`);
  } catch (error) {
    console.error('审计节点自动登录失败:', error);
    return res.status(500).type('html').send(`<!doctype html><meta charset="utf-8"><p>审计节点登录失败：${pamNodes.escapeHtml(error.message)}</p>`);
  }
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
