import React, { useState } from 'react';
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
import { ArrowRight, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TokenBalance {
  assetId: number;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdValue: number;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset?: TokenBalance | null;
}

type TokenType = 'HEZ' | 'PEZ' | 'USDT' | 'BTC' | 'ETH' | 'DOT';

interface Token {
  symbol: TokenType;
  name: string;
  assetId?: number;
  decimals: number;
  color: string;
}

// Token logo mapping
const TOKEN_LOGOS: Record<string, string> = {
  HEZ: '/tokens/HEZ.png',
  PEZ: '/tokens/PEZ.png',
  USDT: '/tokens/USDT.png',
  BTC: '/tokens/BTC.png',
  ETH: '/tokens/ETH.png',
  DOT: '/tokens/DOT.png',
  BNB: '/tokens/BNB.png',
};

const TOKENS: Token[] = [
  { symbol: 'HEZ', name: 'Hez Token', decimals: 12, color: 'from-green-600 to-yellow-400' },
  { symbol: 'PEZ', name: 'Pez Token', assetId: 1, decimals: 12, color: 'from-blue-600 to-purple-400' },
  { symbol: 'USDT', name: 'Tether USD', assetId: 1000, decimals: 6, color: 'from-green-500 to-green-600' },
  { symbol: 'BTC', name: 'Bitcoin', assetId: 3, decimals: 8, color: 'from-orange-500 to-yellow-500' },
  { symbol: 'ETH', name: 'Ethereum', assetId: 4, decimals: 18, color: 'from-purple-500 to-blue-500' },
  { symbol: 'DOT', name: 'Polkadot', assetId: 5, decimals: 10, color: 'from-pink-500 to-red-500' },
];

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, selectedAsset }) => {
  const { api, assetHubApi, isApiReady, isAssetHubReady, selectedAccount } = usePezkuwi();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [selectedToken, setSelectedToken] = useState<TokenType>('HEZ');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');

  // Use the provided selectedAsset or fall back to token selection
  const currentToken = selectedAsset ? {
    symbol: selectedAsset.symbol as TokenType,
    name: selectedAsset.name,
    assetId: selectedAsset.assetId,
    decimals: selectedAsset.decimals,
    color: selectedAsset.assetId === 0 ? 'from-green-600 to-yellow-400' :
           selectedAsset.assetId === 1000 ? 'from-emerald-500 to-teal-500' :
           'from-cyan-500 to-blue-500',
  } : TOKENS.find(t => t.symbol === selectedToken) || TOKENS[0];

  const handleTransfer = async () => {
    if (!api || !isApiReady || !selectedAccount) {
      toast({
        title: t('transfer.error'),
        description: t('transfer.walletNotConnected'),
        variant: "destructive",
      });
      return;
    }

    // Check if Asset Hub transfer (PEZ, wUSDT, wHEZ are on Asset Hub)
    const isAssetHubTransfer = currentToken.symbol === 'PEZ' ||
                               currentToken.symbol === 'USDT' ||
                               currentToken.symbol === 'wUSDT' ||
                               currentToken.symbol === 'wHEZ' ||
                               currentToken.assetId === 1 ||    // PEZ
                               currentToken.assetId === 2 ||    // wHEZ
                               currentToken.assetId === 1000;   // wUSDT
    if (isAssetHubTransfer && (!assetHubApi || !isAssetHubReady)) {
      toast({
        title: t('transfer.error'),
        description: t('transfer.assetHubNotReady'),
        variant: "destructive",
      });
      return;
    }

    if (!recipient || !amount) {
      toast({
        title: t('transfer.error'),
        description: t('transfer.fillAllFields'),
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    setTxStatus('signing');

    try {
      // Import web3FromAddress to get the injector
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      // Convert amount to smallest unit
      const amountInSmallestUnit = BigInt(parseFloat(amount) * Math.pow(10, currentToken.decimals));

      let transfer;
      let targetApi = api; // Default to main chain API

      // Create appropriate transfer transaction based on token type
      // HEZ uses native token transfer (balances pallet on main chain)
      // PEZ, wHEZ, wUSDT use assets pallet on Asset Hub
      if (currentToken.assetId === undefined || (selectedToken === 'HEZ' && !selectedAsset)) {
        // Native HEZ token transfer on main chain
        transfer = api.tx.balances.transferKeepAlive(recipient, amountInSmallestUnit.toString());
      } else if (isAssetHubTransfer) {
        // Asset Hub transfer (PEZ, wHEZ, wUSDT)
        targetApi = assetHubApi!;
        transfer = assetHubApi!.tx.assets.transfer(currentToken.assetId, recipient, amountInSmallestUnit.toString());
      } else {
        // Other asset token transfers on main chain
        transfer = api.tx.assets.transfer(currentToken.assetId, recipient, amountInSmallestUnit.toString());
      }

      setTxStatus('pending');

      // Sign and send transaction
      const unsub = await transfer.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log(`Transaction included in block: ${status.asInBlock}`);
            setTxHash(status.asInBlock.toHex());
          }

          if (status.isFinalized) {
            if (import.meta.env.DEV) console.log(`Transaction finalized: ${status.asFinalized}`);
            
            // Check for errors
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              
              if (dispatchError.isModule) {
                const decoded = targetApi.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              }

              setTxStatus('error');
              toast({
                title: t('transfer.failed'),
                description: errorMessage,
                variant: "destructive",
              });
            } else {
              setTxStatus('success');
              toast({
                title: t('transfer.success'),
                description: t('transfer.sentAmount', { amount, token: currentToken.symbol, recipient: `${recipient.slice(0, 8)}...${recipient.slice(-6)}` }),
              });

              // Reset form after 2 seconds
              setTimeout(() => {
                setRecipient('');
                setAmount('');
                setTxStatus('idle');
                setTxHash('');
                onClose();
              }, 2000);
            }

            setIsTransferring(false);
            unsub();
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Transfer error:', error);
      setTxStatus('error');
      setIsTransferring(false);

      toast({
        title: t('transfer.failed'),
        description: error instanceof Error ? error.message : t('transfer.errorOccurred'),
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isTransferring) {
      setRecipient('');
      setAmount('');
      setTxStatus('idle');
      setTxHash('');
      setSelectedToken('HEZ');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white">
            {selectedAsset ? t('transfer.sendToken', { token: selectedAsset.symbol }) : t('transfer.sendTokens')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {selectedAsset
              ? t('transfer.transferTo', { name: selectedAsset.name })
              : t('transfer.transferTokens')}
          </DialogDescription>
        </DialogHeader>

        {txStatus === 'success' ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('transfer.success')}</h3>
            <p className="text-gray-400 mb-4">{t('transfer.finalized')}</p>
            {txHash && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{t('transfer.txHash')}</div>
                <div className="text-white font-mono text-xs break-all">
                  {txHash}
                </div>
              </div>
            )}
          </div>
        ) : txStatus === 'error' ? (
          <div className="py-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('transfer.failed')}</h3>
            <p className="text-gray-400">{t('transfer.pleaseTryAgain')}</p>
            <Button
              onClick={() => setTxStatus('idle')}
              className="mt-4 bg-gray-800 hover:bg-gray-700"
            >
              {t('transfer.tryAgain')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Token Selection - Only show if no asset is pre-selected */}
            {!selectedAsset && (
              <div>
                <Label htmlFor="token" className="text-white">{t('transfer.selectToken')}</Label>
                <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as TokenType)} disabled={isTransferring}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-2">
                    <SelectValue placeholder={t('transfer.selectTokenPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {TOKENS.map((token) => (
                      <SelectItem
                        key={token.symbol}
                        value={token.symbol}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={TOKEN_LOGOS[token.symbol]}
                            alt={token.symbol}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="font-semibold">{token.symbol}</span>
                          <span className="text-gray-400 text-sm">- {token.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="recipient" className="text-white">{t('transfer.recipientAddress')}</Label>
              <Input
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t('transfer.recipientPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white mt-2 placeholder:text-gray-500 placeholder:opacity-50"
                disabled={isTransferring}
              />
            </div>

            <div>
              <Label htmlFor="amount" className="text-white">{t('transfer.amountLabel', { token: selectedToken })}</Label>
              <Input
                id="amount"
                type="number"
                step={selectedToken === 'HEZ' || selectedToken === 'PEZ' ? '0.0001' : '0.000001'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('transfer.amountPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white mt-2 placeholder:text-gray-500 placeholder:opacity-50"
                disabled={isTransferring}
              />
              <div className="text-xs text-gray-500 mt-1">
                {t('transfer.decimals', { decimals: currentToken.decimals })}
              </div>
            </div>

            {txStatus === 'signing' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  {t('transfer.signTransaction')}
                </p>
              </div>
            )}

            {txStatus === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('transfer.txPending')}
                </p>
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={isTransferring || !recipient || !amount}
              className={`w-full bg-gradient-to-r ${currentToken.color} hover:opacity-90`}
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {txStatus === 'signing' ? t('transfer.waitingSignature') : t('transfer.processing')}
                </>
              ) : (
                <>
                  {t('transfer.sendToken', { token: selectedToken })}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
