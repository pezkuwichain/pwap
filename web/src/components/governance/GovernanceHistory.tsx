import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Users, Trophy, CheckCircle, XCircle, Clock, Activity, Loader2, TrendingUp, Calendar } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import {
  getElectionResults,
  getGovernanceStats,
  blocksToTime,
  getCurrentBlock,
  type ElectionResult,
  type GovernanceMetrics
} from '@pezkuwi/lib/welati';

interface CompletedProposal {
  proposalId: number;
  title: string;
  proposer: string;
  status: 'Approved' | 'Rejected' | 'Expired';
  ayeVotes: number;
  nayVotes: number;
  finalizedAt: number;
  decisionType: string;
}

const GovernanceHistory: React.FC = () => {
  const { api, isApiReady } = usePezkuwi();
  const [completedElections, setCompletedElections] = useState<ElectionResult[]>([]);
  const [completedProposals, setCompletedProposals] = useState<CompletedProposal[]>([]);
  const [stats, setStats] = useState<GovernanceMetrics | null>(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !isApiReady) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current block
        const block = await getCurrentBlock(api);
        setCurrentBlock(block);

        // Get governance stats
        const governanceStats = await getGovernanceStats(api);
        setStats(governanceStats);

        // Get completed elections
        const elections: ElectionResult[] = [];
        if (api.query.welati?.nextElectionId) {
          const nextId = await api.query.welati.nextElectionId();
          const currentId = (nextId.toJSON() as number) || 0;

          for (let i = 0; i < currentId; i++) {
            const result = await getElectionResults(api, i);
            if (result && result.totalVotes > 0) {
              elections.push(result);
            }
          }
        }
        setCompletedElections(elections.reverse());

        // Get completed proposals
        const proposals: CompletedProposal[] = [];
        if (api.query.welati?.nextProposalId) {
          const nextId = await api.query.welati.nextProposalId();
          const currentId = (nextId.toJSON() as number) || 0;

          for (let i = Math.max(0, currentId - 100); i < currentId; i++) {
            const proposal = await api.query.welati.activeProposals(i);
            if (proposal.isSome) {
              const data = proposal.unwrap().toJSON() as Record<string, unknown>;
              if (data.status !== 'Active') {
                proposals.push({
                  proposalId: i,
                  title: (data.title as string) || `Proposal #${i}`,
                  proposer: (data.proposer as string) || 'Unknown',
                  status: data.status as 'Approved' | 'Rejected' | 'Expired',
                  ayeVotes: (data.ayeVotes as number) || 0,
                  nayVotes: (data.nayVotes as number) || 0,
                  finalizedAt: (data.expiresAt as number) || 0,
                  decisionType: (data.decisionType as string) || 'Unknown'
                });
              }
            }
          }
        }

        // Also check democracy referenda
        if (api.query.democracy?.referendumInfoOf) {
          const entries = await api.query.democracy.referendumInfoOf.entries();
          for (const [key, value] of entries) {
            const refIndex = key.args[0].toNumber();
            const info = value.toJSON() as Record<string, unknown>;

            if (info?.finished) {
              const finished = info.finished as Record<string, unknown>;
              proposals.push({
                proposalId: refIndex,
                title: `Democracy Referendum #${refIndex}`,
                proposer: 'Democracy',
                status: finished.approved ? 'Approved' : 'Rejected',
                ayeVotes: 0,
                nayVotes: 0,
                finalizedAt: (finished.end as number) || 0,
                decisionType: 'Democracy'
              });
            }
          }
        }

        setCompletedProposals(proposals.sort((a, b) => b.finalizedAt - a.finalizedAt));

      } catch (err) {
        console.error('Error fetching governance history:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    const interval = setInterval(fetchHistory, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [api, isApiReady]);

  const formatBlockTime = (blockNumber: number) => {
    if (!blockNumber || blockNumber === 0) return 'Unknown';
    const blocksAgo = currentBlock - blockNumber;
    if (blocksAgo < 0) return 'Future';
    const time = blocksToTime(blocksAgo);
    if (time.days > 0) return `${time.days}d ago`;
    if (time.hours > 0) return `${time.hours}h ago`;
    return `${time.minutes}m ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'Rejected': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-500/20 text-green-400';
      case 'Rejected': return 'bg-red-500/20 text-red-400';
      case 'Expired': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-400">Loading governance history...</span>
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

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalElectionsHeld}</div>
                  <div className="text-sm text-gray-400">Elections Held</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalProposalsSubmitted}</div>
                  <div className="text-sm text-gray-400">Total Proposals</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-cyan-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{stats.parliamentSize}</div>
                  <div className="text-sm text-gray-400">Parliament Size</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{stats.averageTurnout}%</div>
                  <div className="text-sm text-gray-400">Avg Turnout</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Data Indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-green-500/10 border-green-500 text-green-400">
          <Activity className="h-3 w-3 mr-1" />
          Live Blockchain Data
        </Badge>
        <span className="text-sm text-gray-500">Block #{currentBlock.toLocaleString()}</span>
      </div>

      <Tabs defaultValue="elections" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
          <TabsTrigger value="elections">Election History</TabsTrigger>
          <TabsTrigger value="proposals">Proposal History</TabsTrigger>
        </TabsList>

        <TabsContent value="elections" className="space-y-4">
          {completedElections.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed elections in history</p>
                <p className="text-sm mt-2">Election results will appear here once voting concludes</p>
              </CardContent>
            </Card>
          ) : (
            completedElections.map((election) => (
              <Card key={election.electionId} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-white flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        Election #{election.electionId}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Finalized {formatBlockTime(election.finalizedAt)}
                      </p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">
                      Completed
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Winner(s):</span>
                      <div className="mt-1 space-y-1">
                        {election.winners.length > 0 ? (
                          election.winners.map((winner, idx) => (
                            <Badge key={idx} variant="outline" className="mr-1 text-xs">
                              {winner.substring(0, 8)}...{winner.slice(-6)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-500">No winners</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400">Total Votes</div>
                      <div className="text-white font-medium">{election.totalVotes.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-sm">
                    <div>
                      <span className="text-gray-400">Turnout: </span>
                      <span className="text-white">{election.turnoutPercentage}%</span>
                    </div>
                    {election.runoffRequired && (
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        Runoff Required
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          {completedProposals.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed proposals in history</p>
                <p className="text-sm mt-2">Proposal outcomes will appear here once voting concludes</p>
              </CardContent>
            </Card>
          ) : (
            completedProposals.map((proposal) => (
              <Card key={proposal.proposalId} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(proposal.status)}
                      <div>
                        <h4 className="font-medium text-white">{proposal.title}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          Proposed by {proposal.proposer.substring(0, 8)}...
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-green-400">
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            {proposal.ayeVotes} Aye
                          </span>
                          <span className="text-red-400">
                            <XCircle className="w-3 h-3 inline mr-1" />
                            {proposal.nayVotes} Nay
                          </span>
                          <span className="text-gray-500">
                            {formatBlockTime(proposal.finalizedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusColor(proposal.status)}>
                        {proposal.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {proposal.decisionType}
                      </Badge>
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

export default GovernanceHistory;
