import { useTranslation } from 'react-i18next';
import { Clock, Users, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { useGovernance } from '@/hooks/useGovernance';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@pezkuwi/components/AsyncComponent';

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  type: 'treasury' | 'executive' | 'constitutional' | 'simple';
  status: 'active' | 'passed' | 'rejected' | 'pending';
  ayeVotes: number;
  nayVotes: number;
  totalVotes: number;
  quorum: number;
  deadline: string;
  requestedAmount?: string;
}

const ProposalsList: React.FC = () => {
  const { t } = useTranslation();
  const { proposals: treasuryProposals, referenda, loading, error } = useGovernance();

  // Format token amounts from blockchain units (12 decimals for HEZ)
  const formatTokenAmount = (amount: string) => {
    const value = BigInt(amount);
    return formatNumber(Number(value) / 1e12, 2);
  };

  // Convert blockchain data to UI format
  const proposals: Proposal[] = [
    // Treasury proposals
    ...treasuryProposals.map(p => ({
      id: p.proposalIndex,
      title: t('proposals.treasuryProposal', { id: p.proposalIndex }),
      description: t('proposals.treasuryDescription', { amount: formatTokenAmount(p.value), beneficiary: `${p.beneficiary.substring(0, 10)}...` }),
      proposer: p.proposer,
      type: 'treasury' as const,
      status: p.status as 'active' | 'passed' | 'rejected' | 'pending',
      ayeVotes: 0, // Treasury proposals don&apos;t have votes until they become referenda
      nayVotes: 0,
      totalVotes: 0,
      quorum: 0,
      deadline: t('proposals.pendingReferendum'),
      requestedAmount: `${formatTokenAmount(p.value)} HEZ`
    })),
    // Democracy referenda
    ...referenda.map(r => ({
      id: r.index,
      title: t('proposals.referendum', { id: r.index }),
      description: t('proposals.referendumDescription', { threshold: r.threshold }),
      proposer: 'Democracy',
      type: 'executive' as const,
      status: r.status as 'active' | 'passed' | 'rejected' | 'pending',
      ayeVotes: Number(BigInt(r.ayeVotes) / BigInt(1e12)),
      nayVotes: Number(BigInt(r.nayVotes) / BigInt(1e12)),
      totalVotes: Number((BigInt(r.ayeVotes) + BigInt(r.nayVotes)) / BigInt(1e12)),
      quorum: 50,
      deadline: `Block ${r.end}`,
    }))
  ];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge className="bg-blue-500/10 text-blue-400">{t('governance.status.active')}</Badge>;
      case 'passed': return <Badge className="bg-green-500/10 text-green-400">{t('governance.status.passed')}</Badge>;
      case 'rejected': return <Badge className="bg-red-500/10 text-red-400">{t('governance.status.rejected')}</Badge>;
      default: return <Badge className="bg-gray-500/10 text-gray-400">{t('governance.status.pending')}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'treasury': return <Badge className="bg-yellow-500/10 text-yellow-400">{t('proposals.type.treasury')}</Badge>;
      case 'executive': return <Badge className="bg-kurdish-red/10 text-kurdish-red">{t('proposals.type.executive')}</Badge>;
      case 'constitutional': return <Badge className="bg-cyan-500/10 text-cyan-400">{t('proposals.type.constitutional')}</Badge>;
      default: return <Badge className="bg-gray-500/10 text-gray-400">{t('proposals.type.simple')}</Badge>;
    }
  };

  if (loading) {
    return <LoadingState message={t('proposals.loading')} />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('proposals.loadError', { error })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Data Badge */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <Activity className="h-3 w-3 mr-1" />
          {t('proposals.liveData')}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('proposals.count', { count: proposals.length })}
        </span>
      </div>

      {proposals.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6 text-center text-gray-500">
            {t('proposals.noProposals')}
          </CardContent>
        </Card>
      ) : (
        proposals.map((proposal) => {
        const ayePercentage = (proposal.ayeVotes / proposal.totalVotes) * 100;
        const nayPercentage = (proposal.nayVotes / proposal.totalVotes) * 100;
        const quorumReached = (proposal.totalVotes / 300) * 100 >= proposal.quorum;

        return (
          <Card key={proposal.id} className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">#{proposal.id}</span>
                    {getTypeBadge(proposal.type)}
                    {getStatusBadge(proposal.status)}
                  </div>
                  <CardTitle className="text-white text-lg">{proposal.title}</CardTitle>
                  <p className="text-gray-400 text-sm">{proposal.description}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-gray-400 text-sm">
                    <Clock className="w-4 h-4 mr-1" />
                    {proposal.deadline}
                  </div>
                  {proposal.requestedAmount && (
                    <div className="mt-2 text-yellow-400 font-semibold">
                      {proposal.requestedAmount}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{t('proposals.votingProgress')}</span>
                  <span className="text-white">{t('proposals.votes', { count: proposal.totalVotes })}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-400 text-xs w-12">{t('proposals.aye')}</span>
                    <Progress value={ayePercentage} className="flex-1 h-2" />
                    <span className="text-white text-sm w-12 text-right">{ayePercentage.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-red-400 text-xs w-12">{t('proposals.nay')}</span>
                    <Progress value={nayPercentage} className="flex-1 h-2" />
                    <span className="text-white text-sm w-12 text-right">{nayPercentage.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1 text-gray-400" />
                    <span className="text-gray-400">{t('proposals.proposer', { address: proposal.proposer })}</span>
                  </div>
                  <div className="flex items-center">
                    {quorumReached ? (
                      <span className="text-green-400">&#10003; {t('proposals.quorumReached')}</span>
                    ) : (
                      <span className="text-yellow-400">&#9888; {t('proposals.quorum', { percent: proposal.quorum })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" className="border-gray-700">
                    {t('proposals.viewDetails')}
                  </Button>
                  <Button size="sm" className="bg-kurdish-green hover:bg-kurdish-green/80">
                    {t('proposals.castVote')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })
      )}
    </div>
  );
};

export default ProposalsList;