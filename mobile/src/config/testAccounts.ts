/**
 * Test Accounts for Development
 *
 * Pre-funded test accounts (Alice, Bob, Charlie) for Zombienet development
 * These are well-known test accounts with pre-funded balances
 *
 * ⚠️ WARNING: NEVER use these in production! Only for dev/testing.
 */

import ENV from './environment';

export interface TestAccount {
  name: string;
  mnemonic: string;
  address: string;
  derivationPath?: string;
  balance?: string;
  description: string;
}

/**
 * Standard Substrate test accounts (Alice, Bob, Charlie, etc.)
 * These have pre-funded balances in dev chains
 */
export const TEST_ACCOUNTS: TestAccount[] = [
  {
    name: 'Alice',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk',
    address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', // //Alice
    description: 'Primary validator - Pre-funded development account',
    balance: '1,000,000 HEZ',
  },
  {
    name: 'Bob',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Bob',
    address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', // //Bob
    description: 'Secondary validator - Pre-funded development account',
    balance: '1,000,000 HEZ',
  },
  {
    name: 'Charlie',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Charlie',
    address: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y', // //Charlie
    description: 'Test user - Pre-funded development account',
    balance: '1,000,000 HEZ',
  },
  {
    name: 'Dave',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Dave',
    address: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy', // //Dave
    description: 'Test user - Pre-funded development account',
    balance: '1,000,000 HEZ',
  },
  {
    name: 'Eve',
    mnemonic: 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Eve',
    address: '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw', // //Eve
    description: 'Test user - Pre-funded development account',
    balance: '1,000,000 HEZ',
  },
];

/**
 * Get test account by name
 */
export function getTestAccount(name: string): TestAccount | undefined {
  return TEST_ACCOUNTS.find(acc => acc.name.toLowerCase() === name.toLowerCase());
}

/**
 * Check if test accounts are enabled
 */
export function isTestAccountsEnabled(): boolean {
  return ENV.enableTestAccounts && ENV.isDevelopment;
}

/**
 * Get default test account (Alice)
 */
export function getDefaultTestAccount(): TestAccount {
  return TEST_ACCOUNTS[0]; // Alice
}

/**
 * Get all test account addresses
 */
export function getTestAccountAddresses(): string[] {
  return TEST_ACCOUNTS.map(acc => acc.address);
}

/**
 * Check if address is a test account
 */
export function isTestAccount(address: string): boolean {
  return getTestAccountAddresses().includes(address);
}

export default TEST_ACCOUNTS;
