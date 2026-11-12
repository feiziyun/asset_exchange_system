'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pamNodes = require('../service/pamNodes');
const auditConfig = require('../config/audit.json');

process.env.HUB_TRADING_TOKEN = 'test-hub-token';
const handlers = require('../router_handle/audit');
const { businessSecretKey } = require('../jwt_config');

const tokenFor = (identity = 'auditor') => jwt.sign(
  { id: 7, account: 'auditor01', identity }, businessSecretKey, { expiresIn: '5m' },
);

const response = () => ({
  statusCode: 200,
  cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; },
  cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
  clearCookie(name, options) { this.clearedCookie = { name, options }; return this; },
  redirect(code, url) { this.statusCode = code; this.redirectUrl = url; return this; },
});

test('entry requires an auditor or administrator and creates the reference cookie', async () => {
  const originalGetUser = pamNodes.getUser;
  pamNodes.getUser = async () => ({ id: 7, identity: 'auditor', status: 0, auditor_target: 'HUB' });
  try {
  const denied = response();
  await handlers.startPamEntry({ auth: { identity: 'buyer' }, headers: {} }, denied);
  assert.equal(denied.statusCode, 403);

  const token = tokenFor();
  const allowed = response();
  await handlers.startPamEntry({
    auth: { id: 7, identity: 'auditor' },
    headers: { authorization: `Bearer ${token}` },
    body: { pcc_contract_id: 'contract 1' },
  }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(new URL(allowed.body.entry_url).pathname, '/entry/start');
  assert.equal(new URL(allowed.body.entry_url).searchParams.get('pcc_contract_id'), 'contract 1');
  assert.equal(allowed.cookies[0].name, 'pam_trade_entry');
  assert.equal(allowed.cookies[0].value, token);
  assert.equal(allowed.cookies[0].options.httpOnly, true);
  assert.equal(allowed.cookies[0].options.sameSite, 'lax');
  assert.equal(allowed.cookies[0].options.maxAge, 300000);
  } finally {
    pamNodes.getUser = originalGetUser;
  }
});

test('callback rejects missing credentials and non-reader requests', async () => {
  const missing = response();
  await handlers.authorizePamEntry({ query: { request_id: 'r1' }, headers: {} }, missing);
  assert.equal(missing.statusCode, 401);

  const referenceCookieOnly = response();
  await handlers.authorizePamEntry({
    query: { request_id: 'r1' },
    headers: { cookie: `bupt_pam_trade_entry=${encodeURIComponent(tokenFor())}` },
  }, referenceCookieOnly);
  assert.equal(referenceCookieOnly.statusCode, 401);
  assert.match(referenceCookieOnly.body, /缺少交易交接凭据/);

  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({ mode: 'writer' });
  try {
    const denied = response();
    await handlers.authorizePamEntry({
      query: { request_id: 'r1' },
      headers: { cookie: `pam_trade_entry=${encodeURIComponent(tokenFor())}` },
    }, denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.redirectUrl, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('reader callback creates a Hub launch and redirects once', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json(calls.length === 1
      ? { mode: 'reader' }
      : { launch_url: 'https://audit.example/launch/1' });
  };
  try {
    const result = response();
    await handlers.authorizePamEntry({
      query: { request_id: 'request-1' },
      headers: { cookie: `bupt_pam_trade_entry=old-token; pam_trade_entry=${encodeURIComponent(tokenFor())}` },
    }, result);
    assert.equal(result.statusCode, 303);
    assert.equal(result.redirectUrl, 'https://audit.example/launch/1');
    assert.equal(result.clearedCookie.name, 'pam_trade_entry');
    assert.equal(calls[0].options.headers['x-trading-token'], auditConfig.hubTradingToken || 'test-hub-token');
    assert.equal(new URL(calls[0].url).pathname, '/hub/web/requests/request-1');
    assert.equal(new URL(calls[1].url).pathname, '/hub/web/launches');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      request_id: 'request-1', subject: 'trade:auditor01',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('Hub request failures do not redirect the browser', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({ detail: 'Hub unavailable' }, { status: 503 });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = response();
    await handlers.authorizePamEntry({
      query: { request_id: 'request-2' },
      headers: { cookie: `pam_trade_entry=${encodeURIComponent(tokenFor())}` },
    }, result);
    assert.equal(result.statusCode, 502);
    assert.equal(result.redirectUrl, undefined);
  } finally {
    console.error = originalError;
    global.fetch = originalFetch;
  }
});
