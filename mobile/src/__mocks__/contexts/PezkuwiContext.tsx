import React, { createContext, useContext, ReactNode } from 'react';

export const mockPezkuwiContext = {
  api: null,
  isApiReady: false,
  selectedAccount: { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', name: 'Test Account' },
  accounts: [{ address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', name: 'Test Account' }],
  connectWallet: jest.fn(),
  disconnectWallet: jest.fn(),
  setSelectedAccount: jest.fn(),
  getKeyPair: jest.fn(),
  currentNetwork: 'pezkuwi' as const,
  switchNetwork: jest.fn(),
  endpoint: 'wss://rpc.pezkuwichain.io:9944',
  setEndpoint: jest.fn(),
  error: null,
};

export const NETWORKS = {
  pezkuwi: {
    name: 'pezkuwi',
    displayName: 'Pezkuwi Mainnet',
    rpcEndpoint: 'wss://rpc-mainnet.pezkuwichain.io:9944',
    ss58Format: 42,
    type: 'mainnet' as const,
  },
  dicle: {
    name: 'dicle',
    displayName: 'Dicle Testnet',
    rpcEndpoint: 'wss://rpc-dicle.pezkuwichain.io:9944',
    ss58Format: 2,
    type: 'testnet' as const,
  },
  zagros: {
    name: 'zagros',
    displayName: 'Zagros Canary',
    rpcEndpoint: 'wss://rpc-zagros.pezkuwichain.io:9944',
    ss58Format: 42,
    type: 'canary' as const,
  },
  bizinikiwi: {
    name: 'bizinikiwi',
    displayName: 'Bizinikiwi Dev',
    rpcEndpoint: 'wss://localhost:9944',
    ss58Format: 42,
    type: 'dev' as const,
  },
  zombienet: {
    name: 'zombienet',
    displayName: 'Zombienet Local',
    rpcEndpoint: 'wss://localhost:19944',
    ss58Format: 42,
    type: 'dev' as const,
  },
};

const PezkuwiContext = createContext(mockPezkuwiContext);

export const usePezkuwi = () => {
  return useContext(PezkuwiContext);
};

export const PezkuwiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <PezkuwiContext.Provider value={mockPezkuwiContext}>
      {children}
    </PezkuwiContext.Provider>
  );
};

interface MockPezkuwiProviderProps {
  children: ReactNode;
  value?: Partial<typeof mockPezkuwiContext>;
}

export const MockPezkuwiProvider: React.FC<MockPezkuwiProviderProps> = ({
  children,
  value = {},
}) => {
  return (
    <PezkuwiContext.Provider value={{ ...mockPezkuwiContext, ...value }}>
      {children}
    </PezkuwiContext.Provider>
  );
};
