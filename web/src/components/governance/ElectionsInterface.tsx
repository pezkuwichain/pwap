import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Vote, Trophy, AlertCircle, CheckCircle, Users, Clock, Activity, Loader2 } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import {
  getActiveElections,
  getElectionCandidates,
  getElectionResults,
  hasVoted,
  blocksToTime,
  getCurrentBlock,
  getElectionTypeLabel,
  getElectionStatusLabel,
  type ElectionInfo,
  type CandidateInfo,
  type ElectionResult
} from '@pezkuwi/lib/welati';
import { toast } from 'sonner';

interface ElectionWithCandidates extends ElectionInfo {
  candidates: CandidateInfo[];
  userHasVoted: boolean;
}

const ElectionsInterface: React.FC = () => {
  const { api, isApiReady } = usePezkuwi();
  const { account, signer } = useWallet();
  const [elections, setElections] = useState<ElectionWithCandidates[]>([]);
  const [completedResults, setCompletedResults] = useState<ElectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [votingElectionId, setVotingElectionId] = useState<number | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Map<number, string[]>>(new Map());

  useEffect(() => {
    if (!api || !isApiReady) {
      setLoading(false);
      return;
    }

    const fetchElectionData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current block
        const block = await getCurrentBlock(api);
        setCurrentBlock(block);

        // Get active elections
        const activeElections = await getActiveElections(api);

        // Fetch candidates for each election
        const electionsWithCandidates: ElectionWithCandidates[] = await Promise.all(
          activeElections.map(async (election) => {
            const candidates = await getElectionCandidates(api, election.electionId);
            const userHasVoted = account
              ? await hasVoted(api, election.electionId, account)
              : false;

            return {
              ...election,
              candidates,
              userHasVoted
            };
          })
        );

        setElections(electionsWithCandidates);

        // Get completed election results (last 5)
        const results: ElectionResult[] = [];
        for (let i = 0; i < 5; i++) {
          const result = await getElectionResults(api, i);
          if (result) {
            results.push(result);
          }
        }
        setCompletedResults(results);

      } catch (err) {
        console.error('Error fetching election data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch election data');
      } finally {
        setLoading(false);
      }
    };

    fetchElectionData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchElectionData, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady, account]);

  const handleVote = async (electionId: number, candidateAccount: string, electionType: string) => {
    if (!api || !account || !signer) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setVotingElectionId(electionId);

      // Handle multi-select for parliamentary elections
      if (electionType === 'Parliamentary') {
        const current = selectedCandidates.get(electionId) || [];
        const updated = current.includes(candidateAccount)
          ? current.filter(c => c !== candidateAccount)
          : [...current, candidateAccount];
        setSelectedCandidates(new Map(selectedCandidates.set(electionId, updated)));
        setVotingElectionId(null);
        return;
      }

      // Single vote for other elections
      const tx = api.tx.welati.vote(electionId, candidateAccount);

      await tx.signAndSend(account, { signer }, ({ status, dispatchError }) => {
        if (status.isInBlock) {
          toast.success('Vote submitted successfully!');
          setVotingElectionId(null);
        }
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            toast.error(`Vote failed: ${decoded.name}`);
          } else {
            toast.error(`Vote failed: ${dispatchError.toString()}`);
          }
          setVotingElectionId(null);
        }
      });
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to submit vote');
      setVotingElectionId(null);
    }
  };

  const submitParliamentaryVotes = async (electionId: number) => {
    if (!api || !account || !signer) {
      toast.error('Please connect your wallet first');
      return;
    }

    const candidates = selectedCandidates.get(electionId) || [];
    if (candidates.length === 0) {
      toast.error('Please select at least one candidate');
      return;
    }

    try {
      setVotingElectionId(electionId);

      const tx = api.tx.welati.voteMultiple(electionId, candidates);

      await tx.signAndSend(account, { signer }, ({ status, dispatchError }) => {
        if (status.isInBlock) {
          toast.success('Votes submitted successfully!');
          setSelectedCandidates(new Map(selectedCandidates.set(electionId, [])));
          setVotingElectionId(null);
        }
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            toast.error(`Vote failed: ${decoded.name}`);
          } else {
            toast.error(`Vote failed: ${dispatchError.toString()}`);
          }
          setVotingElectionId(null);
        }
      });
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to submit votes');
      setVotingElectionId(null);
    }
  };

  const formatRemainingTime = (endBlock: number) => {
    const remaining = endBlock - currentBlock;
    if (remaining <= 0) return 'Ended';
    const time = blocksToTime(remaining);
    if (time.days > 0) return `${time.days}d ${time.hours}h remaining`;
    if (time.hours > 0) return `${time.hours}h ${time.minutes}m remaining`;
    return `${time.minutes}m remaining`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VotingPeriod': return 'bg-green-500';
      case 'CampaignPeriod': return 'bg-blue-500';
      case 'CandidacyPeriod': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-400">Loading elections from blockchain...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            Error loading elections: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Data Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 border-green-500 text-green-400">
            <Activity className="h-3 w-3 mr-1" />
            Live Blockchain Data
          </Badge>
          <span className="text-sm text-gray-500">Block #{currentBlock.toLocaleString()}</span>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
          <TabsTrigger value="active">Active Elections</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {elections.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active elections at this time</p>
                <p className="text-sm mt-2">Check back later for upcoming elections</p>
              </CardContent>
            </Card>
          ) : (
            elections.map(election => (
              <Card key={election.electionId} className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-white">
                        {getElectionTypeLabel(election.electionType).en}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4" />
                        {election.status === 'VotingPeriod'
                          ? `${election.totalVotes.toLocaleString()} votes cast • ${formatRemainingTime(election.votingEndBlock)}`
                          : formatRemainingTime(election.candidacyEndBlock)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`${getStatusColor(election.status)} text-white`}>
                        {getElectionStatusLabel(election.status).en}
                      </Badge>
                      {election.userHasVoted && (
                        <Badge variant="outline" className="border-green-500 text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          You Voted
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {election.status === 'VotingPeriod' && (
                    <div className="space-y-4">
                      {election.candidates.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No candidates registered</p>
                      ) : (
                        <>
                          {election.candidates.map(candidate => {
                            const percentage = election.totalVotes > 0
                              ? (candidate.voteCount / election.totalVotes) * 100
                              : 0;
                            const isSelected = (selectedCandidates.get(election.electionId) || [])
                              .includes(candidate.account);

                            return (
                              <div key={candidate.account} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-white">
                                      {candidate.account.substring(0, 8)}...{candidate.account.slice(-6)}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {candidate.endorsersCount} endorsements
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-white">{percentage.toFixed(1)}%</p>
                                    <p className="text-sm text-gray-400">
                                      {candidate.voteCount.toLocaleString()} votes
                                    </p>
                                  </div>
                                </div>
                                <Progress value={percentage} className="h-2" />
                                {!election.userHasVoted && (
                                  <Button
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    onClick={() => handleVote(election.electionId, candidate.account, election.electionType)}
                                    disabled={votingElectionId === election.electionId}
                                    className="w-full"
                                  >
                                    {votingElectionId === election.electionId ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                      </>
                                    ) : isSelected ? (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Selected
                                      </>
                                    ) : (
                                      <>
                                        <Vote className="w-4 h-4 mr-2" />
                                        {election.electionType === 'Parliamentary' ? 'Select' : 'Vote'}
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            );
                          })}

                          {election.electionType === 'Parliamentary' && !election.userHasVoted && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                              <p className="text-sm text-gray-400 text-center mb-3">
                                Select multiple candidates for parliamentary election
                              </p>
                              <Button
                                onClick={() => submitParliamentaryVotes(election.electionId)}
                                disabled={votingElectionId === election.electionId ||
                                  (selectedCandidates.get(election.electionId) || []).length === 0}
                                className="w-full bg-green-600 hover:bg-green-700"
                              >
                                {votingElectionId === election.electionId ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting Votes...
                                  </>
                                ) : (
                                  <>
                                    <Vote className="w-4 h-4 mr-2" />
                                    Submit {(selectedCandidates.get(election.electionId) || []).length} Vote(s)
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {election.status === 'CandidacyPeriod' && (
                    <div className="text-center py-4">
                      <p className="text-gray-400 mb-4">
                        {election.totalCandidates} candidates registered so far
                      </p>
                      <Button variant="outline">
                        Register as Candidate
                      </Button>
                    </div>
                  )}

                  {election.status === 'CampaignPeriod' && (
                    <div className="text-center py-4 text-gray-400">
                      <p>{election.totalCandidates} candidates competing</p>
                      <p className="text-sm mt-2">Voting begins {formatRemainingTime(election.campaignEndBlock)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="register">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Candidate Registration</CardTitle>
              <CardDescription>
                Register as a candidate for upcoming elections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-400">
                      Requirements
                    </p>
                    <ul className="text-sm text-amber-300/80 mt-2 space-y-1">
                      <li>• Minimum Trust Score: 300 (Parliamentary) / 600 (Presidential)</li>
                      <li>• KYC Approved Status</li>
                      <li>• Endorsements: 10 (Parliamentary) / 50 (Presidential)</li>
                      <li>• Deposit: 1000 PEZ</li>
                    </ul>
                  </div>
                </div>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                Register as Candidate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Election Results</CardTitle>
              <CardDescription>Historical election outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {completedResults.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No completed elections yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedResults.map((result) => (
                    <div key={result.electionId} className="p-4 border border-gray-700 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium text-white">Election #{result.electionId}</p>
                          <p className="text-sm text-gray-400">
                            Finalized at block #{result.finalizedAt.toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-green-500 text-green-400">
                          <Trophy className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Winner(s)</span>
                          <span className="font-medium text-white">
                            {result.winners.length > 0
                              ? result.winners.map(w => `${w.substring(0, 8)}...`).join(', ')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Total Votes</span>
                          <span className="text-white">{result.totalVotes.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Turnout</span>
                          <span className="text-white">{result.turnoutPercentage}%</span>
                        </div>
                        {result.runoffRequired && (
                          <Badge className="bg-yellow-500/20 text-yellow-400">
                            Runoff Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ElectionsInterface;
