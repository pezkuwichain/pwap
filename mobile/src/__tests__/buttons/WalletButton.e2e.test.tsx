/**
 * WalletButton E2E Tests
 *
 * Tests the Wallet button flow including:
 * - WalletSetupScreen choice screen
 * - Basic navigation
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock contexts
jest.mock('../../contexts/ThemeContext', () => require('../../__mocks__/contexts/ThemeContext'));
jest.mock('../../contexts/AuthContext', () => require('../../__mocks__/contexts/AuthContext'));

jest.mock('../../contexts/PezkuwiContext', () => ({
  usePezkuwi: () => ({
    api: null,
    isApiReady: false,
    accounts: [],
    selectedAccount: null,
    connectWallet: jest.fn().mockResolvedValue(undefined),
    disconnectWallet: jest.fn(),
    createWallet: jest.fn().mockResolvedValue({
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      mnemonic: 'test test test test test test test test test test test junk',
    }),
    importWallet: jest.fn().mockResolvedValue({
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    }),
    getKeyPair: jest.fn(),
    currentNetwork: 'mainnet',
    switchNetwork: jest.fn(),
    error: null,
  }),
  NetworkType: { MAINNET: 'mainnet' },
  NETWORKS: { mainnet: { displayName: 'Mainnet', endpoint: 'wss://mainnet.example.com' } },
}));

// Mock @pezkuwi/util-crypto
jest.mock('@pezkuwi/util-crypto', () => ({
  mnemonicGenerate: () => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  mnemonicValidate: () => true,
  cryptoWaitReady: jest.fn().mockResolvedValue(true),
}));

// Mock navigation
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    replace: mockReplace,
    setOptions: jest.fn(),
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

import WalletSetupScreen from '../../screens/WalletSetupScreen';
import { MockThemeProvider } from '../../__mocks__/contexts/ThemeContext';
import { MockAuthProvider } from '../../__mocks__/contexts/AuthContext';

const renderSetup = () => render(
  <MockAuthProvider>
    <MockThemeProvider>
      <WalletSetupScreen />
    </MockThemeProvider>
  </MockAuthProvider>
);

describe('WalletSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders choice screen', async () => {
    const { getByTestId, getByText } = renderSetup();
    await waitFor(() => {
      expect(getByTestId('wallet-setup-screen')).toBeTruthy();
      expect(getByText('Set Up Your Wallet')).toBeTruthy();
    });
  });

  it('shows create button', async () => {
    const { getByTestId, getByText } = renderSetup();
    await waitFor(() => {
      expect(getByTestId('wallet-setup-create-button')).toBeTruthy();
      expect(getByText('Create New Wallet')).toBeTruthy();
    });
  });

  it('shows import button', async () => {
    const { getByTestId, getByText } = renderSetup();
    await waitFor(() => {
      expect(getByTestId('wallet-setup-import-button')).toBeTruthy();
      expect(getByText('Import Existing Wallet')).toBeTruthy();
    });
  });

  it('close button calls goBack', async () => {
    const { getByTestId } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-close'));
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('create button shows seed phrase screen', async () => {
    const { getByTestId, getByText } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-create-button'));
    });
    await waitFor(() => {
      expect(getByText('Your Recovery Phrase')).toBeTruthy();
    });
  });

  it('import button shows import screen', async () => {
    const { getByTestId, getByText } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-import-button'));
    });
    await waitFor(() => {
      expect(getByText('Import Wallet')).toBeTruthy();
    });
  });

  it('seed phrase screen has mnemonic grid', async () => {
    const { getByTestId } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-create-button'));
    });
    await waitFor(() => {
      expect(getByTestId('mnemonic-grid')).toBeTruthy();
    });
  });

  it('import screen has input field', async () => {
    const { getByTestId } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-import-button'));
    });
    await waitFor(() => {
      expect(getByTestId('wallet-import-input')).toBeTruthy();
    });
  });

  it('back from seed phrase goes to choice', async () => {
    const { getByTestId } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-create-button'));
    });
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-back'));
    });
    await waitFor(() => {
      expect(getByTestId('wallet-setup-choice')).toBeTruthy();
    });
  });

  it('back from import goes to choice', async () => {
    const { getByTestId } = renderSetup();
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-import-button'));
    });
    await waitFor(() => {
      fireEvent.press(getByTestId('wallet-setup-back'));
    });
    await waitFor(() => {
      expect(getByTestId('wallet-setup-choice')).toBeTruthy();
    });
  });
});
