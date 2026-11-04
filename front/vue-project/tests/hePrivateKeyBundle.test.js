import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createHePrivateKeyBundle,
  parseHeKeyMaterial,
  serializeHeKeyMaterial,
} from '../src/utils/heCrypto.js'

test('one HE download contains both transaction-bound private keys', () => {
  const transactionId = 'tx-123'
  const keyPairs = {
    paillier: { privateKey: { n: 17n, lambda: 8n } },
    elgamal: { privateKey: { p: 23n, x: 7n } },
  }
  const bundle = createHePrivateKeyBundle({ transactionId, keyPairs })

  assert.match(bundle.filename, /加法乘法/)
  assert.equal(parseHeKeyMaterial(bundle.text, 'Paillier').keyMaterial.n, 17n)
  assert.equal(parseHeKeyMaterial(bundle.text, 'ElGamal').keyMaterial.x, 7n)
  assert.equal(parseHeKeyMaterial(bundle.text, 'Paillier').transactionId, transactionId)
})

test('legacy single-algorithm HE private key remains readable', () => {
  const legacy = serializeHeKeyMaterial({
    algorithm: 'Paillier',
    transactionId: 'tx-123',
    keyMaterial: { n: 17n },
  })
  assert.equal(parseHeKeyMaterial(legacy, 'Paillier').keyMaterial.n, 17n)
})
