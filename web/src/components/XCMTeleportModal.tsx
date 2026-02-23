import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowDown, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TargetChain = 'asset-hub' | 'people';

interface ChainInfo {
  id: TargetChain;
  name: string;
  description: string;
  teyrchainId: number;
  color: string;
}

const TARGET_CHAINS: ChainInfo[] = [
  {
    id: 'asset-hub',
    name: 'Pezkuwi Asset Hub',
    description: 'For PEZ token transfers',
    teyrchainId: 1000,
    color: 'blue',
  },
  {
    id: 'people',
    name: 'Pezkuwi People',
    description: 'For identity & citizenship',
    teyrchainId: 1004,
    color: 'purple',
  },
];

interface XCMTeleportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const XCMTeleportModal: React.FC<XCMTeleportModalProps> = ({ isOpen, onClose }) => {
  const { api, assetHubApi, peopleApi, isApiReady, isAssetHubReady, isPeopleReady, selectedAccount } = usePezkuwi();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [targetChain, setTargetChain] = useState<TargetChain>('asset-hub');
  const [amount, setAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');
  const [relayBalance, setRelayBalance] = useState<string>('0');
  const [assetHubBalance, setAssetHubBalance] = useState<string>('0');
  const [peopleBalance, setPeopleBalance] = useState<string>('0');

  const selectedChain = TARGET_CHAINS.find(c => c.id === targetChain)!;
  const chainName = targetChain === 'asset-hub' ? t('xcm.assetHubName') : t('xcm.peopleName');
  const chainDesc = targetChain === 'asset-hub' ? t('xcm.assetHubDesc') : t('xcm.peopleDesc');

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!selectedAccount?.address) return;

      // Relay chain balance
      if (api && isApiReady) {
        try {
          const accountInfo = await api.query.system.account(selectedAccount.address) as { data: { free: { toString(): string } } };
          const free = accountInfo.data.free.toString();
          const balanceNum = Number(free) / 1e12;
          setRelayBalance(balanceNum.toFixed(4));
        } catch (err) {
          console.error('Error fetching relay balance:', err);
        }
      }

      // Asset Hub balance
      if (assetHubApi && isAssetHubReady) {
        try {
          const accountInfo = await assetHubApi.query.system.account(selectedAccount.address) as { data: { free: { toString(): string } } };
          const free = accountInfo.data.free.toString();
          const balanceNum = Number(free) / 1e12;
          setAssetHubBalance(balanceNum.toFixed(4));
        } catch (err) {
          console.error('Error fetching Asset Hub balance:', err);
        }
      }

