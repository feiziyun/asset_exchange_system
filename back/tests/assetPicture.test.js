const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/index');
const originalPromise = db.promise;
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);
let queriedHash;
db.promise = () => ({ query: async (_sql, params) => {
  queriedHash = params[0];
  return [[{ picture: webp, picture_mime_type: 'image/jpeg' }]];
} });
const picture = require('../service/assetPicture');
db.promise = originalPromise;

test('legacy hash serves WebP bytes with the correct MIME type', async () => {
  const headers = {};
  let body;
  const response = {
    set: (name, value) => { headers[name] = value; return response; },
    end: (value) => { body = value; return response; },
  };
  await picture({ params: { fileHash: 'AbC_legacy~hash-01' } }, response);
  assert.equal(queriedHash, 'AbC_legacy~hash-01');
  assert.equal(headers['Content-Type'], 'image/webp');
  assert.deepEqual(body, webp);
});
