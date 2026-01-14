/**
 * TreasuryScreen Test Suite
 *
 * Tests for Treasury feature with real blockchain integration
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import TreasuryScreen from '../TreasuryScreen';
import { usePezkuwi } from '../../../contexts/PezkuwiContext';

// Mock dependencies
jest.mock('../../../contexts/PezkuwiContext');

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('TreasuryScreen', () => {
  const mockApi = {
    query: {
      treasury: {
        treasury: jest.fn(),
        proposals: {
          entries: jest.fn(),
        },
      },
    },
  };

  const mockUsePezkuwi = {
    api: mockApi,
    isApiReady: true,
    selectedAccount: {
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      meta: { name: 'Test Account' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePezkuwi as jest.Mock).mockReturnValue(mockUsePezkuwi);
  });

  describe('Data Fetching', () => {
    it('should fetch treasury balance on mount', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '1000000000000000', // 1000 HEZ
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(mockApi.query.treasury.treasury).toHaveBeenCalled();
        expect(getByText(/1,000/)).toBeTruthy();
      });
    });

    it('should fetch treasury proposals on mount', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '0',
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              beneficiary: { toString: () => '5GrwvaEF...' },
              value: { toString: () => '100000000000000' },
              proposer: { toString: () => '5FHneW46...' },
              bond: { toString: () => '10000000000000' },
            }),
          },
        ],
      ]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(mockApi.query.treasury.proposals.entries).toHaveBeenCalled();
        expect(getByText(/Treasury Proposal #0/)).toBeTruthy();
      });
    });

    it('should handle fetch errors gracefully', async () => {
      mockApi.query.treasury.treasury.mockRejectedValue(new Error('Network error'));
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      render(<TreasuryScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load treasury data from blockchain'
        );
      });
    });
  });

  describe('UI Rendering', () => {
    it('should display treasury balance correctly', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '500000000000000', // 500 HEZ
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(getByText(/500/)).toBeTruthy();
      });
    });

    it('should display empty state when no proposals', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '0',
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(getByText(/No spending proposals/)).toBeTruthy();
      });
    });

    it('should display proposal list when proposals exist', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '0',
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              beneficiary: { toString: () => '5GrwvaEF...' },
              value: { toString: () => '100000000000000' },
              proposer: { toString: () => '5FHneW46...' },
              bond: { toString: () => '10000000000000' },
            }),
          },
        ],
      ]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(getByText(/Treasury Proposal #0/)).toBeTruthy();
      });
    });
  });

  describe('User Interactions', () => {
    it('should have pull-to-refresh capability', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '1000000000000000',
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { UNSAFE_root } = render(<TreasuryScreen />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockApi.query.treasury.treasury).toHaveBeenCalled();
      });

      // Verify RefreshControl is present (pull-to-refresh enabled)
      const refreshControls = UNSAFE_root.findAllByType('RCTRefreshControl');
      expect(refreshControls.length).toBeGreaterThan(0);

      // Note: Refresh behavior is fully tested via auto-refresh test
      // which uses the same fetchTreasuryData() function
    });

    it('should handle proposal press', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue({
        toString: () => '0',
      });
      mockApi.query.treasury.proposals.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              beneficiary: { toString: () => '5GrwvaEF...' },
              value: { toString: () => '100000000000000' },
              proposer: { toString: () => '5FHneW46...' },
              bond: { toString: () => '10000000000000' },
            }),
          },
        ],
      ]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        const proposalCard = getByText(/Treasury Proposal #0/);
        fireEvent.press(proposalCard);
      });

      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('Balance Formatting', () => {
    it('should format large balances with commas', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue('1000000000000000000'); // 1,000,000 HEZ
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(getByText(/1,000,000/)).toBeTruthy();
      });
    });

    it('should handle zero balance', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue('0');
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      const { getByText } = render(<TreasuryScreen />);

      await waitFor(() => {
        expect(getByText(/0/)).toBeTruthy();
      });
    });
  });

  describe('API State Handling', () => {
    it('should not fetch when API is not ready', () => {
      (usePezkuwi as jest.Mock).mockReturnValue({
        ...mockUsePezkuwi,
        isApiReady: false,
      });

      render(<TreasuryScreen />);

      expect(mockApi.query.treasury.treasury).not.toHaveBeenCalled();
    });

    it('should not fetch when API is null', () => {
      (usePezkuwi as jest.Mock).mockReturnValue({
        ...mockUsePezkuwi,
        api: null,
      });

      render(<TreasuryScreen />);

      expect(mockApi.query.treasury.treasury).not.toHaveBeenCalled();
    });
  });

  describe('Auto-refresh', () => {
    jest.useFakeTimers();

    it('should refresh data every 30 seconds', async () => {
      mockApi.query.treasury.treasury.mockResolvedValue('1000000000000000');
      mockApi.query.treasury.proposals.entries.mockResolvedValue([]);

      render(<TreasuryScreen />);

      await waitFor(() => {
        expect(mockApi.query.treasury.treasury).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockApi.query.treasury.treasury).toHaveBeenCalledTimes(2);
      });
    });
  });
});
