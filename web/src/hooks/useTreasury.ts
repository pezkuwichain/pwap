import { useState, useEffect } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';

export interface TreasuryMetrics {
  totalBalance: number;
  pezBalance: number;
  hezBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingProposals: number;
  approvedBudget: number;
  healthScore: number;
}

export interface TreasuryProposal {
  id: string;
  index: number;
  proposer: string;
  beneficiary: string;
  value: string;
  bond: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function useTreasury() {
  const { api, assetHubApi, isConnected, isAssetHubReady } = usePezkuwi();
  const [metrics, setMetrics] = useState<TreasuryMetrics>({
    totalBalance: 0,
    pezBalance: 0,
    hezBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    pendingProposals: 0,
    approvedBudget: 0,
    healthScore: 0
  });
  const [proposals, setProposals] = useState<TreasuryProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !isConnected) {
      setLoading(false);
      return;
    }

    const fetchTreasuryData = async () => {
      try {
        setLoading(true);
        setError(null);

        const TREASURY_ACCOUNT = '5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z'; // py/trsry

        // Get HEZ balance from Relay Chain treasury account
        let hezBalance = 0;
        try {
          const rcAccount = await api.query.system.account(TREASURY_ACCOUNT);
          hezBalance = parseInt(rcAccount.data.free.toString()) / 1e12;
        } catch {
          if (import.meta.env.DEV) console.warn('Failed to fetch RC treasury HEZ balance');
        }

        // Get PEZ balance from Asset Hub (asset ID 1)
        let pezBalance = 0;
        try {
          if (isAssetHubReady && assetHubApi?.query.assets) {
            const pezAccount = await assetHubApi.query.assets.account(1, TREASURY_ACCOUNT);
            if (pezAccount && !pezAccount.isEmpty) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const unwrapped = (pezAccount as any).unwrap?.() ? (pezAccount as any).unwrap() : pezAccount;
              pezBalance = parseInt(unwrapped.balance?.toString() || '0') / 1e12;
            }
          }
        } catch {
          if (import.meta.env.DEV) console.warn('Failed to fetch AH treasury PEZ balance');
        }

        const totalBalance = hezBalance + pezBalance;

        // Fetch all treasury proposals
        const proposalsData = await api.query.treasury?.proposals?.entries();
        const proposalsList: TreasuryProposal[] = [];
        let approvedBudget = 0;
        let pendingCount = 0;

        if (proposalsData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proposalsData.forEach(([key, value]: [any, any]) => {
            const index = key.args[0].toNumber();
            const proposal = value.unwrap();
            const valueAmount = parseInt(proposal.value.toString()) / 1e12;

            const proposalItem: TreasuryProposal = {
              id: `treasury-${index}`,
              index,
              proposer: proposal.proposer.toString(),
              beneficiary: proposal.beneficiary.toString(),
              value: proposal.value.toString(),
              bond: proposal.bond.toString(),
              status: 'pending'
            };

            proposalsList.push(proposalItem);
            pendingCount++;
            approvedBudget += valueAmount;
          });
        }

        // Calculate health score (simplified)
        const healthScore = Math.min(100, Math.round((totalBalance / (approvedBudget || 1)) * 100));

        setMetrics({
          totalBalance,
          pezBalance,
          hezBalance,
          monthlyIncome: 0, // This would require historical data
          monthlyExpenses: 0, // This would require historical data
          pendingProposals: pendingCount,
          approvedBudget,
          healthScore: isNaN(healthScore) ? 0 : healthScore
        });

        setProposals(proposalsList);

      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching treasury data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch treasury data');
      } finally {
        setLoading(false);
      }
    };

    fetchTreasuryData();

    // Subscribe to updates
    const interval = setInterval(fetchTreasuryData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [api, assetHubApi, isConnected, isAssetHubReady]);

  return {
    metrics,
    proposals,
    loading,
    error
  };
}