      // People chain balance
      if (peopleApi && isPeopleReady) {
        try {
          const accountInfo = await peopleApi.query.system.account(selectedAccount.address) as { data: { free: { toString(): string } } };
          const free = accountInfo.data.free.toString();
          const balanceNum = Number(free) / 1e12;
          setPeopleBalance(balanceNum.toFixed(4));
        } catch (err) {
          console.error('Error fetching People chain balance:', err);
        }
      }
    };

    if (isOpen) {
      fetchBalances();
    }
  }, [api, assetHubApi, peopleApi, isApiReady, isAssetHubReady, isPeopleReady, selectedAccount, isOpen]);

  const getTargetBalance = () => {
    return targetChain === 'asset-hub' ? assetHubBalance : peopleBalance;
  };

  const handleTeleport = async () => {
    if (!api || !isApiReady || !selectedAccount) {
      toast({
        title: t('common.error'),
        description: t('xcm.walletNotConnected'),
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: t('common.error'),
        description: t('xcm.invalidAmount'),
        variant: "destructive",
      });
      return;
    }

    const sendAmount = parseFloat(amount);
    const currentBalance = parseFloat(relayBalance);

    if (sendAmount > currentBalance) {
      toast({
        title: t('common.error'),
        description: t('xcm.insufficientBalance'),
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    setTxStatus('signing');

    try {
      const { web3Enable, web3FromAddress } = await import('@pezkuwi/extension-dapp');
      await web3Enable('PezkuwiChain');
      const injector = await web3FromAddress(selectedAccount.address);

      // Convert to smallest unit (12 decimals)
      const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1e12));

      // Get target teyrchain ID
      const targetTeyrchainId = selectedChain.teyrchainId;

      // Destination: Target teyrchain
      const dest = {
        V3: {
          parents: 0,
          interior: {
            X1: { teyrchain: targetTeyrchainId }
          }
        }
      };

      // Beneficiary: Same account on target chain
      const beneficiary = {
        V3: {
          parents: 0,
          interior: {
            X1: {
              accountid32: {
                network: null,
                id: api.createType('AccountId32', selectedAccount.address).toHex()
              }
            }
          }
        }
      };

      // Assets: Native token (HEZ)
      const assets = {
        V3: [{
          id: {
            Concrete: {
              parents: 0,
              interior: 'Here'
            }
          },
          fun: {
            Fungible: amountInSmallestUnit.toString()
          }
        }]
      };

      // Fee asset ID: Native HEZ token (VersionedAssetId format)
      const feeAssetId = {
        V3: {
          Concrete: {
            parents: 0,
            interior: 'Here'
          }
        }
      };

      const weightLimit = 'Unlimited';

      // Create teleport transaction
      const tx = api.tx.xcmPallet.limitedTeleportAssets(
        dest,
        beneficiary,
        assets,
        feeAssetId,
        weightLimit
      );

      setTxStatus('pending');

      const unsub = await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log(`XCM Teleport in block: ${status.asInBlock}`);
            setTxHash(status.asInBlock.toHex());
          }

          if (status.isFinalized) {
            if (dispatchError) {
              let errorMessage = t('xcm.failed');

              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              }

              setTxStatus('error');
              toast({
                title: t('xcm.failed'),
                description: errorMessage,
                variant: "destructive",
              });
            } else {
              setTxStatus('success');
              toast({
                title: t('xcm.success'),
                description: t('xcm.sentTo', { amount, chain: chainName }),
              });

              // Reset after success
              setTimeout(() => {
                setAmount('');
                setTxStatus('idle');
                setTxHash('');
                onClose();
              }, 3000);
            }

            setIsTransferring(false);
            unsub();
          }
        }
      );
    } catch (error) {
      console.error('Teleport error:', error);
      setTxStatus('error');
      setIsTransferring(false);

      toast({
        title: t('xcm.failed'),
        description: error instanceof Error ? error.message : t('xcm.errorOccurred'),
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isTransferring) {
      setAmount('');
      setTxStatus('idle');
      setTxHash('');
      onClose();
    }
  };

  const setQuickAmount = (percent: number) => {
    const balance = parseFloat(relayBalance);
    if (balance > 0) {
      const quickAmount = (balance * percent / 100).toFixed(4);
      setAmount(quickAmount);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <img src="/tokens/HEZ.png" alt="HEZ" className="w-6 h-6 rounded-full" />
            {t('xcm.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('xcm.description')}
          </DialogDescription>
        </DialogHeader>

        {txStatus === 'success' ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('xcm.success')}</h3>
            <p className="text-gray-400 mb-4">{t('xcm.sentTo', { amount, chain: chainName })}</p>
            {txHash && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{t('xcm.txHash')}</div>
                <div className="text-white font-mono text-xs break-all">{txHash}</div>
              </div>
            )}
          </div>
        ) : txStatus === 'error' ? (
          <div className="py-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('xcm.failed')}</h3>
            <p className="text-gray-400">{t('xcm.pleaseTryAgain')}</p>
            <Button
              onClick={() => setTxStatus('idle')}
              className="mt-4 bg-gray-800 hover:bg-gray-700"
            >
              {t('xcm.tryAgain')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target Chain Selection */}
            <div>
              <Label className="text-white">{t('xcm.targetTeyrchain')}</Label>
              <Select value={targetChain} onValueChange={(v) => setTargetChain(v as TargetChain)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {TARGET_CHAINS.map((chain) => (
                    <SelectItem
                      key={chain.id}
                      value={chain.id}
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${chain.color}-500`}></div>
                        <span>{chain.id === 'asset-hub' ? t('xcm.assetHubName') : t('xcm.peopleName')}</span>
                        <span className="text-gray-400 text-xs">- {chain.id === 'asset-hub' ? t('xcm.assetHubDesc') : t('xcm.peopleDesc')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Balance Display */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-400">{t('xcm.relayChain')}</span>
                </div>
                <span className="text-white font-mono">{relayBalance} HEZ</span>
              </div>

              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-yellow-500" />
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-${selectedChain.color}-500`}></div>
                  <span className="text-sm text-gray-400">{chainName}</span>
                </div>
                <span className="text-white font-mono">{getTargetBalance()} HEZ</span>
              </div>
            </div>

            {/* Info Box */}
            <div className={`bg-${selectedChain.color}-500/10 border border-${selectedChain.color}-500/30 rounded-lg p-3 flex gap-2`}>
              <Info className={`w-5 h-5 text-${selectedChain.color}-400 flex-shrink-0 mt-0.5`} />
              <p className={`text-${selectedChain.color}-400 text-sm`}>
                {chainDesc}. {t('xcm.teleportMinHez')}
              </p>
            </div>

            {/* Amount Input */}
            <div>
              <Label htmlFor="amount" className="text-white">{t('xcm.amountHez')}</Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.1"
                className="bg-gray-800 border-gray-700 text-white mt-2"
                disabled={isTransferring}
              />

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mt-2">
                {[10, 25, 50, 100].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => setQuickAmount(percent)}
                    className="flex-1 py-1 px-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-700"
                    disabled={isTransferring}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>

            {/* Status Messages */}
            {txStatus === 'signing' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  {t('xcm.signTransaction')}
                </p>
              </div>
            )}

            {txStatus === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('xcm.inProgress')}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleTeleport}
              disabled={isTransferring || !amount || parseFloat(amount) <= 0}
              className="w-full bg-gradient-to-r from-green-600 to-yellow-400 hover:opacity-90"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {txStatus === 'signing' ? t('xcm.waitingSignature') : t('xcm.processingXcm')}
                </>
              ) : (
                <>
                  {t('xcm.teleportTo', { chain: chainName })}
                  <ArrowDown className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
