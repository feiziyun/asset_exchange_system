const crypto = require('node:crypto');
const db = require('../db/index');
const auditConfig = require('../config/audit.json');

const pool = db.promise();
const hubApiBase = auditConfig.hubApiBaseUrl || process.env.HUB_API_BASE_URL || '';
const hubToken = auditConfig.hubTradingToken || process.env.HUB_TRADING_TOKEN || '';
const credentialKeyHex = auditConfig.nodeCredentialKey || process.env.PAM_NODE_CREDENTIAL_KEY || '';

async function hubFetch(pathname) {
  if (!hubApiBase || !hubToken) throw new Error('审计平台接口未配置');
  const response = await fetch(new URL(pathname, `${hubApiBase.replace(/\/$/, '')}/`), {
    headers: { 'x-trading-token': hubToken },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || result.message || `审计平台请求失败: HTTP ${response.status}`);
  return result;
}

let nodeCache = { at: 0, nodes: [] };
async function fetchNodes(force = false) {
  if (!force && Date.now() - nodeCache.at < 30000) return nodeCache.nodes;
  const result = await hubFetch('/hub/web/node-directory');
  nodeCache = { at: Date.now(), nodes: Array.isArray(result.nodes) ? result.nodes : [] };
  return nodeCache.nodes;
}

function credentialKey() {
  if (!/^[0-9a-fA-F]{64}$/.test(credentialKeyHex)) {
    throw new Error('nodeCredentialKey 未配置或长度不是 32 字节');
  }
  return Buffer.from(credentialKeyHex, 'hex');
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', credentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function decryptSecret(value) {
  const parts = String(value || '').split(':');
  if (parts.length !== 3) throw new Error('节点凭据格式无效');
  const decipher = crypto.createDecipheriv('aes-256-gcm', credentialKey(), Buffer.from(parts[0], 'hex'));
  decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], 'hex')), decipher.final()]).toString('utf8');
}

const tickets = new Map();
function createTicket(userId, nodeId) {
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, { userId, nodeId, expiresAt: Date.now() + 60000 });
  return ticket;
}

function takeTicket(ticket) {
  const item = tickets.get(ticket);
  if (!item) return null;
  tickets.delete(ticket);
  return item.expiresAt >= Date.now() ? item : null;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function getUser(userId) {
  const [rows] = await pool.query('SELECT id, account, identity, status, auditor_target FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

module.exports = { pool, fetchNodes, encryptSecret, decryptSecret, createTicket, takeTicket, escapeHtml, getUser };
