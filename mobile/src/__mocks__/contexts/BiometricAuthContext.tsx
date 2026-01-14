import React, { createContext, useContext, ReactNode } from 'react';

// Mock Biometric Auth Context for testing
interface BiometricAuthContextType {
  isBiometricSupported: boolean;
  isBiometricEnrolled: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isBiometricEnabled: boolean;
  authenticate: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
}

const mockBiometricContext: BiometricAuthContextType = {
  isBiometricSupported: true,
  isBiometricEnrolled: true,
  isBiometricAvailable: true,
  biometricType: 'fingerprint',
  isBiometricEnabled: false,
  authenticate: jest.fn().mockResolvedValue(true),
  enableBiometric: jest.fn().mockResolvedValue(true),
  disableBiometric: jest.fn().mockResolvedValue(undefined),
};

const BiometricAuthContext = createContext<BiometricAuthContextType>(mockBiometricContext);

export const MockBiometricAuthProvider: React.FC<{
  children: ReactNode;
  value?: Partial<BiometricAuthContextType>
}> = ({ children, value = {} }) => {
  const contextValue = { ...mockBiometricContext, ...value };
  return <BiometricAuthContext.Provider value={contextValue}>{children}</BiometricAuthContext.Provider>;
};

export const useBiometricAuth = () => useContext(BiometricAuthContext);

export default BiometricAuthContext;
