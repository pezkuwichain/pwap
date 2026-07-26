// Indexer service bootstrap.
//
// Thin wiring layer: connects to the live chain and feeds decoded blocks into
// the injectable core in ./indexer.js (which holds all the DB + HTTP logic and
// is unit-tested offline). Keeping the @pezkuwi/api connection isolated here
// means the testable core never touches the network.

import { ApiPromise, WsProvider } from '@pezkuwi/api'
import dotenv from 'dotenv'
import { initDb, indexBlock, createApp } from './indexer.js'

dotenv.config()

const port = process.env.PORT || 3001
const WS_ENDPOINT = process.env.WS_ENDPOINT || 'wss://rpc.pezkuwichain.io'

// Start Indexing
async function startIndexer (db) {
  console.log(`Connecting to Pezkuwi Node: ${WS_ENDPOINT}`)
  const provider = new WsProvider(WS_ENDPOINT)
  const api = await ApiPromise.create({ provider })

  console.log('Connected! Listening for new blocks...')

  api.rpc.chain.subscribeNewHeads(async (header) => {
    const blockNumber = header.number.toNumber()
    const blockHash = await api.rpc.chain.getBlockHash(blockNumber)
    const signedBlock = await api.rpc.chain.getBlock(blockHash)
    await indexBlock(db, signedBlock, blockNumber)
  })
}

// Launch
// DB_PATH lets the deploy point the stateful sqlite file at a mounted volume
// (e.g. /data/transactions.db); defaults to the historical ./transactions.db.
const db = await initDb(process.env.DB_PATH || './transactions.db')
startIndexer(db)

const app = createApp(db)
app.listen(port, () => {
  console.log(`Indexer API running at http://localhost:${port}`)
})
