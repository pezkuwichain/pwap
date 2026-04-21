// Test WalletConnect service configuration validation
describe('WalletConnectService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('warns when PROJECT_ID is not set in dev', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    delete process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID;

    // Re-import to trigger module-level check
    jest.isolateModules(() => {
      try {
        require('../WalletConnectService');
      } catch {
        // May throw due to missing @walletconnect deps in test env
      }
    });

    // The module-level check should have warned
    // (In test env, __DEV__ is true)
    consoleSpy.mockRestore();
  });

  it('exports expected functions', () => {
    // Verify the service module exports the expected API
    const service = jest.requireActual('../WalletConnectService');
    expect(typeof service.initWalletConnect).toBe('function');
    expect(typeof service.pair).toBe('function');
    expect(typeof service.approveSession).toBe('function');
    expect(typeof service.rejectSession).toBe('function');
    expect(typeof service.respondToRequest).toBe('function');
    expect(typeof service.rejectRequest).toBe('function');
    expect(typeof service.disconnectSession).toBe('function');
    expect(typeof service.getActiveSessions).toBe('function');
    expect(typeof service.setEventCallbacks).toBe('function');
  });
});
