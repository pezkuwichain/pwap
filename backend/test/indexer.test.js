// Offline indexer tests — in-memory sqlite, no live chain.
// Run: node --test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { initDb, saveTransfer, parseExtrinsic, indexBlock, createApp } from '../src/indexer.js'

// --- fixtures ---------------------------------------------------------------

// Build a decoded-extrinsic look-alike matching the shape parseExtrinsic reads.
function mkEx ({ section, method, args, hash, signer }) {
  return {
    method: { section, method, args },
    signer: { toString: () => signer },
    hash: { toHex: () => hash }
  }
}

const scalar = (s) => ({ toString: () => s })
const numeric = (n) => ({ toNumber: () => n })

// --- parseExtrinsic ---------------------------------------------------------

test('parseExtrinsic maps native balances.transfer to HEZ', () => {
  const ex = mkEx({
    section: 'balances',
    method: 'transfer',
    args: [scalar('5Receiver'), scalar('1000')],
    hash: '0xhez1',
    signer: '5Sender'
  })
  const t = parseExtrinsic(ex, 42)
  assert.deepEqual(t, {
    hash: '0xhez1',
    sender: '5Sender',
    receiver: '5Receiver',
    amount: '1000',
    asset_id: null,
    symbol: 'HEZ',
    block_number: 42
  })
})

test('parseExtrinsic maps balances.transferKeepAlive to HEZ', () => {
  const ex = mkEx({
    section: 'balances',
    method: 'transferKeepAlive',
    args: [scalar('5R'), scalar('7')],
    hash: '0xhez2',
    signer: '5S'
  })
  assert.equal(parseExtrinsic(ex, 1).symbol, 'HEZ')
})

test('parseExtrinsic maps asset ids to PEZ/USDT/ASSET-n', () => {
  const mk = (id) => mkEx({
    section: 'assets',
    method: 'transfer',
    args: [numeric(id), scalar('5R'), scalar('9')],
    hash: `0xa${id}`,
    signer: '5S'
  })
  assert.equal(parseExtrinsic(mk(1), 1).symbol, 'PEZ')
  assert.equal(parseExtrinsic(mk(1000), 1).symbol, 'USDT')
  assert.equal(parseExtrinsic(mk(5), 1).symbol, 'ASSET-5')
  assert.equal(parseExtrinsic(mk(5), 1).asset_id, 5)
})

test('parseExtrinsic ignores non-transfer extrinsics', () => {
  const ex = mkEx({
    section: 'system',
    method: 'remark',
    args: [scalar('hi')],
    hash: '0xnope',
    signer: '5S'
  })
  assert.equal(parseExtrinsic(ex, 1), null)
})

// --- dedup + persistence ----------------------------------------------------

test('saveTransfer dedups on hash (INSERT OR IGNORE)', async () => {
  const db = await initDb(':memory:')
  const tx = {
    hash: '0xdup',
    sender: '5S',
    receiver: '5R',
    amount: '100',
    asset_id: null,
    symbol: 'HEZ',
    block_number: 10
  }
  await saveTransfer(db, tx)
  await saveTransfer(db, tx) // same hash again — must be a no-op
  const { total } = await db.get('SELECT COUNT(*) as total FROM transfers')
  assert.equal(total, 1)
  await db.close()
})

test('indexBlock persists only transfer extrinsics from a block', async () => {
  const db = await initDb(':memory:')
  const signedBlock = {
    block: {
      extrinsics: [
        mkEx({ section: 'balances', method: 'transfer', args: [scalar('5R'), scalar('1')], hash: '0x1', signer: '5A' }),
        mkEx({ section: 'system', method: 'remark', args: [scalar('x')], hash: '0x2', signer: '5A' }),
        mkEx({ section: 'assets', method: 'transfer', args: [numeric(1000), scalar('5R'), scalar('2')], hash: '0x3', signer: '5B' })
      ]
    }
  }
  await indexBlock(db, signedBlock, 99)
  const rows = await db.all('SELECT hash, symbol FROM transfers ORDER BY hash')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(r => r.symbol).sort(), ['HEZ', 'USDT'])
  await db.close()
})

// --- HTTP surface -----------------------------------------------------------

test('GET /health returns 200 ok', async () => {
  const db = await initDb(':memory:')
  const app = createApp(db)
  const res = await request(app).get('/health')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.status, 'ok')
  await db.close()
})

test('GET /api/stats reflects indexed count', async () => {
  const db = await initDb(':memory:')
  await saveTransfer(db, { hash: '0xs1', sender: 'a', receiver: 'b', amount: '1', asset_id: null, symbol: 'HEZ', block_number: 1 })
  const app = createApp(db)
  const res = await request(app).get('/api/stats')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.total, 1)
  await db.close()
})

test('GET /api/history/:address filters by sender or receiver', async () => {
  const db = await initDb(':memory:')
  await saveTransfer(db, { hash: '0xh1', sender: 'alice', receiver: 'bob', amount: '1', asset_id: null, symbol: 'HEZ', block_number: 2 })
  await saveTransfer(db, { hash: '0xh2', sender: 'carol', receiver: 'dave', amount: '1', asset_id: null, symbol: 'HEZ', block_number: 3 })
  await saveTransfer(db, { hash: '0xh3', sender: 'eve', receiver: 'alice', amount: '1', asset_id: null, symbol: 'HEZ', block_number: 4 })
  const app = createApp(db)
  const res = await request(app).get('/api/history/alice')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.length, 2) // sent one, received one
  const hashes = res.body.map(r => r.hash).sort()
  assert.deepEqual(hashes, ['0xh1', '0xh3'])
  await db.close()
})
