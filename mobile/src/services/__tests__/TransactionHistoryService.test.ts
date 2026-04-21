import {
  filterTransactions,
  groupByDate,
  abbreviateAddress,
  TransactionRecord,
} from '../TransactionHistoryService';

const makeTx = (overrides: Partial<TransactionRecord> = {}): TransactionRecord => ({
  id: 'test-1',
  hash: '0xabc',
  blockNumber: 100,
  timestamp: Date.now(),
  type: 'transfer_out',
  section: 'balances',
  method: 'transfer',
  from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  amount: '10.0000',
  amountRaw: '10000000000000',
  token: 'HEZ',
  fee: '0.001',
  success: true,
  ...overrides,
});

describe('filterTransactions', () => {
  const txs: TransactionRecord[] = [
    makeTx({ type: 'transfer_in' }),
    makeTx({ type: 'transfer_out', id: '2' }),
    makeTx({ type: 'staking', id: '3', section: 'staking', method: 'Rewarded' }),
    makeTx({ type: 'swap', id: '4', section: 'assetConversion' }),
    makeTx({ type: 'other', id: '5' }),
  ];

  it('returns all transactions for "all" filter', () => {
    expect(filterTransactions(txs, 'all')).toHaveLength(5);
  });

  it('filters transfers only', () => {
    const result = filterTransactions(txs, 'transfers');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.type === 'transfer_in' || t.type === 'transfer_out')).toBe(true);
  });

  it('filters staking only', () => {
    const result = filterTransactions(txs, 'staking');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('staking');
  });

  it('filters swaps only', () => {
    const result = filterTransactions(txs, 'swaps');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('swap');
  });

  it('returns empty array when no matches', () => {
    const onlyTransfers = [makeTx({ type: 'transfer_in' })];
    expect(filterTransactions(onlyTransfers, 'staking')).toHaveLength(0);
  });
});

describe('groupByDate', () => {
  it('groups transactions by date', () => {
    const today = Date.now();
    const yesterday = today - 86400000;

    const txs = [
      makeTx({ id: '1', timestamp: today }),
      makeTx({ id: '2', timestamp: today }),
      makeTx({ id: '3', timestamp: yesterday }),
    ];

    const groups = groupByDate(txs);
    expect(groups).toHaveLength(2);
    expect(groups[0].dateLabel).toBe('Today');
    expect(groups[0].transactions).toHaveLength(2);
    expect(groups[1].dateLabel).toBe('Yesterday');
    expect(groups[1].transactions).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(groupByDate([])).toHaveLength(0);
  });

  it('formats older dates with month/day/year', () => {
    const oldDate = new Date('2025-01-15').getTime();
    const txs = [makeTx({ timestamp: oldDate })];
    const groups = groupByDate(txs);
    expect(groups[0].dateLabel).not.toBe('Today');
    expect(groups[0].dateLabel).not.toBe('Yesterday');
    expect(groups[0].dateLabel).toContain('Jan');
  });
});

describe('abbreviateAddress', () => {
  it('abbreviates long addresses', () => {
    const addr = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const result = abbreviateAddress(addr);
    expect(result).toBe('5Grwva...GKutQY');
    expect(result.length).toBeLessThan(addr.length);
  });

  it('returns short strings unchanged', () => {
    expect(abbreviateAddress('short')).toBe('short');
  });

  it('handles exact boundary (16 chars)', () => {
    expect(abbreviateAddress('1234567890123456')).toBe('1234567890123456');
  });
});
