import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Loader2, ThumbsUp, ThumbsDown, Clock, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { COMMISSIONS } from '@/config/commissions';

interface Proposal {
  hash: string;
  proposalIndex: number;
  threshold: number;
  ayes: string[];
  nays: string[];
  end: number;
  call?: unknown;
}

export function CommissionVotingTab() {
  const { t } = useTranslation();
  const { api, isApiReady, selectedAccount } = usePezkuwi();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [voting, setVoting] = useState<string | null>(null);
  const [isCommissionMember, setIsCommissionMember] = useState(false);

  useEffect(() => {
    if (!api || !isApiReady) {
      return;
    }

    checkMembership();
    loadProposals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady, selectedAccount]);
     

  const checkMembership = async () => {
    if (!api || !selectedAccount) {
      if (import.meta.env.DEV) console.log('No API or selected account');
      setIsCommissionMember(false);
      return;
    }

    try {
      if (import.meta.env.DEV) console.log('Checking membership for:', selectedAccount.address);

      // Check if user is directly a member of DynamicCommissionCollective
      const members = await api.query.dynamicCommissionCollective.members();
      const memberList = members.toJSON() as string[];
      if (import.meta.env.DEV) console.log('Commission members:', memberList);

      const isMember = memberList.includes(selectedAccount.address);
      if (import.meta.env.DEV) console.log('Is commission member:', isMember);

      setIsCommissionMember(isMember);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error checking membership:', error);
      setIsCommissionMember(false);
    }
  };

  const loadProposals = async () => {
    if (!api || !isApiReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get all active proposal hashes
      const proposalHashes = await api.query.dynamicCommissionCollective.proposals();

      const proposalList: Proposal[] = [];

      for (let i = 0; i < proposalHashes.length; i++) {
        const hash = proposalHashes[i];

        // Get voting info for this proposal
        const voting = await api.query.dynamicCommissionCollective.voting(hash);

        if (!voting.isEmpty) {
          const voteData = voting.unwrap();

          // Get proposal details
          const proposalOption = await api.query.dynamicCommissionCollective.proposalOf(hash);
          let proposalCall = null;

          if (!proposalOption.isEmpty) {
            proposalCall = proposalOption.unwrap();
          }

          // Get the actual proposal index from the chain
          const proposalIndex = (voteData as Record<string, unknown>).index?.toNumber() || i;

          proposalList.push({
            hash: hash.toHex(),
            proposalIndex: proposalIndex,
            threshold: voteData.threshold.toNumber(),
            ayes: voteData.ayes.map((a: { toString: () => string }) => a.toString()),
            nays: voteData.nays.map((n: { toString: () => string }) => n.toString()),
            end: voteData.end.toNumber(),
            call: proposalCall?.toHuman(),
          });
        }
      }

      setProposals(proposalList);
      if (import.meta.env.DEV) console.log(`Loaded ${proposalList.length} active proposals`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading proposals:', error);
      toast({
        title: t('commission.voting.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposal: Proposal, approve: boolean) => {
    if (!api || !selectedAccount) {
      toast({
        title: t('commission.voting.walletNotConnected'),
        description: t('commission.voting.connectFirst'),
        variant: 'destructive',
      });
      return;
    }

    if (!isCommissionMember) {
      toast({
        title: t('commission.voting.notMemberTitle'),
        variant: 'destructive',
      });
      return;
    }

    setVoting(proposal.hash);
    try {
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      if (import.meta.env.DEV) console.log(`Voting ${approve ? 'AYE' : 'NAY'} on proposal:`, proposal.hash);

      // Vote directly (no proxy needed)
      const tx = api.tx.dynamicCommissionCollective.vote(
        proposal.hash,
        proposal.proposalIndex,
        approve
      );

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          ({ status, dispatchError, events }) => {
            if (import.meta.env.DEV) console.log('Transaction status:', status.type);

            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) {
                let errorMessage = 'Transaction failed';

                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                } else {
                  errorMessage = dispatchError.toString();
                }

                if (import.meta.env.DEV) console.error('Vote error:', errorMessage);
                toast({
                  title: t('commission.voting.voteFailed'),
                  description: errorMessage,
                  variant: 'destructive',
                });
                reject(new Error(errorMessage));
                return;
              }

              // Check for Voted event
              const votedEvent = events.find(({ event }) =>
                event.section === 'dynamicCommissionCollective' && event.method === 'Voted'
              );

              // Check for Executed event (threshold reached)
              const executedEvent = events.find(({ event }) =>
                event.section === 'dynamicCommissionCollective' && event.method === 'Executed'
              );

              if (executedEvent) {
                if (import.meta.env.DEV) console.log('✅ Proposal executed (threshold reached)');
                toast({
                  title: t('commission.voting.proposalPassed'),
                  description: t('commission.voting.kycApproved'),
                });
              } else if (votedEvent) {
                if (import.meta.env.DEV) console.log('✅ Vote recorded');
                toast({
                  title: t('commission.voting.voteRecorded'),
                  description: approve ? t('commission.voting.ayeRecorded') : t('commission.voting.nayRecorded'),
                });
              }

              resolve();
            }
          }
        ).catch((error) => {
          if (import.meta.env.DEV) console.error('Failed to sign and send:', error);
          toast({
            title: t('commission.voting.submitFailed'),
            description: error instanceof Error ? error.message : t('commission.voting.submitFailed'),
            variant: 'destructive',
          });
          reject(error);
        });
      });

      // Reload proposals after voting
      setTimeout(() => {
        loadProposals();
      }, 2000);

    } catch (error) {
      if (import.meta.env.DEV) console.error('Error voting:', error);
      toast({
        title: t('commission.voting.voteFailed'),
        description: error instanceof Error ? error.message : t('commission.voting.voteFailed'),
        variant: 'destructive',
      });
    } finally {
      setVoting(null);
    }
  };

  const handleExecute = async (proposal: Proposal) => {
    if (!api || !selectedAccount) {
      toast({
        title: t('commission.voting.walletNotConnected'),
        description: t('commission.voting.connectFirst'),
        variant: 'destructive',
      });
      return;
    }

    setVoting(proposal.hash);
    try {
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      if (import.meta.env.DEV) console.log('Executing proposal:', proposal.hash);

      // Get proposal length bound
      const proposalOption = await api.query.dynamicCommissionCollective.proposalOf(proposal.hash);
      const proposalCall = proposalOption.unwrap();
      const lengthBound = proposalCall.encodedLength;

      const tx = api.tx.dynamicCommissionCollective.close(
        proposal.hash,
        proposal.proposalIndex,
        {
          refTime: 1_000_000_000_000, // 1 trillion for ref time
          proofSize: 64 * 1024, // 64 KB for proof size
        },
        lengthBound
      );

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          ({ status, dispatchError, events }) => {
            if (import.meta.env.DEV) console.log('Transaction status:', status.type);

            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) {
                let errorMessage = 'Transaction failed';

                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                } else {
                  errorMessage = dispatchError.toString();
                }

                if (import.meta.env.DEV) console.error('Execute error:', errorMessage);
                toast({
                  title: t('commission.voting.executeFailed'),
                  description: errorMessage,
                  variant: 'destructive',
                });
                reject(new Error(errorMessage));
                return;
              }

              const executedEvent = events.find(({ event }) =>
                event.section === 'dynamicCommissionCollective' && event.method === 'Executed'
              );

              const closedEvent = events.find(({ event }) =>
                event.section === 'dynamicCommissionCollective' && event.method === 'Closed'
              );

              if (executedEvent) {
                const eventData = executedEvent.event.data.toHuman();
                if (import.meta.env.DEV) console.log('✅ Proposal executed');
                if (import.meta.env.DEV) console.log('Execute event data:', eventData);
                if (import.meta.env.DEV) console.log('Result:', eventData);

                // Check if execution was successful
                const result = eventData[eventData.length - 1]; // Last parameter is usually the result
                if (result && typeof result === 'object' && 'Err' in result) {
                  if (import.meta.env.DEV) console.error('Execution failed:', result.Err);
                  toast({
                    title: t('commission.voting.executeFailed'),
                    description: JSON.stringify(result.Err),
                    variant: 'destructive',
                  });
                } else {
                  toast({
                    title: t('commission.voting.executeSuccess'),
                    description: t('commission.voting.kycApproved'),
                  });
                }
              } else if (closedEvent) {
                if (import.meta.env.DEV) console.log('Proposal closed');
                toast({
                  title: t('commission.voting.proposalClosed'),
                  description: t('commission.voting.proposalClosedDesc'),
                });
              }

              resolve();
            }
          }
        ).catch((error) => {
          if (import.meta.env.DEV) console.error('Failed to sign and send:', error);
          toast({
            title: t('commission.voting.submitFailed'),
            description: error instanceof Error ? error.message : t('commission.voting.submitFailed'),
            variant: 'destructive',
          });
          reject(error);
        });
      });

      setTimeout(() => {
        loadProposals();
      }, 2000);

    } catch (error) {
      if (import.meta.env.DEV) console.error('Error executing:', error);
      toast({
        title: t('commission.voting.executeFailed'),
        description: error instanceof Error ? error.message : t('commission.voting.executeFailed'),
        variant: 'destructive',
      });
    } finally {
      setVoting(null);
    }
  };

  const getProposalDescription = (call: Record<string, unknown>): string => {
    if (!call) return t('commission.voting.unknownProposal');

    try {
      const callStr = JSON.stringify(call);
      if (callStr.includes('approveKyc')) {
        return t('commission.voting.kycApproval');
      }
      if (callStr.includes('rejectKyc')) {
        return t('commission.voting.kycRejection');
      }
      return t('commission.voting.commissionAction');
    } catch {
      return t('commission.voting.unknownProposal');
    }
  };

  const getStatusBadge = (proposal: Proposal) => {
    const progress = (proposal.ayes.length / proposal.threshold) * 100;

    if (proposal.ayes.length >= proposal.threshold) {
      return <Badge variant="default" className="bg-green-600">{t('commission.voting.statusPassed')}</Badge>;
    }
    if (progress >= 50) {
      return <Badge variant="default" className="bg-yellow-600">{t('commission.voting.statusVoting', { progress: progress.toFixed(0) })}</Badge>;
    }
    return <Badge variant="secondary">{t('commission.voting.statusVoting', { progress: progress.toFixed(0) })}</Badge>;
  };

  if (!isApiReady) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>{t('commission.voting.connecting')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <p>{t('commission.voting.noWallet')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isCommissionMember) {
    const handleJoinCommission = async () => {
      if (!api || !selectedAccount) return;

      try {
        const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
        const injector = await web3FromAddress(selectedAccount.address);

        // Get current members
        const currentMembers = await api.query.dynamicCommissionCollective.members();
        const memberList = (currentMembers.toJSON() as string[]) || [];

        // Add current user to members list
        if (!memberList.includes(selectedAccount.address)) {
          memberList.push(selectedAccount.address);
        }

        if (import.meta.env.DEV) console.log('Adding member to commission:', selectedAccount.address);
        if (import.meta.env.DEV) console.log('New member list:', memberList);

        // Use sudo to update members (requires sudo access)
        const tx = api.tx.sudo.sudo(
          api.tx.dynamicCommissionCollective.setMembers(
            memberList,
            null,
            memberList.length
          )
        );

        await tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) {
                let errorMessage = t('commission.voting.joinFailed');
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorMessage = `${decoded.section}.${decoded.name}`;
                }
                toast({
                  title: t('commission.voting.joinFailed'),
                  description: errorMessage,
                  variant: 'destructive',
                });
              } else {
                toast({
                  title: t('commission.voting.joinSuccess'),
                });
                setTimeout(() => checkMembership(), 2000);
              }
            }
          }
        );
      } catch (error) {
        toast({
          title: t('commission.voting.joinFailed'),
          description: error instanceof Error ? error.message : t('commission.voting.joinFailed'),
          variant: 'destructive',
        });
      }
    };

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t('commission.voting.notMember')}</p>
            <p className="text-sm text-muted-foreground mb-6">{t('commission.voting.onlyMembers')}</p>
            <Button
              onClick={handleJoinCommission}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('commission.voting.joinBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('commission.voting.title')}</h2>
          <p className="text-muted-foreground">
            {t('commission.voting.subtitle', { name: COMMISSIONS.KYC.name })}
          </p>
        </div>
        <Button
          onClick={loadProposals}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('commission.voting.refresh')}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>{t('commission.voting.loading')}</span>
            </div>
          </CardContent>
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('commission.voting.noProposals')}</p>
              <p className="text-sm mt-2">{t('commission.voting.noProposalsHelp')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('commission.voting.activeProposals', { count: proposals.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('commission.voting.tableProposal')}</TableHead>
                  <TableHead>{t('commission.voting.tableType')}</TableHead>
                  <TableHead>{t('commission.voting.tableStatus')}</TableHead>
                  <TableHead>{t('commission.voting.tableVotes')}</TableHead>
                  <TableHead className="text-right">{t('commission.voting.tableActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow key={proposal.hash}>
                    <TableCell className="font-mono text-sm">
                      #{proposal.proposalIndex}
                    </TableCell>
                    <TableCell>
                      {getProposalDescription(proposal.call)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(proposal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {proposal.ayes.length}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <ThumbsDown className="h-3 w-3" />
                          {proposal.nays.length}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          / {proposal.threshold}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {proposal.ayes.length >= proposal.threshold ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleExecute(proposal)}
                            disabled={voting === proposal.hash}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {voting === proposal.hash ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>{t('commission.voting.execute')}</>
                            )}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleVote(proposal, true)}
                              disabled={voting === proposal.hash}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {voting === proposal.hash ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ThumbsUp className="h-4 w-4 mr-1" />
                                  {t('commission.voting.aye')}
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleVote(proposal, false)}
                              disabled={voting === proposal.hash}
                            >
                              {voting === proposal.hash ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ThumbsDown className="h-4 w-4 mr-1" />
                                  {t('commission.voting.nay')}
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
