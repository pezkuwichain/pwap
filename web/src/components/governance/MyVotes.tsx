import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Vote, FileText, Users, CheckCircle, XCircle, Clock, Activity, Loader2, Wallet } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { formatNumber } from '@/lib/utils';

interface ProposalVote {
  proposalId: number;
  proposalTitle: string;
  vote: 'Aye' | 'Nay' | 'Abstain';
  conviction: number;
  amount: string;
  votedAt: number;
  status: 'Active' | 'Approved' | 'Rejected' | 'Expired';
}

interface ElectionVote {
  electionId: number;
  electionType: string;
  candidates: string[];
  votedAt: number;
  status: 'Active' | 'Completed';
}

interface DelegationInfo {
  delegateAddress: string;
  amount: string;
  conviction: number;
  tracks: string[];
  status: 'active' | 'expired';
}

const MyVotes: React.FC = () => {
  const { api, isApiReady } = usePezkuwi();
  const { account, isConnected } = useWallet();
  const [proposalVotes, setProposalVotes] = useState<ProposalVote[]>([]);
  const [electionVotes, setElectionVotes] = useState<ElectionVote[]>([]);
  const [delegations, setDelegations] = useState<DelegationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatTokenAmount = (amount: string | number) => {
    const value = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
    return formatNumber(Number(value) / 1e12, 2);
  };

  useEffect(() => {
    if (!api || !isApiReady || !account) {
      setLoading(false);
      return;
    }

    const fetchUserVotes = async () => {
      try {
        setLoading(true);
        setError(null);

        const votes: ProposalVote[] = [];
        const elections: ElectionVote[] = [];
        const userDelegations: DelegationInfo[] = [];

        // Fetch democracy votes
        if (api.query.democracy?.votingOf) {
          const votingInfo = await api.query.democracy.votingOf(account);
          const data = votingInfo.toJSON() as Record<string, unknown>;

          if (data?.direct?.votes) {
            const directVotes = data.direct.votes as Array<[number, unknown]>;
            for (const [refIndex, voteData] of directVotes) {
              const voteInfo = voteData as Record<string, unknown>;
              votes.push({
                proposalId: refIndex,
                proposalTitle: `Referendum #${refIndex}`,
                vote: voteInfo.aye ? 'Aye' : 'Nay',
                conviction: (voteInfo.conviction as number) || 0,
                amount: (voteInfo.balance as string) || '0',
                votedAt: Date.now(),
                status: 'Active'
              });
            }
          }

          // Check for delegations
          if (data?.delegating) {
            const delegation = data.delegating as Record<string, unknown>;
            userDelegations.push({
              delegateAddress: delegation.target as string,
              amount: (delegation.balance as string) || '0',
              conviction: (delegation.conviction as number) || 0,
              tracks: ['All'],
              status: 'active'
            });
          }
        }

        // Fetch welati election votes
        if (api.query.welati?.nextElectionId) {
          const nextId = await api.query.welati.nextElectionId();
          const currentId = (nextId.toJSON() as number) || 0;

          for (let i = 0; i < currentId; i++) {
            const vote = await api.query.welati.electionVotes(i, account);
            if (vote.isSome) {
              const voteData = vote.unwrap().toJSON() as Record<string, unknown>;
              const election = await api.query.welati.activeElections(i);
              const electionData = election.isSome ? election.unwrap().toJSON() as Record<string, unknown> : null;

              elections.push({
                electionId: i,
                electionType: (electionData?.electionType as string) || 'Unknown',
                candidates: (voteData.candidates as string[]) || [],
                votedAt: (voteData.votedAt as number) || 0,
                status: electionData?.status === 'Completed' ? 'Completed' : 'Active'
              });
            }
          }
        }

        // Fetch welati proposal votes
        if (api.query.welati?.nextProposalId) {
          const nextId = await api.query.welati.nextProposalId();
          const currentId = (nextId.toJSON() as number) || 0;

          for (let i = Math.max(0, currentId - 50); i < currentId; i++) {
            const vote = await api.query.welati.collectiveVotes(i, account);
            if (vote.isSome) {
              const voteData = vote.unwrap().toJSON() as Record<string, unknown>;
              const proposal = await api.query.welati.activeProposals(i);
              const proposalData = proposal.isSome ? proposal.unwrap().toJSON() as Record<string, unknown> : null;

              votes.push({
                proposalId: i,
                proposalTitle: (proposalData?.title as string) || `Proposal #${i}`,
                vote: voteData.vote as 'Aye' | 'Nay' | 'Abstain',
                conviction: 1,
                amount: '0',
                votedAt: (voteData.votedAt as number) || 0,
                status: (proposalData?.status as 'Active' | 'Approved' | 'Rejected' | 'Expired') || 'Active'
              });
            }
          }
        }

        setProposalVotes(votes);
        setElectionVotes(elections);
        setDelegations(userDelegations);

      } catch (err) {
        console.error('Error fetching user votes:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch voting history');
      } finally {
        setLoading(false);
      }
    };

    fetchUserVotes();

    const interval = setInterval(fetchUserVotes, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady, account]);

  const getVoteIcon = (vote: string) => {
    switch (vote) {
      case 'Aye': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'Nay': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getVoteColor = (vote: string) => {
    switch (vote) {
      case 'Aye': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Nay': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-blue-500/20 text-blue-400';
      case 'Approved': return 'bg-green-500/20 text-green-400';
      case 'Rejected': return 'bg-red-500/20 text-red-400';
      case 'Completed': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!isConnected) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-400 mb-6">
              Connect your wallet to view your voting history and delegations
            </p>
            <Button className="bg-green-600 hover:bg-green-700">
              Connect Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-400">Loading your voting history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center text-red-400">
            <XCircle className="w-5 h-5 mr-2" />
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalVotes = proposalVotes.length + electionVotes.length;
  const activeVotes = proposalVotes.filter(v => v.status === 'Active').length +
    electionVotes.filter(v => v.status === 'Active').length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Vote className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-white">{totalVotes}</div>
                <div className="text-sm text-gray-400">Total Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-white">{activeVotes}</div>
                <div className="text-sm text-gray-400">Active Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold text-white">{proposalVotes.length}</div>
                <div className="text-sm text-gray-400">Proposal Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-500" />
              <div>
                <div className="text-2xl font-bold text-white">{electionVotes.length}</div>
                <div className="text-sm text-gray-400">Election Votes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Data Indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-green-500/10 border-green-500 text-green-400">
          <Activity className="h-3 w-3 mr-1" />
          Live Blockchain Data
        </Badge>
        <span className="text-sm text-gray-500">
          Connected as {account?.substring(0, 8)}...{account?.slice(-6)}
        </span>
      </div>

      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
          <TabsTrigger value="proposals">Proposal Votes</TabsTrigger>
          <TabsTrigger value="elections">Election Votes</TabsTrigger>
          <TabsTrigger value="delegations">My Delegations</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-4">
          {proposalVotes.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You have not voted on any proposals yet</p>
                <p className="text-sm mt-2">Check the Proposals tab to participate in governance</p>
              </CardContent>
            </Card>
          ) : (
            proposalVotes.map((vote) => (
              <Card key={vote.proposalId} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getVoteIcon(vote.vote)}
                      <div>
                        <h4 className="font-medium text-white">{vote.proposalTitle}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          Conviction: {vote.conviction}x •
                          Amount: {formatTokenAmount(vote.amount)} HEZ
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getVoteColor(vote.vote)}>
                        {vote.vote}
                      </Badge>
                      <Badge className={getStatusColor(vote.status)}>
                        {vote.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="elections" className="space-y-4">
          {electionVotes.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You have not voted in any elections yet</p>
                <p className="text-sm mt-2">Check the Elections tab to participate</p>
              </CardContent>
            </Card>
          ) : (
            electionVotes.map((vote) => (
              <Card key={vote.electionId} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">{vote.electionType} Election</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Election #{vote.electionId} •
                        {vote.candidates.length} candidate(s) selected
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {vote.candidates.map((candidate, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {candidate.substring(0, 8)}...
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge className={getStatusColor(vote.status)}>
                      {vote.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="delegations" className="space-y-4">
          {delegations.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You have not delegated your voting power</p>
                <p className="text-sm mt-2">Check the Delegation tab to delegate your votes</p>
              </CardContent>
            </Card>
          ) : (
            delegations.map((delegation, idx) => (
              <Card key={idx} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">
                        Delegated to {delegation.delegateAddress.substring(0, 8)}...{delegation.delegateAddress.slice(-6)}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Amount: {formatTokenAmount(delegation.amount)} HEZ •
                        Conviction: {delegation.conviction}x
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {delegation.tracks.map((track, tidx) => (
                          <Badge key={tidx} variant="secondary" className="text-xs">
                            {track}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={delegation.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'}>
                        {delegation.status}
                      </Badge>
                      <Button size="sm" variant="outline" className="text-xs">
                        Revoke
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyVotes;
