/**
 * Configuration Index
 *
 * Central export point for all configuration
 */

export { ENV, type Environment } from './environment';
export {
  TEST_ACCOUNTS,
  getTestAccount,
  getDefaultTestAccount,
  isTestAccountsEnabled,
  getTestAccountAddresses,
  isTestAccount,
  type TestAccount,
} from './testAccounts';
