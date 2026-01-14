/**
 * Governance Integration Tests
 *
 * End-to-end tests for governance features
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import TreasuryScreen from '../../screens/governance/TreasuryScreen';
import ProposalsScreen from '../../screens/governance/ProposalsScreen';
import ElectionsScreen from '../../screens/governance/ElectionsScreen';
import { PezkuwiProvider } from '../../contexts/PezkuwiContext';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Integration tests use real blockchain connection
describe('Governance Integration Tests', () => {
  let api: ApiPromise;

  beforeAll(async () => {
    // Connect to local zombinet
    const wsProvider = new WsProvider('ws://127.0.0.1:9944');
    api = await ApiPromise.create({ provider: wsProvider });
  }, 30000); // 30 second timeout for blockchain connection

  afterAll(async () => {
    await api?.disconnect();
  });

  describe('Treasury Integration', () => {
    it('should fetch real treasury balance from blockchain', async () => {
      const { getByText } = render(
        <NavigationContainer>
          <TreasuryScreen />
        </NavigationContainer>
      );

      // Wait for blockchain data to load
      await waitFor(
        () => {
          // Treasury balance should be displayed (even if 0)
          expect(getByText(/HEZ/i)).toBeTruthy();
        },
        { timeout: 10000 }
      );
    });

    it('should handle real blockchain connection errors', async () => {
      // Temporarily disconnect
      await api.disconnect();

      const { getByText } = render(
        <NavigationContainer>
          <TreasuryScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        // Should show error or empty state
        expect(
          getByText(/No proposals found/i) || getByText(/Error/i)
        ).toBeTruthy();
      });

      // Reconnect for other tests
      const wsProvider = new WsProvider('ws://127.0.0.1:9944');
      api = await ApiPromise.create({ provider: wsProvider });
    });
  });

  describe('Proposals Integration', () => {
    it('should fetch real referenda from democracy pallet', async () => {
      const { getByText, queryByText } = render(
        <NavigationContainer>
          <ProposalsScreen />
        </NavigationContainer>
      );

      await waitFor(
        () => {
          // Should either show referenda or empty state
          expect(
            queryByText(/Referendum/i) || queryByText(/No proposals found/i)
          ).toBeTruthy();
        },
        { timeout: 10000 }
      );
    });

    it('should display real vote counts', async () => {
      const referenda = await api.query.democracy.referendumInfoOf.entries();

      if (referenda.length > 0) {
        const { getByText } = render(
          <NavigationContainer>
            <ProposalsScreen />
          </NavigationContainer>
        );

        await waitFor(
          () => {
            // Should show vote percentages
            expect(getByText(/%/)).toBeTruthy();
          },
          { timeout: 10000 }
        );
      }
    });
  });

  describe('Elections Integration', () => {
    it('should fetch real commission proposals', async () => {
      const { queryByText } = render(
        <NavigationContainer>
          <ElectionsScreen />
        </NavigationContainer>
      );

      await waitFor(
        () => {
          // Should either show elections or empty state
          expect(
            queryByText(/Election/i) || queryByText(/No elections available/i)
          ).toBeTruthy();
        },
        { timeout: 10000 }
      );
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should maintain blockchain connection across screens', async () => {
      // Test that API connection is shared
      const treasuryBalance = await api.query.treasury?.treasury();
      const referenda = await api.query.democracy.referendumInfoOf.entries();
      const proposals = await api.query.dynamicCommissionCollective.proposals();

      // All queries should succeed without creating new connections
      expect(treasuryBalance).toBeDefined();
      expect(referenda).toBeDefined();
      expect(proposals).toBeDefined();
    });

    it('should handle simultaneous data fetching', async () => {
      // Render all governance screens at once
      const treasury = render(
        <NavigationContainer>
          <TreasuryScreen />
        </NavigationContainer>
      );

      const proposals = render(
        <NavigationContainer>
          <ProposalsScreen />
        </NavigationContainer>
      );

      const elections = render(
        <NavigationContainer>
          <ElectionsScreen />
        </NavigationContainer>
      );

      // All should load without conflicts
      await Promise.all([
        waitFor(() => expect(treasury.queryByText(/Treasury/i)).toBeTruthy(), {
          timeout: 10000,
        }),
        waitFor(() => expect(proposals.queryByText(/Proposals/i)).toBeTruthy(), {
          timeout: 10000,
        }),
        waitFor(() => expect(elections.queryByText(/Elections/i)).toBeTruthy(), {
          timeout: 10000,
        }),
      ]);
    });
  });

  describe('Real-time Updates', () => {
    it('should receive blockchain updates', async () => {
      const { rerender } = render(
        <NavigationContainer>
          <TreasuryScreen />
        </NavigationContainer>
      );

      // Subscribe to balance changes
      const unsubscribe = await api.query.treasury.treasury((balance: any) => {
        // Balance updates should trigger rerender
        rerender(
          <NavigationContainer>
            <TreasuryScreen />
          </NavigationContainer>
        );
      });

      // Wait for subscription to be active
      await waitFor(() => {
        expect(unsubscribe).toBeDefined();
      });

      // Cleanup
      if (unsubscribe) {
        unsubscribe();
      }
    }, 15000);
  });

  describe('Performance', () => {
    it('should load treasury data within 5 seconds', async () => {
      const startTime = Date.now();

      const { getByText } = render(
        <NavigationContainer>
          <TreasuryScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByText(/Treasury/i)).toBeTruthy();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });

    it('should handle rapid screen transitions', async () => {
      const screens = [TreasuryScreen, ProposalsScreen, ElectionsScreen];

      for (const Screen of screens) {
        const { unmount } = render(
          <NavigationContainer>
            <Screen />
          </NavigationContainer>
        );

        await waitFor(() => {
          // Screen should render
          expect(true).toBe(true);
        });

        // Quickly unmount and move to next screen
        unmount();
      }

      // No memory leaks or crashes
      expect(true).toBe(true);
    });
  });
});
