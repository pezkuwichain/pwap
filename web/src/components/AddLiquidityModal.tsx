import React, { useState, useEffect } from 'react';
import { X, Plus, Info, AlertCircle } from 'lucide-react';
import { web3FromAddress } from '@pezkuwi/extension-dapp';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ASSET_IDS, getAssetSymbol } from '@pezkuwi/lib/wallet';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset0?: number;  // Pool's first asset ID
  asset1?: number;  // Pool's second asset ID
}

interface AssetDetails {
  minBalance?: string | number;
}

interface Balances {
  [key: string]: number;
}

// Helper to get display name for tokens
const getDisplayName = (assetId: number): string => {
  if (assetId === -1) return 'HEZ';  // Native HEZ from relay chain
  if (assetId === ASSET_IDS.WHEZ || assetId === 2) return 'wHEZ';  // Wrapped HEZ
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 'USDT';
  return getAssetSymbol(assetId);
};

// Helper to get balance key for the asset
const getBalanceKey = (assetId: number): string => {
  if (assetId === -1) return 'HEZ';  // Native HEZ
  if (assetId === ASSET_IDS.WHEZ || assetId === 2) return 'wHEZ';  // Wrapped HEZ
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 'USDT';
  return getAssetSymbol(assetId);
};

// Helper to get decimals for asset
const getAssetDecimals = (assetId: number): number => {
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 6; // wUSDT has 6 decimals
  return 12; // wHEZ, PEZ have 12 decimals
};

