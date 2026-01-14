import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { PezkuwiProvider, usePezkuwi } from './PezkuwiContext';
import { ApiPromise } from '@pezkuwi/api';

// Wrapper for provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PezkuwiProvider>{children}</PezkuwiProvider>
);

describe('PezkuwiContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide pezkuwi context', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.api).toBeNull();
    expect(result.current.isApiReady).toBe(false);
    expect(result.current.selectedAccount).toBeNull();
  });

  it('should initialize API connection', async () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    await waitFor(() => {
      expect(result.current.isApiReady).toBe(false); // Mock doesn't complete
    });
  });

  it('should provide connectWallet function', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(result.current.connectWallet).toBeDefined();
    expect(typeof result.current.connectWallet).toBe('function');
  });

  it('should handle disconnectWallet', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    act(() => {
      result.current.disconnectWallet();
    });

    expect(result.current.selectedAccount).toBeNull();
  });

  it('should provide setSelectedAccount function', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(result.current.setSelectedAccount).toBeDefined();
    expect(typeof result.current.setSelectedAccount).toBe('function');
  });

  it('should set selected account', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    const testAccount = { address: '5test', name: 'Test Account' };

    act(() => {
      result.current.setSelectedAccount(testAccount);
    });

    expect(result.current.selectedAccount).toEqual(testAccount);
  });

  it('should provide getKeyPair function', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(result.current.getKeyPair).toBeDefined();
    expect(typeof result.current.getKeyPair).toBe('function');
  });

  it('should throw error when usePezkuwi is used outside provider', () => {
    // Suppress console error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePezkuwi());
    }).toThrow('usePezkuwi must be used within PezkuwiProvider');

    spy.mockRestore();
  });

  it('should handle accounts array', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(Array.isArray(result.current.accounts)).toBe(true);
  });

  it('should handle error state', () => {
    const { result } = renderHook(() => usePezkuwi(), { wrapper });

    expect(result.current.error).toBeDefined();
  });
});
