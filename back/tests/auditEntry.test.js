'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.HUB_INTEGRATION_TOKEN = 'test-integration-token';
const pamNodes = require('../service/pamNodes');
const handlers = require('../router_handle/audit');
const adminHandlers = require('../router_handle/admin');
const { businessSecretKey } = require('../jwt_config');

const mockRes = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; },
  set(name, value) { (this.headers ||= {})[name] = value; return this; },
  type(value) { this.contentType = value; return this; },
});
const user = { id: 7, identity: 'auditor', status: 0, auditor_target: 'HUB' };
const token = () => jwt.sign({ id: 7, identity: 'auditor', account: 'auditor01' }, businessSecretKey, { expiresIn: '5m' });

test('Hub entry checks role, uses one-time ticket and submits the new Hub ticket', async () => {
  const oldUser = pamNodes.getUser;
  const oldFetch = global.fetch;
  const calls = [];
  pamNodes.getUser = async () => user;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ entry_url: 'http://hub.example/entry', ticket: 'hub-ticket-1', expires_in: 60 });
  };
  try {
    const denied = mockRes();
    await handlers.startPamEntry({ auth: { id: 7, identity: 'buyer' } }, denied);
    assert.equal(denied.statusCode, 403);

    const start = mockRes();
    await handlers.startPamEntry({ auth: { id: 7, identity: 'auditor' }, headers: { authorization: `Bearer ${token()}` }, body: {} }, start);
    assert.equal(start.statusCode, 200);
    assert.match(start.body.url, /\/api\/pam\/hub-launch\?ticket=/);
    assert.equal(start.headers['Cache-Control'], 'no-store');
    const handoffTicket = new URL(start.body.url, 'http://trade.example').searchParams.get('ticket');
    const launch = mockRes();
    await handlers.launchHub({ query: { ticket: handoffTicket } }, launch);
    assert.equal(launch.statusCode, 200);
    assert.match(launch.body, /method="post"/);
    assert.match(launch.body, /action="http:\/\/hub\.example\/entry"/);
    assert.match(launch.body, /name="ticket" value="hub-ticket-1"/);
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, '/hub/web/launches');
    assert.ok(calls[0].options.headers['X-Integration-Token']);
    assert.deepEqual(JSON.parse(calls[0].options.body), { subject: 'trading-user-7' });
    const reused = mockRes();
    await handlers.launchHub({ query: { ticket: handoffTicket } }, reused);
    assert.equal(reused.statusCode, 400);
  } finally {
    pamNodes.getUser = oldUser;
    global.fetch = oldFetch;
  }
});

test('Hub directory uses the integration credential and includes MPC and PAM nodes', async () => {
  const oldFetch = global.fetch;
  let received;
  global.fetch = async (_url, options) => {
    received = options;
    return Response.json({ nodes: [
      { node_id: 'mpc-auditor-1', web_origin: 'http://mpc.example' },
      { node_id: 'pam-node-1', web_origin: 'http://node.example' },
    ] });
  };
  try {
    assert.deepEqual((await pamNodes.fetchNodes(true)).map((node) => node.node_id), ['mpc-auditor-1', 'pam-node-1']);
    assert.ok(received.headers['X-Integration-Token']);
  } finally { global.fetch = oldFetch; }
});

test('admin can list an MPC node for assignment and credential configuration', async () => {
  const oldNodes = pamNodes.fetchNodes;
  const oldQuery = pamNodes.pool.query;
  pamNodes.fetchNodes = async () => [{
    node_id: 'mpc-auditor-1', node_name: 'MPC 审计方 1',
    web_origin: 'http://mpc.example', online: true,
  }];
  pamNodes.pool.query = async () => [[{
    node_id: 'mpc-auditor-1', username: 'mpc-viewer',
  }]];
  try {
    const directory = mockRes();
    await adminHandlers.getAuditNodes({}, directory);
    assert.equal(directory.body.data.nodes[0].node_id, 'mpc-auditor-1');

    const credentials = mockRes();
    await adminHandlers.getAuditNodeCredentials({ originalUrl: '/api/admin/nodes' }, credentials);
    assert.equal(credentials.body.nodes[0].has_credentials, true);
    assert.equal(credentials.body.nodes[0].username, 'mpc-viewer');
    assert.equal(credentials.body.nodes[0].password, undefined);
  } finally {
    pamNodes.fetchNodes = oldNodes;
    pamNodes.pool.query = oldQuery;
  }
});

for (const { nodeId, origin } of [
  { nodeId: 'pam-node-1', origin: 'http://node.example/' },
  { nodeId: 'mpc-auditor-1', origin: 'http://mpc.example/' },
]) test(`${nodeId} entry uses a one-time ticket and saved credentials`, async () => {
  const oldUser = pamNodes.getUser;
  const oldNodes = pamNodes.fetchNodes;
  const oldQuery = pamNodes.pool.query;
  pamNodes.getUser = async () => ({ ...user, auditor_target: `NODE:${nodeId}` });
  pamNodes.fetchNodes = async () => [{ node_id: nodeId, node_name: nodeId, web_origin: origin, online: true }];
  pamNodes.pool.query = async sql => [sql.includes('password_enc')
    ? [{ username: 'node-viewer', password_enc: pamNodes.encryptSecret('test-password') }]
    : [{ node_id: nodeId }]];
  try {
    const start = mockRes();
    await handlers.createNodeTicket({ auth: { id: 7, identity: 'auditor' }, body: { node_id: nodeId } }, start);
    assert.equal(start.statusCode, 200);
    assert.match(start.body.url, /\/api\/pam\/node-launch\?ticket=/);
    const handoffTicket = new URL(start.body.url, 'http://trade.example').searchParams.get('ticket');
    const page = mockRes();
    await handlers.launchNode({ query: { ticket: handoffTicket } }, page);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, new RegExp(`action="${origin.replace(/\/$/, '').replace(/\./g, '\\.')}\\/auditor\\/web\\/login"`));
    assert.match(page.body, /name="username" value="node-viewer"/);
    assert.match(page.body, /name="password" value="test-password"/);
    assert.match(page.body, /node-login-form'\)\.submit/);
    const reuse = mockRes();
    await handlers.launchNode({ query: { ticket: handoffTicket } }, reuse);
    assert.equal(reuse.statusCode, 400);
  } finally {
    pamNodes.getUser = oldUser;
    pamNodes.fetchNodes = oldNodes;
    pamNodes.pool.query = oldQuery;
  }
});
