import React, { createContext, useContext, ReactNode } from 'react';

// Mock Biometric Auth Context for testing
interface BiometricAuthContextType {
  isBiometricSupported: boolean;
  isBiometricEnrolled: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isBiometricEnabled: boolean;
  isLocked: boolean;
  autoLockTimer: number;
  authenticate: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  setPinCode: (pin: string) => Promise<void>;
  verifyPinCode: (pin: string) => Promise<boolean>;
  setAutoLockTimer: (minutes: number) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  checkAutoLock: () => Promise<void>;
}

export const mockBiometricContext: BiometricAuthContextType = {
  isBiometricSupported: true,
  isBiometricEnrolled: true,
  isBiometricAvailable: true,
  biometricType: 'fingerprint',
  isBiometricEnabled: false,
  isLocked: false,
  autoLockTimer: 5,
  authenticate: jest.fn().mockResolvedValue(true),
  enableBiometric: jest.fn().mockResolvedValue(true),
  disableBiometric: jest.fn().mockResolvedValue(undefined),
  setPinCode: jest.fn().mockResolvedValue(undefined),
  verifyPinCode: jest.fn().mockResolvedValue(true),
  setAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  lock: jest.fn(),
  unlock: jest.fn(),
  checkAutoLock: jest.fn().mockResolvedValue(undefined),
};

const BiometricAuthContext = createContext<BiometricAuthContextType>(mockBiometricContext);

export const MockBiometricAuthProvider: React.FC<{
  children: ReactNode;
  value?: Partial<BiometricAuthContextType>
}> = ({ children, value = {} }) => {
  const contextValue = { ...mockBiometricContext, ...value };
  return <BiometricAuthContext.Provider value={contextValue}>{children}</BiometricAuthContext.Provider>;
};

// Export as BiometricAuthProvider for compatibility with test imports
export const BiometricAuthProvider = MockBiometricAuthProvider;

export const useBiometricAuth = () => useContext(BiometricAuthContext);

export default BiometricAuthContext;
