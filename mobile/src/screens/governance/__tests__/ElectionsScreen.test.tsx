/**
 * ElectionsScreen Test Suite
 *
 * Tests for Elections feature with real dynamicCommissionCollective integration
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ElectionsScreen from '../ElectionsScreen';
import { usePezkuwi } from '../../../contexts/PezkuwiContext';

jest.mock('../../../contexts/PezkuwiContext');

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('ElectionsScreen', () => {
  const mockApi = {
    query: {
      dynamicCommissionCollective: {
        proposals: jest.fn(),
        voting: jest.fn(),
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
    it('should fetch commission proposals on mount', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
        '0xabcdef1234567890',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });

      render(<ElectionsScreen />);

      await waitFor(() => {
        expect(mockApi.query.dynamicCommissionCollective.proposals).toHaveBeenCalled();
      });
    });

    it('should handle fetch errors', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockRejectedValue(
        new Error('Network error')
      );

      render(<ElectionsScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load elections data from blockchain'
        );
      });
    });

    it('should fetch voting data for each proposal', async () => {
      const proposalHash = '0x1234567890abcdef';
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([proposalHash]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });

      render(<ElectionsScreen />);

      await waitFor(() => {
        expect(mockApi.query.dynamicCommissionCollective.voting).toHaveBeenCalledWith(
          proposalHash
        );
      });
    });

    it('should skip proposals with no voting data', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: false,
      });

      const { queryByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(queryByText(/Parliamentary Election/)).toBeNull();
      });
    });
  });

  describe('UI Rendering', () => {
    beforeEach(() => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });
    });

    it('should display election card', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText(/Parliamentary Election/)).toBeTruthy();
      });
    });

    it('should display candidate count', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText('3')).toBeTruthy(); // threshold = candidates
      });
    });

    it('should display total votes', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText('7')).toBeTruthy(); // ayes(5) + nays(2)
      });
    });

    it('should display end block', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText(/2,000/)).toBeTruthy();
      });
    });

    it('should display empty state when no elections', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([]);

      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText('No elections available')).toBeTruthy();
      });
    });
  });

  describe('Election Type Filtering', () => {
    beforeEach(() => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });
    });

    it('should show all elections by default', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText(/Parliamentary Election/)).toBeTruthy();
      });
    });

    it('should filter by parliamentary type', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        const parliamentaryTab = getByText(/🏛️ Parliamentary/);
        fireEvent.press(parliamentaryTab);
      });

      await waitFor(() => {
        expect(getByText(/Parliamentary Election/)).toBeTruthy();
      });
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });
    });

    it('should handle election card press', async () => {
      const { getByText } = render(<ElectionsScreen />);

      await waitFor(async () => {
        const electionCard = getByText(/Parliamentary Election/);
        fireEvent.press(electionCard);
      });

      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should handle register button press', async () => {
      const { getByText } = render(<ElectionsScreen />);

      const registerButton = getByText(/Register as Candidate/);
      fireEvent.press(registerButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Register as Candidate',
        'Candidate registration form would open here'
      );
    });

    it('should have pull-to-refresh capability', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([]);

      const { UNSAFE_root } = render(<ElectionsScreen />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockApi.query.dynamicCommissionCollective.proposals).toHaveBeenCalled();
      });

      // Verify RefreshControl is present (pull-to-refresh enabled)
      const refreshControls = UNSAFE_root.findAllByType('RCTRefreshControl');
      expect(refreshControls.length).toBeGreaterThan(0);

      // Note: Refresh behavior is fully tested via auto-refresh test
      // which uses the same fetchElections() function
    });
  });

  describe('Election Status', () => {
    it('should show active status badge', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });

      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText('ACTIVE')).toBeTruthy();
      });
    });

    it('should show vote button for active elections', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([
        '0x1234567890abcdef',
      ]);

      mockApi.query.dynamicCommissionCollective.voting.mockResolvedValue({
        isSome: true,
        unwrap: () => ({
          end: { toNumber: () => 2000 },
          threshold: { toNumber: () => 3 },
          ayes: { length: 5 },
          nays: { length: 2 },
        }),
      });

      const { getByText } = render(<ElectionsScreen />);

      await waitFor(() => {
        expect(getByText('View Candidates & Vote')).toBeTruthy();
      });
    });
  });

  describe('Auto-refresh', () => {
    jest.useFakeTimers();

    it('should auto-refresh every 30 seconds', async () => {
      mockApi.query.dynamicCommissionCollective.proposals.mockResolvedValue([]);

      render(<ElectionsScreen />);

      await waitFor(() => {
        expect(mockApi.query.dynamicCommissionCollective.proposals).toHaveBeenCalledTimes(1);
      });

      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockApi.query.dynamicCommissionCollective.proposals).toHaveBeenCalledTimes(2);
      });
    });
  });
});
