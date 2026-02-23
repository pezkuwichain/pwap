import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Loader2, Plus, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { COMMISSIONS } from '@/config/commissions';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function CommissionSetupTab() {
  const { t } = useTranslation();
  const { api, isApiReady, selectedAccount } = usePezkuwi();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [commissionMembers, setCommissionMembers] = useState<string[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState('');

  useEffect(() => {
    if (!api || !isApiReady) return;
    checkSetup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady]);
     

  const checkSetup = async () => {
    if (!api) return;

    setLoading(true);
    try {
      // Check DynamicCommissionCollective members
      const members = await api.query.dynamicCommissionCollective.members();
      const memberList = members.toJSON() as string[];

      setCommissionMembers(memberList);
      // Commission is initialized if there&apos;s at least one member
      setSetupComplete(memberList.length > 0);

      if (import.meta.env.DEV) console.log('Commission members:', memberList);
      if (import.meta.env.DEV) console.log('Setup complete:', memberList.length > 0);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error checking setup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!api || !selectedAccount) {
      toast({
        title: t('commission.setup.walletNotConnected'),
        description: t('commission.setup.connectWallet'),
        variant: 'destructive',
      });
      return;
    }

    if (!newMemberAddress) {
      toast({
        title: t('commission.setup.noAddresses'),
        description: t('commission.setup.enterAtLeastOne'),
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { web3Enable, web3FromAddress } = await import('@pezkuwi/extension-dapp');
      await web3Enable('PezkuwiChain');
      const injector = await web3FromAddress(selectedAccount.address);

      // Parse addresses (one per line, trim whitespace)
      const newAddresses = newMemberAddress
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      if (newAddresses.length === 0) {
        toast({
          title: t('commission.setup.noValidAddresses'),
          description: t('commission.setup.enterValidAddress'),
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      // Get current members
      const currentMembers = await api.query.dynamicCommissionCollective.members();
      const memberList = (currentMembers.toJSON() as string[]) || [];

      // Filter out already existing members
      const newMembers = newAddresses.filter(addr => !memberList.includes(addr));

      if (newMembers.length === 0) {
        toast({
          title: t('commission.setup.alreadyInitialized'),
          description: t('commission.setup.alreadyInitialized'),
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      // Add new members
      const updatedList = [...memberList, ...newMembers];

      if (import.meta.env.DEV) console.log('Adding new members:', newMembers);
      if (import.meta.env.DEV) console.log('Updated member list:', updatedList);

      const tx = api.tx.sudo.sudo(
        api.tx.dynamicCommissionCollective.setMembers(
          updatedList,
          null,
          updatedList.length
        )
      );

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) {
                let errorMessage = t('commission.setup.addMemberFailed');
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorMessage = `${decoded.section}.${decoded.name}`;
                }
                toast({
                  title: t('commission.setup.addMemberFailed'),
                  description: errorMessage,
                  variant: 'destructive',
                });
                reject(new Error(errorMessage));
              } else {
                toast({
                  title: t('commission.setup.addMemberSuccess', { count: newMembers.length }),
                });
                setNewMemberAddress('');
                setTimeout(() => checkSetup(), 2000);
                resolve();
              }
            }
          }
        );
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding member:', error);
      toast({
        title: t('commission.setup.addMemberFailed'),
        description: error instanceof Error ? error.message : t('commission.setup.addMemberFailed'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleInitializeCommission = async () => {
    if (!api || !selectedAccount) {
      toast({
        title: t('commission.setup.walletNotConnected'),
        description: t('commission.setup.connectWallet'),
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { web3Enable, web3FromAddress } = await import('@pezkuwi/extension-dapp');
      await web3Enable('PezkuwiChain');
      const injector = await web3FromAddress(selectedAccount.address);

      if (import.meta.env.DEV) console.log('Initializing KYC Commission...');
      if (import.meta.env.DEV) console.log('Proxy account:', COMMISSIONS.KYC.proxyAccount);

      // Initialize DynamicCommissionCollective with Alice as first member
      // Other members can be added later
      const tx = api.tx.sudo.sudo(
        api.tx.dynamicCommissionCollective.setMembers(
          [selectedAccount.address], // Add caller as first member
          null,
          1
        )
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

                if (import.meta.env.DEV) console.error('Setup error:', errorMessage);
                toast({
                  title: t('commission.setup.setupFailed'),
                  description: errorMessage,
                  variant: 'destructive',
                });
                reject(new Error(errorMessage));
                return;
              }

              // Check for Sudid event
              const sudidEvent = events.find(({ event }) =>
                event.section === 'sudo' && event.method === 'Sudid'
              );

              if (sudidEvent) {
                if (import.meta.env.DEV) console.log('✅ KYC Commission initialized');
                toast({
                  title: t('commission.setup.kycInitialized'),
                });
                resolve();
              } else {
                if (import.meta.env.DEV) console.warn('Transaction included but no Sudid event');
                resolve();
              }
            }
          }
        ).catch((error) => {
          if (import.meta.env.DEV) console.error('Failed to sign and send:', error);
          toast({
            title: t('commission.setup.transactionError'),
            description: error instanceof Error ? error.message : t('commission.setup.failedToSubmit'),
            variant: 'destructive',
          });
          reject(error);
        });
      });

      // Reload setup status
      setTimeout(() => checkSetup(), 2000);

    } catch (error) {
      if (import.meta.env.DEV) console.error('Error initializing commission:', error);
      toast({
        title: t('commission.setup.setupFailed'),
        description: error instanceof Error ? error.message : t('commission.setup.failedToInitialize'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!isApiReady) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            <span className="ml-3 text-gray-400">{t('commission.setup.connecting')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('commission.setup.connectWalletAlert')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('commission.setup.statusLabel')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div>
                  <p className="font-medium">{t('commission.setup.statusLabel')}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {setupComplete
                      ? t('commission.setup.initialized')
                      : t('commission.setup.notInitialized')}
                  </p>
                </div>
                {setupComplete ? (
                  <Badge className="bg-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {t('commission.setup.ready')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {t('commission.setup.notInitializedBadge')}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">{t('commission.setup.proxyAccount')}</p>
                <div className="p-3 bg-gray-800/50 rounded border border-gray-700">
                  <p className="font-mono text-xs">{COMMISSIONS.KYC.proxyAccount}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">
                  {t('commission.setup.membersLabel')} ({commissionMembers.length})
                </p>
                {commissionMembers.length === 0 ? (
                  <div className="p-4 bg-gray-800/50 rounded border border-gray-700 text-center text-gray-500">
                    {t('commission.setup.noMembers')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commissionMembers.map((member, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-800/50 rounded border border-gray-700"
                      >
                        <p className="font-mono text-xs">{member}</p>
                        {member === COMMISSIONS.KYC.proxyAccount && (
                          <Badge className="mt-2 bg-cyan-600 text-xs">{t('commission.setup.kycProxy')}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!setupComplete && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('commission.setup.initRequired')}
                  </AlertDescription>
                </Alert>
              )}

              {setupComplete && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-400">{t('commission.setup.addMembersTitle')}</p>
                  <div className="flex gap-2 mb-2">
                    <Button
                      onClick={() => {
                        // Get wallet addresses from Pezkuwi.js extension
                        // For now, show instruction
                        toast({
                          title: t('commission.setup.getAddresses'),
                          description: t('commission.setup.getAddressesToast'),
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      {t('commission.setup.howToGetAddresses')}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <textarea
                      placeholder={t('commission.setup.addressPlaceholder')}
                      value={newMemberAddress}
                      onChange={(e) => setNewMemberAddress(e.target.value)}
                      className="flex-1 font-mono text-sm p-3 bg-gray-800 border border-gray-700 rounded min-h-[120px] placeholder:text-gray-500 placeholder:opacity-50"
                    />
                    <Button
                      onClick={handleAddMember}
                      disabled={processing || !newMemberAddress}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {processing ? t('commission.setup.addingMembers') : t('commission.setup.addMembersBtn')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleInitializeCommission}
                  disabled={setupComplete || processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('commission.setup.initializing')}
                    </>
                  ) : setupComplete ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('commission.setup.alreadyInitialized')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('commission.setup.initializeBtn')}
                    </>
                  )}
                </Button>

                <Button
                  onClick={checkSetup}
                  variant="outline"
                  disabled={loading}
                >
                  {t('commission.setup.refresh')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('commission.setup.instructionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>{t('commission.setup.step1')}</li>
            <li>{t('commission.setup.step2')}</li>
            <li>{t('commission.setup.step3')}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
