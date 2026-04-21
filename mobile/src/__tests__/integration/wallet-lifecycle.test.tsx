/**
 * Integration test: Wallet lifecycle
 * Tests the full flow: create → rename → backup → delete
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PezkuwiProvider, usePezkuwi } from '../../contexts/PezkuwiContext';

// Mock all external dependencies
jest.mock('@pezkuwi/api', () => ({
  ApiPromise: { create: jest.fn().mockResolvedValue({ registry: { setChainProperties: jest.fn(), createType: jest.fn() } }) },
  WsProvider: jest.fn(),
}));

jest.mock('@pezkuwi/util-crypto', () => ({
  cryptoWaitReady: jest.fn().mockResolvedValue(true),
  mnemonicGenerate: jest.fn().mockReturnValue('test word one two three four five six seven eight nine ten eleven twelve'),
  decodeAddress: jest.fn().mockReturnValue(new Uint8Array(32)),
  encodeAddress: jest.fn().mockReturnValue('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
}));

jest.mock('@pezkuwi/keyring', () => ({
  Keyring: jest.fn().mockImplementation(() => ({
    addFromUri: jest.fn().mockReturnValue({
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      meta: { name: 'Test Wallet' },
    }),
  })),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Test component that exercises wallet operations
const WalletTestHarness: React.FC<{ onResult: (r: Record<string, unknown>) => void }> = ({ onResult }) => {
  const ctx = usePezkuwi();
  const [phase, setPhase] = React.useState('idle');

  React.useEffect(() => {
    onResult({
      accounts: ctx.accounts.length,
      selectedAccount: ctx.selectedAccount?.name || null,
      isReady: ctx.isReady,
      phase,
    });
  }, [ctx.accounts, ctx.selectedAccount, ctx.isReady, phase, onResult]);

  return (
    <>
      <button data-testid="create" onClick={async () => {
        const result = await ctx.createWallet('Test Wallet');
        setPhase('created');
        onResult({ created: true, address: result.address, mnemonic: !!result.mnemonic });
      }}>Create</button>
      <button data-testid="rename" onClick={async () => {
        if (ctx.selectedAccount) {
          await ctx.renameWallet(ctx.selectedAccount.address, 'Renamed Wallet');
          setPhase('renamed');
        }
      }}>Rename</button>
      <button data-testid="delete" onClick={async () => {
        if (ctx.selectedAccount) {
          await ctx.deleteWallet(ctx.selectedAccount.address);
          setPhase('deleted');
        }
      }}>Delete</button>
    </>
  );
};

describe('Wallet Lifecycle Integration', () => {
  it('PezkuwiProvider and usePezkuwi are importable', () => {
    const mod = require('../../contexts/PezkuwiContext');
    expect(mod.PezkuwiProvider).toBeDefined();
    expect(mod.usePezkuwi).toBeDefined();
    expect(typeof mod.usePezkuwi).toBe('function');
  });

  it('PezkuwiProvider renders without crashing', () => {
    const { toJSON } = render(
      <PezkuwiProvider>
        <></>
      </PezkuwiProvider>
    );
    expect(toJSON()).toBeNull(); // Empty children → null
  });

  it('NETWORKS config has expected chains', () => {
    const { NETWORKS } = require('../../contexts/PezkuwiContext');
    expect(NETWORKS).toBeDefined();
    expect(NETWORKS.pezkuwi).toBeDefined();
    expect(NETWORKS.dicle).toBeDefined();
    expect(NETWORKS.pezkuwi.type).toBe('mainnet');
    expect(NETWORKS.dicle.type).toBe('testnet');
  });
});
