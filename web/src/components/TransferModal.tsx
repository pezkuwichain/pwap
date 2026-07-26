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
import { MINTABLE_ASSETS } from './dex/mintableAssets';
import { parseTokenInput } from '@pezkuwi/utils/dex';

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

type TokenType = 'HEZ' | 'PEZ' | 'wUSDT' | 'wDOT' | 'wETH' | 'wBTC';

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
  wUSDT: '/tokens/USDT.png',
  wDOT: '/tokens/DOT.png',
  wETH: '/tokens/ETH.png',
  wBTC: '/tokens/BTC.png',
  BTC: '/tokens/BTC.png',
  ETH: '/tokens/ETH.png',
  DOT: '/tokens/DOT.png',
  BNB: '/tokens/BNB.png',
};

// Wrapped assets (id + decimals) are sourced from the single source of truth
// (MINTABLE_ASSETS in dex/mintableAssets.ts): wUSDT=1000, wDOT=1001, wETH=1002, wBTC=1003.
// All of these live on Asset Hub (assets pallet). Only native HEZ is on the relay chain.
const TOKENS: Token[] = [
  { symbol: 'HEZ', name: 'Hez Token', decimals: 12, color: 'from-green-600 to-yellow-400' },
  { symbol: 'PEZ', name: 'Pez Token', assetId: 1, decimals: 12, color: 'from-blue-600 to-purple-400' },
  { symbol: 'wUSDT', name: MINTABLE_ASSETS.wUSDT.name, assetId: MINTABLE_ASSETS.wUSDT.id, decimals: MINTABLE_ASSETS.wUSDT.decimals, color: 'from-green-500 to-green-600' },
  { symbol: 'wDOT', name: MINTABLE_ASSETS.wDOT.name, assetId: MINTABLE_ASSETS.wDOT.id, decimals: MINTABLE_ASSETS.wDOT.decimals, color: 'from-pink-500 to-red-500' },
  { symbol: 'wETH', name: MINTABLE_ASSETS.wETH.name, assetId: MINTABLE_ASSETS.wETH.id, decimals: MINTABLE_ASSETS.wETH.decimals, color: 'from-purple-500 to-blue-500' },
  { symbol: 'wBTC', name: MINTABLE_ASSETS.wBTC.name, assetId: MINTABLE_ASSETS.wBTC.id, decimals: MINTABLE_ASSETS.wBTC.decimals, color: 'from-orange-500 to-yellow-500' },
];

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, selectedAsset }) => {
  const { api, assetHubApi, isApiReady, isAssetHubReady, selectedAccount, walletSource } = usePezkuwi();
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

    // Native HEZ (no assetId, or assetId 0) transfers on the relay chain.
    // Every other token is an Asset Hub assets-pallet asset (PEZ, wHEZ, wUSDT,
    // wDOT, wETH, wBTC and any custom token), so it must route through Asset Hub.
    const isNativeHez = currentToken.assetId === undefined || currentToken.assetId === 0;
    const isAssetHubTransfer = !isNativeHez;
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
      // Get signer (extension or WalletConnect)
      const { getSigner } = await import('@/lib/get-signer');
      const injector = await getSigner(selectedAccount.address, walletSource, isAssetHubTransfer ? assetHubApi : api);

      // Convert amount to smallest unit using string-based BigInt parsing.
      // (BigInt(parseFloat(amount) * 10**decimals) throws a RangeError on
      // fractional amounts because the intermediate double is non-integer.)
      const amountInSmallestUnit = parseTokenInput(amount, currentToken.decimals);

      let transfer;
      let targetApi = api; // Default to main chain API

      // Create appropriate transfer transaction based on token type.
      // HEZ uses native token transfer (balances pallet on the relay chain).
      // Every asset (PEZ, wHEZ, wUSDT, wDOT, wETH, wBTC, custom) is on Asset Hub.
      if (isNativeHez) {
        // Native HEZ token transfer on the relay chain
        transfer = api.tx.balances.transferKeepAlive(recipient, amountInSmallestUnit);
      } else {
        // Asset Hub transfer (assets pallet)
        targetApi = assetHubApi!;
        transfer = assetHubApi!.tx.assets.transfer(currentToken.assetId, recipient, amountInSmallestUnit);
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
