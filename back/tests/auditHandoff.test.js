'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pamNodes = require('../service/pamNodes');
const handlers = require('../router_handle/audit');
const { businessSecretKey } = require('../jwt_config');

function response() {
  return {
    statusCode: 200,
    cookies: [],
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
    redirect(code, url) { this.statusCode = code; this.redirectUrl = url; return this; },
  };
}

test('Hub handoff sets the entry cookie on the navigated host and is one use', async () => {
  const originalGetUser = pamNodes.getUser;
  pamNodes.getUser = async () => ({ id: 7, identity: 'auditor', status: 0, auditor_target: 'HUB' });
  try {
    const token = jwt.sign({ id: 7, account: 'auditor01', identity: 'auditor' }, businessSecretKey);
    const started = response();
    await handlers.startPamEntry({
      method: 'POST',
      auth: { id: 7, identity: 'auditor' },
      headers: { authorization: `Bearer ${token}` },
      body: {},
    }, started);
    assert.equal(started.statusCode, 200);
    assert.match(started.body.handoff_url, /^\/api\/pam\/entry-continue\?ticket=/);

    const ticket = new URL(started.body.handoff_url, 'http://trade.example').searchParams.get('ticket');
    const continued = response();
    handlers.continuePamEntry({ query: { ticket } }, continued);
    assert.equal(continued.statusCode, 303);
    assert.equal(continued.redirectUrl, started.body.entry_url);
    assert.equal(continued.cookies[0].name, 'bupt_pam_trade_entry');
    assert.equal(continued.cookies[0].value, token);
    assert.equal(continued.cookies[0].options.sameSite, 'lax');

    const replay = response();
    handlers.continuePamEntry({ query: { ticket } }, replay);
    assert.equal(replay.statusCode, 400);
  } finally {
    pamNodes.getUser = originalGetUser;
  }
});
