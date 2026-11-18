'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { credentialKey } = require('../service/pamCredentialKey');

test('node credential key persists and missing key never silently replaces it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-key-'));
  const file = path.join(dir, 'storage', 'pam-node-credential.key');
  const previous = process.env.PAM_NODE_CREDENTIAL_KEY;
  delete process.env.PAM_NODE_CREDENTIAL_KEY;
  try {
    assert.throws(() => credentialKey(false, file), /密钥文件缺失/);
    const first = credentialKey(true, file);
    assert.equal(first.length, 32);
    assert.deepEqual(credentialKey(true, file), first);
    assert.deepEqual(credentialKey(false, file), first);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    fs.unlinkSync(file);
    assert.throws(() => credentialKey(false, file), /密钥文件缺失/);
  } finally {
    if (previous === undefined) delete process.env.PAM_NODE_CREDENTIAL_KEY;
    else process.env.PAM_NODE_CREDENTIAL_KEY = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
