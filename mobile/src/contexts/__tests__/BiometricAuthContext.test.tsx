import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BiometricAuthProvider, useBiometricAuth } from '../BiometricAuthContext';

// Mock expo modules
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]), // FINGERPRINT
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockImplementation((_alg: string, data: string) =>
    Promise.resolve('sha256_' + data.length)
  ),
  getRandomBytes: jest.fn().mockReturnValue(new Uint8Array(32).fill(42)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BiometricAuthProvider>{children}</BiometricAuthProvider>
);

describe('BiometricAuthContext', () => {
  it('initializes with biometric support detected', async () => {
    const { result } = renderHook(() => useBiometricAuth(), { wrapper });

    // Wait for async init
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(result.current.isBiometricSupported).toBe(true);
    expect(result.current.isBiometricEnrolled).toBe(true);
    expect(result.current.biometricType).toBe('fingerprint');
  });

  it('authenticate returns true on success', async () => {
    const { result } = renderHook(() => useBiometricAuth(), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    let authResult: boolean = false;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult).toBe(true);
  });

  it('setPinCode does not throw', async () => {
    const { result } = renderHook(() => useBiometricAuth(), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // setPinCode should complete without error
    await act(async () => {
      await expect(result.current.setPinCode('1234')).resolves.not.toThrow();
    });
  });

  it('unlock sets isLocked to false', async () => {
    const { result } = renderHook(() => useBiometricAuth(), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.isLocked).toBe(false);
  });
});
