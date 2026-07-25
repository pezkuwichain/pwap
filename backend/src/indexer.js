// Indexer core — pure, injectable, offline-testable.
//
// This module deliberately does NOT import @pezkuwi/api. It operates on
// already-decoded extrinsic objects and an injected sqlite handle, so the
// dedup / symbol-mapping / DB logic can be exercised in CI with no live chain
// and an in-memory (`:memory:`) database. src/index.js wires this to the live
// WsProvider/ApiPromise subscription.

import express from 'express'
import cors from 'cors'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

// Open (or create) the transfers DB. Pass ':memory:' in tests.
export async function initDb (filename = './transactions.db') {
  const db = await open({ filename, driver: sqlite3.Database })

  await db.exec(`
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE,
            sender TEXT,
            receiver TEXT,
            amount TEXT,
            asset_id INTEGER DEFAULT NULL,
            symbol TEXT,
            block_number INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)

  return db
}

// Persist a single transfer. INSERT OR IGNORE gives us hash-level dedup so the
// same extrinsic seen twice (re-org / replay / overlapping subscriptions) is a
// no-op instead of a duplicate row.
export async function saveTransfer (db, tx) {
  try {
    await db.run(
      `INSERT OR IGNORE INTO transfers (hash, sender, receiver, amount, asset_id, symbol, block_number)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tx.hash, tx.sender, tx.receiver, tx.amount, tx.asset_id, tx.symbol, tx.block_number]
    )
    console.log(`Indexed ${tx.symbol} Transfer: ${tx.hash.slice(0, 10)}...`)
  } catch (err) {
    console.error('DB Insert Error:', err)
  }
}

// Decode a single (decoded) extrinsic into a transfer row, or null if it is not
// a transfer we index. Kept pure so it can be unit-tested with plain fixtures.
export function parseExtrinsic (ex, blockNumber) {
  const { method: { method, section }, signer } = ex

  // 1. Native HEZ transfers
  if (section === 'balances' && (method === 'transfer' || method === 'transferKeepAlive')) {
    const [dest, value] = ex.method.args
    return {
      hash: ex.hash.toHex(),
      sender: signer.toString(),
      receiver: dest.toString(),
      amount: value.toString(),
      asset_id: null,
      symbol: 'HEZ',
      block_number: blockNumber
    }
  }

  // 2. Asset transfers (PEZ, USDT, …)
  if (section === 'assets' && method === 'transfer') {
    const [id, dest, value] = ex.method.args
    const assetId = id.toNumber()
    const symbol = assetId === 1 ? 'PEZ' : assetId === 1000 ? 'USDT' : `ASSET-${assetId}`
    return {
      hash: ex.hash.toHex(),
      sender: signer.toString(),
      receiver: dest.toString(),
      amount: value.toString(),
      asset_id: assetId,
      symbol,
      block_number: blockNumber
    }
  }

  return null
}

// Index every relevant extrinsic in a block. Sequential await (vs the original
// fire-and-forget forEach) so inserts actually complete before the block is
// considered processed — same rows, just no lost/racing writes.
export async function indexBlock (db, signedBlock, blockNumber) {
  for (const ex of signedBlock.block.extrinsics) {
    const transfer = parseExtrinsic(ex, blockNumber)
    if (transfer) await saveTransfer(db, transfer)
  }
}

// Build the read-only indexer API over an injected db handle.
export function createApp (db) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // Liveness/readiness probe (used by the Docker HEALTHCHECK).
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/api/history/:address', async (req, res) => {
    const { address } = req.params
    try {
      const history = await db.all(
        `SELECT * FROM transfers
                 WHERE sender = ? OR receiver = ?
                 ORDER BY block_number DESC LIMIT 50`,
        [address, address]
      )
      res.json(history)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await db.get('SELECT COUNT(*) as total FROM transfers')
      res.json(stats)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return app
}
