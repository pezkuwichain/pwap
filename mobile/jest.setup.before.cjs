// Setup file that runs BEFORE setupFilesAfterEnv
// This is needed to mock Expo's winter runtime before it loads

// Define __DEV__ global for React Native
global.__DEV__ = true;

// Mock the __ExpoImportMetaRegistry getter to prevent winter errors
Object.defineProperty(global, '__ExpoImportMetaRegistry__', {
  get() {
    return {
      get: () => ({}),
      register: () => {},
    };
  },
  configurable: true,
});

// Mock expo module
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  registerRootComponent: jest.fn(),
}));
