// Council / KYC service bootstrap.
//
// Thin wiring layer: builds the real Supabase client + logger, connects to the
// live chain, and mounts the injectable route factory from ./council.js. All
// endpoint logic lives in council.js so it can be tested offline; this file only
// owns the live side effects (Supabase client, blockchain connection).

import dotenv from 'dotenv'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { createClient } from '@supabase/supabase-js'
import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api'
import { cryptoWaitReady } from '@pezkuwi/util-crypto'
import { createApp } from './council.js'

dotenv.config()

// ========================================
// LOGGER SETUP
// ========================================
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  })
})

// ========================================
// INITIALIZATION
// ========================================
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  logger.fatal('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

let sudoAccount = null
let api = null

// Mount routes with live deps injected via getters (so reassignment in
// initBlockchain is picked up by handlers).
const app = createApp({
  supabase,
  getApi: () => api,
  getSudo: () => sudoAccount,
  logger
})

// ========================================
// BLOCKCHAIN CONNECTION
// ========================================
async function initBlockchain () {
  logger.info('🔗 Connecting to Blockchain...')
  const wsProvider = new WsProvider(process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944')
  api = await ApiPromise.create({ provider: wsProvider })
  await cryptoWaitReady()
  logger.info('✅ Connected to blockchain')

  if (process.env.SUDO_SEED) {
    const keyring = new Keyring({ type: 'sr25519' })
    sudoAccount = keyring.addFromUri(process.env.SUDO_SEED)
    logger.info('✅ Sudo account loaded: %s', sudoAccount.address)
  } else {
    logger.warn('⚠️ No SUDO_SEED found - auto-approval disabled')
  }
}

// ========================================
// START & EXPORT
// ========================================
initBlockchain().catch(error => {
  logger.fatal({ err: error }, '❌ Failed to initialize blockchain')
  process.exit(1)
})

export { app, supabase, logger }