export const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  isOpen,
  onClose,
  asset0 = 0,  // Default to wHEZ
  asset1 = 1   // Default to PEZ
}) => {
  // Use Asset Hub API for DEX operations (assetConversion pallet is on Asset Hub)
  const { assetHubApi, selectedAccount, isAssetHubReady } = usePezkuwi();
  const { balances, refreshBalances } = useWallet();

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isPoolEmpty, setIsPoolEmpty] = useState(true); // Track if pool has meaningful liquidity
  const [minDeposit0, setMinDeposit0] = useState<number>(0.01); // Dynamic minimum deposit for asset0
  const [minDeposit1, setMinDeposit1] = useState<number>(0.01); // Dynamic minimum deposit for asset1
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get asset details
  const asset0Name = getDisplayName(asset0);
  const asset1Name = getDisplayName(asset1);
  const asset0BalanceKey = getBalanceKey(asset0);
  const asset1BalanceKey = getBalanceKey(asset1);
  const asset0Decimals = getAssetDecimals(asset0);
  const asset1Decimals = getAssetDecimals(asset1);

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setAmount0('');
      setAmount1('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Fetch minimum deposit requirements from runtime
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !isOpen) return;

    const fetchMinimumBalances = async () => {
      try {
        // For native token (-1), use default minimum - can't query assets pallet
        let minBalance0 = 0.01;
        let minBalance1 = 0.01;

        // Only query assets pallet for non-native tokens (positive IDs)
        if (asset0 >= 0) {
          const assetDetails0 = await assetHubApi.query.assets.asset(asset0);
          if (assetDetails0.isSome) {
            const details0 = assetDetails0.unwrap().toJSON() as AssetDetails;
            const minBalance0Raw = details0.minBalance || '0';
            const fetchedMin0 = Number(minBalance0Raw) / Math.pow(10, asset0Decimals);
            minBalance0 = Math.max(fetchedMin0, 0.01); // Ensure at least 0.01
          }
        }

        if (asset1 >= 0) {
          const assetDetails1 = await assetHubApi.query.assets.asset(asset1);
          if (assetDetails1.isSome) {
            const details1 = assetDetails1.unwrap().toJSON() as AssetDetails;
            const minBalance1Raw = details1.minBalance || '0';
            const fetchedMin1 = Number(minBalance1Raw) / Math.pow(10, asset1Decimals);
            minBalance1 = Math.max(fetchedMin1, 0.01); // Ensure at least 0.01
          }
        }

        if (import.meta.env.DEV) console.log('📊 Minimum deposit requirements:', {
          asset0: asset0Name,
          minBalance0,
          asset1: asset1Name,
          minBalance1
        });

        setMinDeposit0(minBalance0);
        setMinDeposit1(minBalance1);

        // Also check if there&apos;s a MintMinLiquidity constant in assetConversion pallet
        if (assetHubApi.consts.assetConversion) {
          const mintMinLiq = assetHubApi.consts.assetConversion.mintMinLiquidity;
          if (mintMinLiq) {
            if (import.meta.env.DEV) console.log('🔧 AssetConversion MintMinLiquidity constant:', mintMinLiq.toString());
          }

          const liquidityWithdrawalFee = assetHubApi.consts.assetConversion.liquidityWithdrawalFee;
          if (liquidityWithdrawalFee) {
            if (import.meta.env.DEV) console.log('🔧 AssetConversion LiquidityWithdrawalFee:', liquidityWithdrawalFee.toHuman());
          }

          // Log all assetConversion constants
          if (import.meta.env.DEV) console.log('🔧 All assetConversion constants:', Object.keys(assetHubApi.consts.assetConversion));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Error fetching minimum balances:', err);
        // Keep default 0.01 if query fails
      }
    };

    fetchMinimumBalances();
  }, [assetHubApi, isAssetHubReady, isOpen, asset0, asset1, asset0Decimals, asset1Decimals, asset0Name, asset1Name]);

  // Helper to convert asset ID to XCM Location format
  const formatAssetLocation = (id: number) => {
    if (id === -1) {
      // Native token from relay chain
      return { parents: 1, interior: 'Here' };
    }
    // Asset on Asset Hub
    return { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } };
  };

  // Fetch current pool price and reserves
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !isOpen) return;

    const fetchPoolPrice = async () => {
      try {
        // Use XCM Location format for pool queries (required for native token)
        const asset0Location = formatAssetLocation(asset0);
        const asset1Location = formatAssetLocation(asset1);
        const poolKey = [asset0Location, asset1Location];
        const poolInfo = await assetHubApi.query.assetConversion.pools(poolKey);

        if (poolInfo.isSome) {
          // Pool exists - try to get reserves via runtime API
          try {
            // Use quotePriceExactTokensForTokens to get the exchange rate
            // This gives us the output amount for 1 unit of input
            const oneUnit = BigInt(Math.pow(10, asset0Decimals)); // 1 token in smallest units

            const quote = await assetHubApi.call.assetConversionApi.quotePriceExactTokensForTokens(
              asset0Location,
              asset1Location,
              oneUnit.toString(),
              true // include fee
            );

            if (quote && !quote.isNone) {
              const outputAmount = Number(quote.unwrap().toString()) / Math.pow(10, asset1Decimals);
              const inputAmount = 1; // We queried for 1 token
              const price = outputAmount / inputAmount;

              if (price > 0) {
                setCurrentPrice(price);
                setIsPoolEmpty(false);
                if (import.meta.env.DEV) console.log('Pool price from runtime API:', price);
              } else {
                setIsPoolEmpty(true);
                setCurrentPrice(null);
              }
            } else {
              // Quote returned nothing - pool might be empty
              setIsPoolEmpty(true);
              setCurrentPrice(null);
              if (import.meta.env.DEV) console.log('Pool exists but no quote available - may be empty');
            }
          } catch (quoteErr) {
            if (import.meta.env.DEV) console.error('Error getting quote:', quoteErr);
            // Pool exists but couldn't get quote - allow manual input
            setIsPoolEmpty(true);
            setCurrentPrice(null);
          }
        } else {
          // Pool doesn't exist yet
          setCurrentPrice(null);
          setIsPoolEmpty(true);
          if (import.meta.env.DEV) console.log('Pool does not exist yet - manual input allowed');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching pool price:', err);
        // On error, assume pool is empty to allow manual input
        setCurrentPrice(null);
        setIsPoolEmpty(true);
      }
    };

    fetchPoolPrice();
  }, [assetHubApi, isAssetHubReady, isOpen, asset0, asset1, asset0Decimals, asset1Decimals]);

  // Auto-calculate asset1 amount based on asset0 input (only if pool has liquidity)
  useEffect(() => {
    if (!isPoolEmpty && amount0 && currentPrice) {
      const calculated = parseFloat(amount0) * currentPrice;
      setAmount1(calculated.toFixed(asset1Decimals === 6 ? 2 : 4));
    } else if (!amount0 && !isPoolEmpty) {
      setAmount1('');
    }
    // If pool is empty, don&apos;t auto-calculate - let user input both amounts
  }, [amount0, currentPrice, asset1Decimals, isPoolEmpty]);

  const handleAddLiquidity = async () => {
    if (!assetHubApi || !selectedAccount || !amount0 || !amount1) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate amounts
      if (parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
        setError('Please enter valid amounts');
        setIsLoading(false);
        return;
      }

      // Check minimum deposit requirements from runtime
      if (parseFloat(amount0) < minDeposit0) {
        setError(`${asset0Name} amount must be at least ${minDeposit0.toFixed(asset0Decimals === 6 ? 2 : 4)} (minimum deposit requirement)`);
        setIsLoading(false);
        return;
      }

      if (parseFloat(amount1) < minDeposit1) {
        setError(`${asset1Name} amount must be at least ${minDeposit1.toFixed(asset1Decimals === 6 ? 2 : 4)} (minimum deposit requirement)`);
        setIsLoading(false);
        return;
      }

      const balance0 = (balances as Balances)[asset0BalanceKey] || 0;
      const balance1 = (balances as Balances)[asset1BalanceKey] || 0;

      if (parseFloat(amount0) > balance0) {
        setError(`Insufficient ${asset0Name} balance`);
        setIsLoading(false);
        return;
      }

      if (parseFloat(amount1) > balance1) {
        setError(`Insufficient ${asset1Name} balance`);
        setIsLoading(false);
        return;
      }

      // Get the signer from the extension
      const injector = await web3FromAddress(selectedAccount.address);

      // Convert amounts to proper decimals
      const amount0BN = BigInt(Math.floor(parseFloat(amount0) * Math.pow(10, asset0Decimals)));
      const amount1BN = BigInt(Math.floor(parseFloat(amount1) * Math.pow(10, asset1Decimals)));

      // Min amounts (90% of desired to account for slippage)
      const minAmount0BN = (amount0BN * BigInt(90)) / BigInt(100);
      const minAmount1BN = (amount1BN * BigInt(90)) / BigInt(100);

      // Build transaction using XCM Location format for assets
      const asset0Location = formatAssetLocation(asset0);
      const asset1Location = formatAssetLocation(asset1);

      const tx = assetHubApi.tx.assetConversion.addLiquidity(
        asset0Location,
        asset1Location,
        amount0BN.toString(),
        amount1BN.toString(),
        minAmount0BN.toString(),
        minAmount1BN.toString(),
        selectedAccount.address
      );

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events, dispatchError }) => {
          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log('Transaction in block:', status.asInBlock.toHex());
          } else if (status.isFinalized) {
            if (import.meta.env.DEV) console.log('Transaction finalized:', status.asFinalized.toHex());

            // Check for errors
            const hasError = events.some(({ event }) =>
              assetHubApi.events.system.ExtrinsicFailed.is(event)
            );

            if (hasError || dispatchError) {
              let errorMessage = 'Transaction failed';

              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                  const { docs, name, section } = decoded;
                  errorMessage = `${section}.${name}: ${docs.join(' ')}`;
                  if (import.meta.env.DEV) console.error('Dispatch error:', errorMessage);
                } else {
                  errorMessage = dispatchError.toString();
                  if (import.meta.env.DEV) console.error('Dispatch error:', errorMessage);
                }
              }

              events.forEach(({ event }) => {
                if (assetHubApi.events.system.ExtrinsicFailed.is(event)) {
                  if (import.meta.env.DEV) console.error('ExtrinsicFailed event:', event.toHuman());
                }
              });

              setError(errorMessage);
              setIsLoading(false);
            } else {
              if (import.meta.env.DEV) console.log('Transaction successful');
              setSuccess(true);
              setIsLoading(false);
              setAmount0('');
              setAmount1('');
              refreshBalances();

              setTimeout(() => {
                setSuccess(false);
                onClose();
              }, 2000);
            }
          }
        }
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error adding liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to add liquidity');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const balance0 = (balances as Balances)[asset0BalanceKey] || 0;
  const balance1 = (balances as Balances)[asset1BalanceKey] || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <Alert className="mb-4 bg-red-900/20 border-red-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-900/20 border-green-500">
            <AlertDescription>Liquidity added successfully!</AlertDescription>
          </Alert>
        )}

        {isPoolEmpty ? (
          <Alert className="mb-4 bg-yellow-900/20 border-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>First Liquidity Provider:</strong> Pool is empty! You are setting the initial price ratio.
              <strong> Minimum deposit: {minDeposit0.toFixed(asset0Decimals === 6 ? 2 : 4)} {asset0Name} and {minDeposit1.toFixed(asset1Decimals === 6 ? 2 : 4)} {asset1Name}.</strong>
              {(asset0 === 0 || asset0 === ASSET_IDS.WHEZ) && ' Your HEZ will be automatically wrapped to wHEZ.'}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-4 bg-blue-900/20 border-blue-500">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Add liquidity to earn 3% fees from all swaps. Amounts are auto-calculated based on current pool ratio.
              <strong> Minimum deposit: {minDeposit0.toFixed(asset0Decimals === 6 ? 2 : 4)} {asset0Name} and {minDeposit1.toFixed(asset1Decimals === 6 ? 2 : 4)} {asset1Name}.</strong>
              {(asset0 === 0 || asset0 === ASSET_IDS.WHEZ) && ' Your HEZ will be automatically wrapped to wHEZ.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Asset 0 Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {asset0Name} Amount
              <span className="text-xs text-gray-500 ml-2">(min: {minDeposit0.toFixed(asset0Decimals === 6 ? 2 : 4)})</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                placeholder={`${minDeposit0.toFixed(asset0Decimals === 6 ? 2 : 4)} or more`}
                min={minDeposit0}
                step={minDeposit0 < 1 ? minDeposit0 : 0.01}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="text-gray-400 text-sm">{asset0Name}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Balance: {balance0.toLocaleString()}</span>
              <button
                onClick={() => setAmount0(balance0.toString())}
                className="text-blue-400 hover:text-blue-300"
              >
                Max
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <Plus className="w-5 h-5 text-gray-400" />
          </div>

          {/* Asset 1 Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {asset1Name} Amount {!isPoolEmpty && '(Auto-calculated)'}
              {isPoolEmpty && (
                <>
                  <span className="text-yellow-400 text-xs ml-2">⚠️ You set the initial ratio</span>
                  <span className="text-xs text-gray-500 ml-2">(min: {minDeposit1.toFixed(asset1Decimals === 6 ? 2 : 4)})</span>
                </>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder={isPoolEmpty ? `${minDeposit1.toFixed(asset1Decimals === 6 ? 2 : 4)} or more` : "Auto-calculated"}
                min={isPoolEmpty ? minDeposit1 : undefined}
                step={isPoolEmpty ? (minDeposit1 < 1 ? minDeposit1 : 0.01) : undefined}
                className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none ${
                  isPoolEmpty
                    ? 'text-white focus:border-blue-500'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                disabled={!isPoolEmpty || isLoading}
                readOnly={!isPoolEmpty}
              />
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="text-gray-400 text-sm">{asset1Name}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Balance: {balance1.toLocaleString()}</span>
              {isPoolEmpty ? (
                <button
                  onClick={() => setAmount1(balance1.toString())}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Max
                </button>
              ) : (
                currentPrice && <span>Rate: 1 {asset0Name} = {currentPrice.toFixed(asset1Decimals === 6 ? 2 : 4)} {asset1Name}</span>
              )}
            </div>
          </div>

          {/* Price Info */}
          {amount0 && amount1 && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
              {isPoolEmpty && (
                <div className="flex justify-between text-yellow-300">
                  <span>Initial Price</span>
                  <span>
                    1 {asset0Name} = {(parseFloat(amount1) / parseFloat(amount0)).toFixed(asset1Decimals === 6 ? 2 : 4)} {asset1Name}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-300">
                <span>Share of Pool</span>
                <span>{isPoolEmpty ? '100%' : '~0.1%'}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Slippage Tolerance</span>
                <span>10%</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleAddLiquidity}
            disabled={
              isLoading ||
              !amount0 ||
              !amount1 ||
              parseFloat(amount0) > balance0 ||
              parseFloat(amount1) > balance1
            }
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 h-12"
          >
            {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
          </Button>
        </div>
      </div>
    </div>
  );
};
