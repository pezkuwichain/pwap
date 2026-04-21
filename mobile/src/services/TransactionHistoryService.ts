import type { ApiPromise } from '@pezkuwi/api';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

/**
 * Transaction types we track
 */
export type TransactionType = 'transfer_in' | 'transfer_out' | 'staking' | 'swap' | 'other';

export interface TransactionRecord {
  id: string; // blockNumber-extrinsicIndex or event key
  hash: string;
  blockNumber: number;
  timestamp: number; // unix ms
  type: TransactionType;
  section: string;
  method: string;
  from: string;
  to: string;
  amount: string; // formatted with decimals
  amountRaw: string;
  token: string;
  fee: string;
  success: boolean;
}

export type HistoryFilter = 'all' | 'transfers' | 'staking' | 'swaps';

const STORAGE_KEY_PREFIX = '@pezkuwi_tx_history_';
const MAX_CACHED_TXS = 200;
const BLOCKS_TO_SCAN = 50; // Scan last N blocks for history

/**
 * Get cache key for an address + network
 */
function getCacheKey(address: string, network: string): string {
  return `${STORAGE_KEY_PREFIX}${network}_${address.slice(0, 8)}`;
}

/**
 * Load cached transactions from AsyncStorage
 */
export async function loadCachedHistory(
  address: string,
  network: string
): Promise<TransactionRecord[]> {
  try {
    const key = getCacheKey(address, network);
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    logger.warn('[TxHistory] Cache load error:', e);
  }
  return [];
}

/**
 * Save transactions to cache
 */
async function saveToCache(
  address: string,
  network: string,
  transactions: TransactionRecord[]
): Promise<void> {
  try {
    const key = getCacheKey(address, network);
    const trimmed = transactions.slice(0, MAX_CACHED_TXS);
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch (e) {
    logger.warn('[TxHistory] Cache save error:', e);
  }
}

/**
 * Determine transaction type from section/method
 */
function classifyTransaction(
  section: string,
  method: string,
  fromAddress: string,
  toAddress: string,
  accountAddress: string
): TransactionType {
  const normalizedAccount = accountAddress.toLowerCase();
  const normalizedFrom = fromAddress.toLowerCase();
  const normalizedTo = toAddress.toLowerCase();

  if (section === 'balances' || section === 'assets') {
    if (normalizedTo === normalizedAccount) return 'transfer_in';
    if (normalizedFrom === normalizedAccount) return 'transfer_out';
  }

  if (section === 'staking' || section === 'nominationPools') {
    return 'staking';
  }

  if (section === 'assetConversion') {
    return 'swap';
  }

  return 'other';
}

/**
 * Format address for comparison (encode to same SS58 format)
 */
function normalizeAddress(address: string | Uint8Array, ss58Format: number): string {
  try {
    if (typeof address === 'string') {
      const decoded = decodeAddress(address);
      return encodeAddress(decoded, ss58Format);
    }
    return encodeAddress(address, ss58Format);
  } catch {
    return typeof address === 'string' ? address : '';
  }
}

/**
 * Parse transfer events from a block's events
 */
function parseTransferEvents(
  events: Array<{ event: { section: string; method: string; data: unknown[] }; phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } } }>,
  blockNumber: number,
  timestamp: number,
  accountAddress: string,
  ss58Format: number
): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  const normalizedAccount = normalizeAddress(accountAddress, ss58Format);

  for (const record of events) {
    const { event } = record;
    const { section, method, data } = event;

    // balances.Transfer(from, to, amount)
    if (section === 'balances' && method === 'Transfer') {
      const from = normalizeAddress(data[0]?.toString() || '', ss58Format);
      const to = normalizeAddress(data[1]?.toString() || '', ss58Format);
      const amountRaw = data[2]?.toString() || '0';

      if (from === normalizedAccount || to === normalizedAccount) {
        const amount = (Number(amountRaw) / 1e12).toFixed(4);
        const type = classifyTransaction(section, method, from, to, normalizedAccount);
        const extrinsicIndex = record.phase.isApplyExtrinsic
          ? record.phase.asApplyExtrinsic.toNumber()
          : 0;

        records.push({
          id: `${blockNumber}-${extrinsicIndex}-${records.length}`,
          hash: '',
          blockNumber,
          timestamp,
          type,
          section,
          method,
          from,
          to,
          amount,
          amountRaw,
          token: 'HEZ',
          fee: '0',
          success: true,
        });
      }
    }

    // assets.Transferred(assetId, from, to, amount)
    if (section === 'assets' && method === 'Transferred') {
      const assetId = data[0]?.toString() || '';
      const from = normalizeAddress(data[1]?.toString() || '', ss58Format);
      const to = normalizeAddress(data[2]?.toString() || '', ss58Format);
      const amountRaw = data[3]?.toString() || '0';

      if (from === normalizedAccount || to === normalizedAccount) {
        // Determine token based on asset ID
        let token = `Asset#${assetId}`;
        let decimals = 12;
        if (assetId === '1') { token = 'PEZ'; decimals = 12; }
        else if (assetId === '1000') { token = 'USDT'; decimals = 6; }
        else if (assetId === '1001') { token = 'DOT'; decimals = 10; }

        const amount = (Number(amountRaw) / Math.pow(10, decimals)).toFixed(4);
        const type = classifyTransaction(section, method, from, to, normalizedAccount);
        const extrinsicIndex = record.phase.isApplyExtrinsic
          ? record.phase.asApplyExtrinsic.toNumber()
          : 0;

        records.push({
          id: `${blockNumber}-${extrinsicIndex}-${records.length}`,
          hash: '',
          blockNumber,
          timestamp,
          type,
          section,
          method,
          from,
          to,
          amount,
          amountRaw,
          token,
          fee: '0',
          success: true,
        });
      }
    }

    // Staking events
    if (section === 'staking' && (method === 'Rewarded' || method === 'Bonded' || method === 'Unbonded')) {
      const staker = normalizeAddress(data[0]?.toString() || '', ss58Format);
      const amountRaw = data[1]?.toString() || '0';

      if (staker === normalizedAccount) {
        const amount = (Number(amountRaw) / 1e12).toFixed(4);
        const extrinsicIndex = record.phase.isApplyExtrinsic
          ? record.phase.asApplyExtrinsic.toNumber()
          : 0;

        records.push({
          id: `${blockNumber}-${extrinsicIndex}-${records.length}`,
          hash: '',
          blockNumber,
          timestamp,
          type: 'staking',
          section,
          method,
          from: staker,
          to: staker,
          amount,
          amountRaw,
          token: 'HEZ',
          fee: '0',
          success: true,
        });
      }
    }
  }

  return records;
}

