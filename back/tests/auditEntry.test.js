'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.HUB_INTEGRATION_TOKEN = 'test-integration-token';
const pamNodes = require('../service/pamNodes');
const handlers = require('../router_handle/audit');
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
    assert.equal(calls[0].options.headers['X-Integration-Token'], 'test-integration-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { subject: 'trading-user-7' });
    const reused = mockRes();
    await handlers.launchHub({ query: { ticket: handoffTicket } }, reused);
    assert.equal(reused.statusCode, 400);
  } finally {
    pamNodes.getUser = oldUser;
    global.fetch = oldFetch;
  }
});

test('Hub directory uses the integration credential and keeps PAM nodes', async () => {
  const oldFetch = global.fetch;
  let received;
  global.fetch = async (_url, options) => {
    received = options;
    return Response.json({ nodes: [
      { node_id: 'mpc-auditor-1' }, { node_id: 'pam-node-1', web_origin: 'http://node.example' },
    ] });
  };
  try {
    assert.deepEqual((await pamNodes.fetchNodes(true)).map((node) => node.node_id), ['pam-node-1']);
    assert.equal(received.headers['X-Integration-Token'], 'test-integration-token');
  } finally { global.fetch = oldFetch; }
});

test('Node entry shows a blank browser login form and never reads saved credentials', async () => {
  const oldUser = pamNodes.getUser;
  const oldNodes = pamNodes.fetchNodes;
  pamNodes.getUser = async () => ({ ...user, auditor_target: 'NODE:pam-node-1' });
  pamNodes.fetchNodes = async () => [{ node_id: 'pam-node-1', node_name: '独立审计节点 1', web_origin: 'http://node.example/', online: true }];
  try {
    const start = mockRes();
    await handlers.startNodeLogin({ auth: { id: 7, identity: 'auditor' }, body: { node_id: 'pam-node-1' } }, start);
    assert.equal(start.statusCode, 200);
    const handoffTicket = new URL(start.body.url, 'http://trade.example').searchParams.get('ticket');
    const page = mockRes();
    await handlers.showNodeLogin({ query: { ticket: handoffTicket } }, page);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /action="http:\/\/node\.example\/auditor\/web\/login"/);
    assert.match(page.body, /name="username"/);
    assert.match(page.body, /name="password"/);
    assert.doesNotMatch(page.body, /type="hidden" name="password"/);
    const reuse = mockRes();
    await handlers.showNodeLogin({ query: { ticket: handoffTicket } }, reuse);
    assert.equal(reuse.statusCode, 400);
  } finally {
    pamNodes.getUser = oldUser;
    pamNodes.fetchNodes = oldNodes;
  }
});
