/**
 * ProposalsScreen Test Suite
 *
 * Tests for Proposals feature with real democracy pallet integration
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ProposalsScreen from '../ProposalsScreen';
import { usePezkuwi } from '../../../contexts/PezkuwiContext';

jest.mock('../../../contexts/PezkuwiContext');

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('ProposalsScreen', () => {
  const mockApi = {
    query: {
      democracy: {
        referendumInfoOf: {
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
    it('should fetch referenda on mount', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0x1234567890abcdef1234567890abcdef' },
                tally: {
                  ayes: { toString: () => '100000000000000' },
                  nays: { toString: () => '50000000000000' },
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(mockApi.query.democracy.referendumInfoOf.entries).toHaveBeenCalled();
        expect(getByText(/Referendum #0/)).toBeTruthy();
      });
    });

    it('should handle fetch errors', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockRejectedValue(
        new Error('Connection failed')
      );

      render(<ProposalsScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load proposals from blockchain'
        );
      });
    });

    it('should filter out non-ongoing proposals', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: false,
            }),
          },
        ],
      ]);

      const { queryByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(queryByText(/Referendum #0/)).toBeNull();
      });
    });
  });

  describe('UI Rendering', () => {
    it('should display referendum title', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 5 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '0' },
                  nays: { toString: () => '0' },
                },
                end: { toNumber: () => 2000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(getByText(/Referendum #5/)).toBeTruthy();
      });
    });

    it('should display vote counts', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '200000000000000' }, // 200 HEZ
                  nays: { toString: () => '100000000000000' }, // 100 HEZ
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(getByText(/200/)).toBeTruthy(); // Votes for
        expect(getByText(/100/)).toBeTruthy(); // Votes against
      });
    });

    it('should display empty state when no proposals', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(getByText(/No proposals found/)).toBeTruthy();
      });
    });
  });

  describe('Vote Percentage Calculation', () => {
    it('should calculate vote percentages correctly', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '750000000000000' }, // 75%
                  nays: { toString: () => '250000000000000' }, // 25%
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(getByText(/75%/)).toBeTruthy();
        expect(getByText(/25%/)).toBeTruthy();
      });
    });

    it('should handle zero votes', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '0' },
                  nays: { toString: () => '0' },
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getAllByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        const percentages = getAllByText(/0%/);
        expect(percentages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '100000000000000' },
                  nays: { toString: () => '50000000000000' },
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);
    });

    it('should show all proposals by default', async () => {
      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        expect(getByText(/Referendum #0/)).toBeTruthy();
      });
    });

    it('should filter by active status', async () => {
      const { getByText } = render(<ProposalsScreen />);

      await waitFor(() => {
        const activeTab = getByText('Active');
        fireEvent.press(activeTab);
      });

      await waitFor(() => {
        expect(getByText(/Referendum #0/)).toBeTruthy();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle proposal press', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '0' },
                  nays: { toString: () => '0' },
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(async () => {
        const proposal = getByText(/Referendum #0/);
        fireEvent.press(proposal);
      });

      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should handle vote button press', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([
        [
          { args: [{ toNumber: () => 0 }] },
          {
            unwrap: () => ({
              isOngoing: true,
              asOngoing: {
                proposalHash: { toString: () => '0xabcdef' },
                tally: {
                  ayes: { toString: () => '0' },
                  nays: { toString: () => '0' },
                },
                end: { toNumber: () => 1000 },
              },
            }),
          },
        ],
      ]);

      const { getByText } = render(<ProposalsScreen />);

      await waitFor(async () => {
        const voteButton = getByText('Vote Now');
        fireEvent.press(voteButton);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Cast Your Vote',
        expect.any(String),
        expect.any(Array)
      );
    });

    it('should have pull-to-refresh capability', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([]);

      const { UNSAFE_root } = render(<ProposalsScreen />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockApi.query.democracy.referendumInfoOf.entries).toHaveBeenCalled();
      });

      // Verify RefreshControl is present (pull-to-refresh enabled)
      const refreshControls = UNSAFE_root.findAllByType('RCTRefreshControl');
      expect(refreshControls.length).toBeGreaterThan(0);

      // Note: Refresh behavior is fully tested via auto-refresh test
      // which uses the same fetchProposals() function
    });
  });

  describe('Auto-refresh', () => {
    jest.useFakeTimers();

    it('should auto-refresh every 30 seconds', async () => {
      mockApi.query.democracy.referendumInfoOf.entries.mockResolvedValue([]);

      render(<ProposalsScreen />);

      await waitFor(() => {
        expect(mockApi.query.democracy.referendumInfoOf.entries).toHaveBeenCalledTimes(1);
      });

      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockApi.query.democracy.referendumInfoOf.entries).toHaveBeenCalledTimes(2);
      });
    });
  });
});