const INDEXER_BASE_URL = 'https://bereketli.pezkiwi.app/v1';

/**
 * Try fetching transaction history from the indexer API first.
 * Falls back to block scanning if indexer is unavailable.
 */
async function fetchFromIndexer(
  accountAddress: string,
  page: number = 1,
  limit: number = 50
): Promise<TransactionRecord[] | null> {
  try {
    const url = `${INDEXER_BASE_URL}/chain/history?address=${encodeURIComponent(accountAddress)}&page=${page}&limit=${limit}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.transactions || !Array.isArray(data.transactions)) return null;

    return data.transactions.map((tx: Record<string, unknown>) => ({
      id: `idx-${tx.block_number}-${tx.hash || Math.random()}`,
      hash: String(tx.hash || ''),
      blockNumber: Number(tx.block_number || 0),
      timestamp: Number(tx.timestamp || Date.now()),
      type: String(tx.tx_type || 'other') as TransactionType,
      section: String(tx.section || ''),
      method: String(tx.method || ''),
      from: String(tx.from || ''),
      to: String(tx.to || ''),
      amount: String(tx.amount || '0'),
      amountRaw: String(tx.amount || '0'),
      token: String(tx.token || 'HEZ'),
      fee: String(tx.fee || '0'),
      success: tx.success !== false,
    }));
  } catch {
    return null; // Indexer unavailable, fall back to block scan
  }
}

/**
 * Fetch transaction history.
 * Strategy: indexer first → block scan fallback → cached data.
 */
export async function fetchTransactionHistory(
  api: ApiPromise,
  accountAddress: string,
  network: string,
  options: {
    blocksToScan?: number;
    onProgress?: (scanned: number, total: number) => void;
  } = {}
): Promise<TransactionRecord[]> {
  // Try indexer first (fast, full history)
  const indexerResult = await fetchFromIndexer(accountAddress);
  if (indexerResult && indexerResult.length > 0) {
    await saveToCache(accountAddress, network, indexerResult);
    return indexerResult;
  }

  // Fallback to block scanning
  const blocksToScan = options.blocksToScan || BLOCKS_TO_SCAN;
  const ss58Format = api.registry.chainSS58 ?? 42;

  // Load cached first
  const cached = await loadCachedHistory(accountAddress, network);
  const lastCachedBlock = cached.length > 0 ? cached[0].blockNumber : 0;

  try {
    // Get current block number
    const header = await api.rpc.chain.getHeader();
    const currentBlock = header.number.toNumber();

    // Calculate scan range - from last cached or last N blocks
    const startBlock = lastCachedBlock > 0
      ? Math.max(lastCachedBlock + 1, currentBlock - blocksToScan)
      : currentBlock - blocksToScan;

    if (startBlock >= currentBlock) {
      return cached; // Already up to date
    }

    const newRecords: TransactionRecord[] = [];
    const totalToScan = currentBlock - startBlock;

    // Scan blocks in batches to avoid overwhelming the node
    const BATCH_SIZE = 10;
    for (let i = startBlock; i <= currentBlock; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE - 1, currentBlock);
      const batchPromises: Promise<TransactionRecord[]>[] = [];

      for (let blockNum = i; blockNum <= batchEnd; blockNum++) {
        batchPromises.push(
          (async () => {
            try {
              const blockHash = await api.rpc.chain.getBlockHash(blockNum);
              const [events, timestamp] = await Promise.all([
                api.query.system.events.at(blockHash) as Promise<unknown[]>,
                api.query.timestamp?.now?.at(blockHash).then(
                  (t: { toNumber(): number }) => t.toNumber()
                ).catch(() => Date.now()),
              ]);

              return parseTransferEvents(
                events as Parameters<typeof parseTransferEvents>[0],
                blockNum,
                timestamp as number,
                accountAddress,
                ss58Format
              );
            } catch {
              return [];
            }
          })()
        );
      }

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        newRecords.push(...result);
      }

      options.onProgress?.(Math.min(i - startBlock + BATCH_SIZE, totalToScan), totalToScan);
    }

    // Merge new with cached, deduplicate by id, sort newest first
    const allRecords = [...newRecords, ...cached];
    const deduped = Array.from(
      new Map(allRecords.map(r => [r.id, r])).values()
    );
    deduped.sort((a, b) => b.blockNumber - a.blockNumber || b.timestamp - a.timestamp);

    // Save to cache
    await saveToCache(accountAddress, network, deduped);

    return deduped;
  } catch (error) {
    logger.warn('[TxHistory] Fetch error:', error);
    return cached; // Return cached on error
  }
}

/**
 * Add a locally-created transaction to history (called after sending)
 */
export async function addLocalTransaction(
  address: string,
  network: string,
  tx: Omit<TransactionRecord, 'id'>
): Promise<void> {
  const cached = await loadCachedHistory(address, network);
  const record: TransactionRecord = {
    ...tx,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  const updated = [record, ...cached].slice(0, MAX_CACHED_TXS);
  await saveToCache(address, network, updated);
}

/**
 * Filter transactions by type
 */
export function filterTransactions(
  transactions: TransactionRecord[],
  filter: HistoryFilter
): TransactionRecord[] {
  if (filter === 'all') return transactions;

  return transactions.filter(tx => {
    switch (filter) {
      case 'transfers':
        return tx.type === 'transfer_in' || tx.type === 'transfer_out';
      case 'staking':
        return tx.type === 'staking';
      case 'swaps':
        return tx.type === 'swap';
      default:
        return true;
    }
  });
}

/**
 * Group transactions by date for display
 */
export function groupByDate(
  transactions: TransactionRecord[]
): Array<{ date: string; dateLabel: string; transactions: TransactionRecord[] }> {
  const groups = new Map<string, TransactionRecord[]>();

  for (const tx of transactions) {
    const date = new Date(tx.timestamp);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return Array.from(groups.entries()).map(([date, txs]) => ({
    date,
    dateLabel:
      date === today
        ? 'Today'
        : date === yesterday
        ? 'Yesterday'
        : new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
    transactions: txs,
  }));
}

/**
 * Format address for display (abbreviated)
 */
export function abbreviateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
