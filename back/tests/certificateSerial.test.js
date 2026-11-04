const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLatestCertSn } = require('../service/certificate');

test('CA serial remains exact above JS safe integer and ignores field order', () => {
  const raw = JSON.stringify({ data: { list: [
    { certContent: 'OLD', expirationDate: 1, certSn: '9007199254740992', userId: 'alice.sign' },
    { expirationDate: 2, certContent: 'NEW', userId: 'alice.sign', certSn: '900719925474099312345' },
    { expirationDate: 3, certContent: 'OTHER', userId: 'bob.sign', certSn: '999999999999999999999' },
  ] } }).replace(/"certSn":"(\d+)"/g, '"certSn":$1');
  assert.equal(parseLatestCertSn(raw, 'alice', 'sign'), '900719925474099312345');
});
