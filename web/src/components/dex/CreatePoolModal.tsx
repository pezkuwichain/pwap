import React, { useState, useEffect, useCallback } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { X, Plus, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KNOWN_TOKENS, NATIVE_TOKEN_ID } from '@/types/dex';
import { parseTokenInput, formatTokenBalance } from '@pezkuwi/utils/dex';

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export const CreatePoolModal: React.FC<CreatePoolModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Use Asset Hub API for DEX operations (assetConversion pallet is on Asset Hub)
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const { account, signer } = useWallet();

  const [asset1Id, setAsset1Id] = useState<number | null>(null);
  const [asset2Id, setAsset2Id] = useState<number | null>(null);
  const [amount1Input, setAmount1Input] = useState('');
  const [amount2Input, setAmount2Input] = useState('');

  const [balance1, setBalance1] = useState<string>('0');
  const [balance2, setBalance2] = useState<string>('0');

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Available tokens
  const availableTokens = Object.values(KNOWN_TOKENS);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAsset1Id(null);
      setAsset2Id(null);
      setAmount1Input('');
      setAmount2Input('');
      setTxStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Helper to fetch balance for an asset (handles Native vs Asset)
  const fetchAssetBalance = useCallback(async (assetId: number): Promise<string> => {
    if (!assetHubApi || !isAssetHubReady || !account) return '0';

    try {
      if (assetId === NATIVE_TOKEN_ID) {
        // Native token - query system.account
        const accountData: { data: { free: { toString: () => string } } } =
          await assetHubApi.query.system.account(account) as never;
        return accountData.data.free.toString();
      } else {
        // Asset - query assets.account
        const balanceData = await assetHubApi.query.assets.account(assetId, account);
        if ((balanceData as { isSome: boolean }).isSome) {
          return ((balanceData as { unwrap: () => { balance: { toString: () => string } } }).unwrap()).balance.toString();
        }
        return '0';
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('❌ Failed to fetch balance for asset', assetId, ':', error);
      return '0';
    }
  }, [assetHubApi, isAssetHubReady, account]);

  // Fetch balances from Asset Hub when assets selected
  useEffect(() => {
    const fetchBalances = async () => {
      if (asset1Id === null) return;
      if (import.meta.env.DEV) console.log('🔍 Fetching balance for asset', asset1Id, 'on Asset Hub');
      const balance = await fetchAssetBalance(asset1Id);
      if (import.meta.env.DEV) console.log('✅ Balance for asset', asset1Id, ':', balance);
      setBalance1(balance);
    };
    fetchBalances();
  }, [fetchAssetBalance, asset1Id]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (asset2Id === null) return;
      if (import.meta.env.DEV) console.log('🔍 Fetching balance for asset', asset2Id, 'on Asset Hub');
      const balance = await fetchAssetBalance(asset2Id);
      if (import.meta.env.DEV) console.log('✅ Balance for asset', asset2Id, ':', balance);
      setBalance2(balance);
    };
    fetchBalances();
  }, [fetchAssetBalance, asset2Id]);

  const validateInputs = (): string | null => {
    if (asset1Id === null || asset2Id === null) {
      return 'Please select both tokens';
    }

    if (asset1Id === asset2Id) {
      return 'Cannot create pool with same token';
    }

    if (!amount1Input || !amount2Input) {
      return 'Please enter amounts for both tokens';
    }

    const token1 = KNOWN_TOKENS[asset1Id];
    const token2 = KNOWN_TOKENS[asset2Id];

    if (!token1 || !token2) {
      return 'Invalid token selected';
    }

    const amount1Raw = parseTokenInput(amount1Input, token1.decimals);
    const amount2Raw = parseTokenInput(amount2Input, token2.decimals);

    if (import.meta.env.DEV) console.log('💰 Validation check:', {
      token1: token1.symbol,
      amount1Input,
      amount1Raw,
      balance1,
      hasEnough1: BigInt(amount1Raw) <= BigInt(balance1),
      token2: token2.symbol,
      amount2Input,
      amount2Raw,
      balance2,
      hasEnough2: BigInt(amount2Raw) <= BigInt(balance2),
    });

    if (BigInt(amount1Raw) <= BigInt(0) || BigInt(amount2Raw) <= BigInt(0)) {
      return 'Amounts must be greater than zero';
    }

    if (BigInt(amount1Raw) > BigInt(balance1)) {
      return `Insufficient ${token1.symbol} balance`;
    }

    if (BigInt(amount2Raw) > BigInt(balance2)) {
      return `Insufficient ${token2.symbol} balance`;
    }

    return null;
  };

  const handleCreatePool = async () => {
    if (!assetHubApi || !isAssetHubReady || !signer || !account) {
      setErrorMessage('Wallet not connected or Asset Hub not ready');
      return;
    }

    // Check if assetConversion pallet is available on Asset Hub
    if (!assetHubApi.tx.assetConversion || !assetHubApi.tx.assetConversion.createPool) {
      setErrorMessage('AssetConversion pallet is not available on Asset Hub. Pool creation requires this pallet.');
      return;
    }

    const validationError = validateInputs();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const token1 = KNOWN_TOKENS[asset1Id!];
    const token2 = KNOWN_TOKENS[asset2Id!];
    const amount1Raw = parseTokenInput(amount1Input, token1.decimals);
    const amount2Raw = parseTokenInput(amount2Input, token2.decimals);

    try {
      setTxStatus('signing');
      setErrorMessage('');

      // Convert asset IDs to proper format for assetConversion pallet
      // Native token (relay chain HEZ) uses XCM location format
      // Assets use { Asset: id }
      const formatAssetId = (id: number) => {
        if (id === NATIVE_TOKEN_ID) {
          // Native token from relay chain - XCM location format
          // { parents: 1, interior: Here } represents relay chain native token
          return { parents: 1, interior: 'Here' };
        }
        return { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } };
      };

      const asset1 = formatAssetId(asset1Id!);
      const asset2 = formatAssetId(asset2Id!);

      if (import.meta.env.DEV) {
        console.log('🏊 Creating pool with:', { asset1, asset2, amount1Raw, amount2Raw });
      }

      // Create pool extrinsic on Asset Hub
      const createPoolTx = assetHubApi.tx.assetConversion.createPool(asset1, asset2);

      // Add liquidity extrinsic on Asset Hub
      const addLiquidityTx = assetHubApi.tx.assetConversion.addLiquidity(
        asset1,
        asset2,
        amount1Raw,
        amount2Raw,
        amount1Raw, // min amount1
        amount2Raw, // min amount2
        account
      );

      // Batch transactions
      const batchTx = assetHubApi.tx.utility.batchAll([createPoolTx, addLiquidityTx]);

      setTxStatus('submitting');

      await batchTx.signAndSend(
        account,
        { signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                setErrorMessage(`${decoded.section}.${decoded.name}: ${decoded.docs}`);
              } else {
                setErrorMessage(dispatchError.toString());
              }
              setTxStatus('error');
            } else {
              setTxStatus('success');
              setTimeout(() => {
                onSuccess?.();
                onClose();
              }, 2000);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Pool creation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Transaction failed');
      setTxStatus('error');
    }
  };

  if (!isOpen) return null;

  const token1 = asset1Id !== null ? KNOWN_TOKENS[asset1Id] : null;
  const token2 = asset2Id !== null ? KNOWN_TOKENS[asset2Id] : null;

  const exchangeRate =
    amount1Input && amount2Input && parseFloat(amount1Input) > 0
      ? (parseFloat(amount2Input) / parseFloat(amount1Input)).toFixed(6)
      : '0';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white">
              Create New Pool
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 w-fit mt-2">
            Founder Only
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Token 1 Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Token 1</label>
            <select
              value={asset1Id ?? ''}
              onChange={(e) => setAsset1Id(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <option value="">Select token...</option>
              {availableTokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            {token1 && (
              <div className="text-xs text-gray-500">
                Balance: {formatTokenBalance(balance1, token1.decimals, 4)} {token1.symbol}
              </div>
            )}
          </div>

          {/* Amount 1 Input */}
          {token1 && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                Amount of {token1.symbol}
              </label>
              <input
                type="text"
                value={amount1Input}
                onChange={(e) => setAmount1Input(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              />
            </div>
          )}

          {/* Plus Icon */}
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-400" />
            </div>
          </div>

          {/* Token 2 Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Token 2</label>
            <select
              value={asset2Id ?? ''}
              onChange={(e) => setAsset2Id(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              <option value="">Select token...</option>
              {availableTokens.map((token) => (
                <option key={token.id} value={token.id} disabled={token.id === asset1Id}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            {token2 && (
              <div className="text-xs text-gray-500">
                Balance: {formatTokenBalance(balance2, token2.decimals, 4)} {token2.symbol}
              </div>
            )}
          </div>

          {/* Amount 2 Input */}
          {token2 && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                Amount of {token2.symbol}
              </label>
              <input
                type="text"
                value={amount2Input}
                onChange={(e) => setAmount2Input(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={txStatus === 'signing' || txStatus === 'submitting'}
              />
            </div>
          )}

          {/* Exchange Rate Preview */}
          {token1 && token2 && amount1Input && amount2Input && (
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-sm text-gray-400 mb-2">Initial Exchange Rate</div>
              <div className="text-white font-mono">
                1 {token1.symbol} = {exchangeRate} {token2.symbol}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-400">{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {txStatus === 'success' && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-green-400">
                Pool created successfully!
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePool}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              disabled={
                txStatus === 'signing' ||
                txStatus === 'submitting' ||
                txStatus === 'success'
              }
            >
              {txStatus === 'signing' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing...
                </>
              )}
              {txStatus === 'submitting' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              )}
              {txStatus === 'idle' && 'Create Pool'}
              {txStatus === 'error' && 'Retry'}
              {txStatus === 'success' && (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Success
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
