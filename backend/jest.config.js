// jest.config.js
export default {
  // Use this pattern to match files in the integration-tests directory
  testMatch: ['**/integration-tests/**/*.test.js'],
  // Set a longer timeout for tests that interact with a live network
  testTimeout: 30000,
  // Ensure we can use ES modules
  transform: {},
  // Verbose output to see test names
  verbose: true,
};
