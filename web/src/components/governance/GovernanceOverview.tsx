import React, { useState, useEffect } from 'react';
import {
  Users, Gavel, FileText, TrendingUpIcon,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { formatBalance } from '@pezkuwi/lib/wallet';
import { LoadingState } from '@pezkuwi/components/AsyncComponent';
import { getActiveElections, getActiveProposals, getParliamentMembers, getDiwanMembers } from '@pezkuwi/lib/welati';

interface GovernanceStats {
  activeProposals: number;
  activeElections: number;
  totalVoters: number;
  participationRate: number;
  parliamentMembers: number;
  parliamentMax: number;
  diwanMembers: number;
  diwanMax: number;
  pendingVotes: number;
  diwanPendingReviews: number;
  relayTreasuryBalance: string;
  pezTreasuryBalance: string;
}

// Treasury addresses derived from PalletId
const RELAY_TREASURY = '5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z'; // py/trsry
const PEZ_TREASURY = '5EYCAe5iipewaoUvoNr8ttcKqj5czZPBvVAex6uWbT6HxQNU'; // pez/trea (Asset Hub)

const GovernanceOverview: React.FC = () => {
  const { api, isApiReady, assetHubApi, isAssetHubReady } = usePezkuwi();
  const [stats, setStats] = useState<GovernanceStats>({
    activeProposals: 0,
    activeElections: 0,
    totalVoters: 0,
    participationRate: 0,
    parliamentMembers: 0,
    parliamentMax: 201,
    diwanMembers: 0,
    diwanMax: 9,
    pendingVotes: 0,
    diwanPendingReviews: 0,
    relayTreasuryBalance: '0 HEZ',
    pezTreasuryBalance: '0 PEZ'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGovernanceData = async () => {
      if (!api || !isApiReady) {
        if (import.meta.env.DEV) console.log('API not ready for governance data');
        return;
      }

      try {
        if (import.meta.env.DEV) console.log('Fetching governance data from blockchain...');
        setLoading(true);

        // Fetch active proposals via welati
        let activeProposals = 0;
        let pendingVotes = 0;
        let diwanPendingReviews = 0;
        try {
          const proposals = await getActiveProposals(api);
          activeProposals = proposals.length;
          pendingVotes = proposals.length;
          diwanPendingReviews = proposals.filter(
            p => p.decisionType === 'ConstitutionalReview' || p.decisionType === 'ConstitutionalUnanimous'
          ).length;
          if (import.meta.env.DEV) console.log('Active proposals:', activeProposals);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch proposals:', err);
        }

        // Fetch active elections via welati
        let activeElections = 0;
        try {
          const elections = await getActiveElections(api);
          activeElections = elections.length;
          if (import.meta.env.DEV) console.log('Active elections:', activeElections);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch elections:', err);
        }

        // Fetch parliament members via welati
        let parliamentMembers = 0;
        try {
          const members = await getParliamentMembers(api);
          parliamentMembers = members.length;
          if (import.meta.env.DEV) console.log('Parliament members:', parliamentMembers);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch parliament members:', err);
        }

        // Fetch diwan members via welati
        let diwanMembers = 0;
        try {
          const members = await getDiwanMembers(api);
          diwanMembers = members.length;
          if (import.meta.env.DEV) console.log('Diwan members:', diwanMembers);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch diwan members:', err);
        }

        // Fetch Relay Chain treasury balance (native HEZ)
        let relayTreasuryBalance = '0 HEZ';
        try {
          const treasuryAccount = await api.query.system.account(RELAY_TREASURY);
          const balance = treasuryAccount.data.free.toString();
          relayTreasuryBalance = `${formatBalance(balance)} HEZ`;
          if (import.meta.env.DEV) console.log('Relay treasury balance:', relayTreasuryBalance);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch relay treasury balance:', err);
        }

        // Fetch PEZ Treasury balance (PEZ token, asset ID 1, on Asset Hub)
        let pezTreasuryBalance = '0 PEZ';
        try {
          if (assetHubApi && isAssetHubReady) {
            const pezBalance = await assetHubApi.query.assets.account(1, PEZ_TREASURY);
            if (pezBalance.isSome) {
              const balanceData = (pezBalance.unwrap() as unknown as { toJSON: () => Record<string, unknown> }).toJSON();
              const rawBalance = ((balanceData.balance ?? balanceData.free ?? '0') as string | number).toString();
              pezTreasuryBalance = `${formatBalance(rawBalance)} PEZ`;
            }
            if (import.meta.env.DEV) console.log('PEZ treasury balance:', pezTreasuryBalance);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch PEZ treasury balance:', err);
        }

        setStats({
          activeProposals,
          activeElections,
          totalVoters: 0,
          participationRate: 0,
          parliamentMembers,
          parliamentMax: 201,
          diwanMembers,
          diwanMax: 9,
          pendingVotes,
          diwanPendingReviews,
          relayTreasuryBalance,
          pezTreasuryBalance
        });

        if (import.meta.env.DEV) console.log('Governance data updated:', {
          activeProposals,
          activeElections,
          parliamentMembers,
          diwanMembers,
          relayTreasuryBalance,
          pezTreasuryBalance
        });
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch governance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGovernanceData();
  }, [api, isApiReady, assetHubApi, isAssetHubReady]);

  if (loading) {
    return <LoadingState message="Loading governance data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Proposals</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.activeProposals}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Elections</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.activeElections}</p>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Voters</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalVoters}</p>
              </div>
              <div className="p-3 bg-kurdish-green/10 rounded-lg">
                <TrendingUpIcon className="w-6 h-6 text-kurdish-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Treasury</p>
                <p className="text-lg font-bold text-white mt-1">{stats.pezTreasuryBalance}</p>
                <p className="text-sm text-gray-400 mt-1">{stats.relayTreasuryBalance}</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Government Bodies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Gavel className="w-5 h-5 mr-2 text-purple-400" />
              Parliament Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Active Members</span>
                <span className="text-white font-semibold">{stats.parliamentMembers}/{stats.parliamentMax}</span>
              </div>
              {stats.activeElections > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Elections</span>
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pending Votes</span>
                <span className="text-white font-semibold">{stats.pendingVotes}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-cyan-400" />
              Diwan (Constitutional Court)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Active Judges</span>
                <span className="text-white font-semibold">{stats.diwanMembers}/{stats.diwanMax}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pending Reviews</span>
                <span className="text-white font-semibold">{stats.diwanPendingReviews}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GovernanceOverview;
