import React, { useState, useEffect } from 'react';
import { X, Plus, Info, AlertCircle } from 'lucide-react';
import { getSigner } from '@/lib/get-signer';
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
  if (assetId === ASSET_IDS.WHEZ || assetId === 2 || assetId === 0) return 'wHEZ';  // Wrapped HEZ (asset 0 or 2)
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 'USDT';
  if (assetId === 1001) return 'DOT';
  if (assetId === 1002) return 'ETH';
  if (assetId === 1003) return 'BTC';
  return getAssetSymbol(assetId);
};

// Helper to get balance key for the asset
const getBalanceKey = (assetId: number): string => {
  if (assetId === -1) return 'HEZ';  // Native HEZ
  if (assetId === ASSET_IDS.WHEZ || assetId === 2 || assetId === 0) return 'wHEZ';  // Wrapped HEZ (asset 0 or 2)
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 'USDT';
  if (assetId === 1001) return 'DOT';
  if (assetId === 1002) return 'ETH';
  if (assetId === 1003) return 'BTC';
  return getAssetSymbol(assetId);
};

// Helper to get decimals for asset
const getAssetDecimals = (assetId: number): number => {
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 6; // wUSDT has 6 decimals
  if (assetId === 1001) return 10; // wDOT has 10 decimals
  if (assetId === 1002) return 18; // wETH has 18 decimals
  if (assetId === 1003) return 8;  // wBTC has 8 decimals
  return 12; // wHEZ, PEZ have 12 decimals
};

export const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  isOpen,
  onClose,
  asset0 = 0,  // Default to wHEZ
  asset1 = 1   // Default to PEZ
}) => {
  // Use Asset Hub API for DEX operations (assetConversion pallet is on Asset Hub)
  const { assetHubApi, selectedAccount, isAssetHubReady, walletSource } = usePezkuwi();
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
  // Asset Hub native balance for native token (-1) - needed because DEX is on Asset Hub
  const [assetHubNativeBalance, setAssetHubNativeBalance] = useState<number>(0);
  // Asset Hub asset balances for DOT/ETH/BTC (not tracked in WalletContext)
  const [assetHubBalances, setAssetHubBalances] = useState<Record<number, number>>({});

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

  // Fetch Asset Hub native balance for native token (-1)
  // This is needed because the DEX (assetConversion) is on Asset Hub,
  // but WalletContext fetches HEZ balance from the relay chain
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !selectedAccount || !isOpen) return;

    // Only fetch if one of the assets is the native token (-1)
    if (asset0 !== -1 && asset1 !== -1) {
      setAssetHubNativeBalance(0);
      return;
    }

    const fetchAssetHubNativeBalance = async () => {
      try {
        const { data: accountInfo } = await assetHubApi.query.system.account(selectedAccount.address);
        const freeBalance = accountInfo.free.toString();
        const humanBalance = Number(freeBalance) / Math.pow(10, 12); // Native token has 12 decimals

        if (import.meta.env.DEV) {
          console.log('💰 Asset Hub native balance:', {
            raw: freeBalance,
            human: humanBalance,
            address: selectedAccount.address
          });
        }

        setAssetHubNativeBalance(humanBalance);
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Failed to fetch Asset Hub native balance:', err);
        setAssetHubNativeBalance(0);
      }
    };

    fetchAssetHubNativeBalance();
  }, [assetHubApi, isAssetHubReady, selectedAccount, isOpen, asset0, asset1]);

  // Fetch Asset Hub asset balances for DOT/ETH/BTC (assets not tracked in WalletContext)
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !selectedAccount || !isOpen) return;

    const assetHubOnlyAssets = [1001, 1002, 1003]; // DOT, ETH, BTC
    const assetsToFetch = [asset0, asset1].filter(id => assetHubOnlyAssets.includes(id));

    if (assetsToFetch.length === 0) return;

    const fetchAssetHubBalances = async () => {
      const newBalances: Record<number, number> = {};

      for (const assetId of assetsToFetch) {
        try {
          const accountInfo = await assetHubApi.query.assets.account(assetId, selectedAccount.address);
          if (accountInfo && accountInfo.isSome) {
            const data = accountInfo.unwrap();
            const rawBalance = data.balance.toString();
            const decimals = getAssetDecimals(assetId);
            const humanBalance = Number(rawBalance) / Math.pow(10, decimals);
            newBalances[assetId] = humanBalance;

            if (import.meta.env.DEV) {
              console.log(`💰 Asset Hub balance for asset ${assetId}:`, {
                raw: rawBalance,
                human: humanBalance,
                decimals
              });
            }
          } else {
            newBalances[assetId] = 0;
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error(`❌ Failed to fetch Asset Hub balance for asset ${assetId}:`, err);
          newBalances[assetId] = 0;
        }
      }

      setAssetHubBalances(prev => ({ ...prev, ...newBalances }));
    };

    fetchAssetHubBalances();
  }, [assetHubApi, isAssetHubReady, selectedAccount, isOpen, asset0, asset1]);

  // Note: Minimum deposits are calculated in the fetchPoolReserves effect below
  // based on the actual pool ratio and asset minBalances

  // Helper to convert asset ID to XCM Location format
  const formatAssetLocation = (id: number) => {
    if (id === -1) {
      // Native token from relay chain
      return { parents: 1, interior: 'Here' };
    }
    // Asset on Asset Hub
    return { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } };
  };

  // Fetch current pool reserves and calculate ratio + minimums
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !isOpen) return;

    const fetchPoolReserves = async () => {
      try {
        // Get asset1 minBalance from chain (e.g., DOT = 0.1)
        let asset1MinBalance = 0.1; // default

        if (asset1 >= 0) {
          try {
            const assetDetails = await assetHubApi.query.assets.asset(asset1);
            if (assetDetails.isSome) {
              const details = assetDetails.unwrap().toJSON() as AssetDetails;
              const minBalRaw = details.minBalance || '0';
              asset1MinBalance = Math.max(Number(minBalRaw) / Math.pow(10, asset1Decimals), 0.1);
              if (import.meta.env.DEV) console.log(`Asset ${asset1} minBalance:`, asset1MinBalance);
            }
          } catch {
            if (import.meta.env.DEV) console.log('Could not fetch asset1 minBalance');
          }
        }

        const asset0Location = formatAssetLocation(asset0);
        const asset1Location = formatAssetLocation(asset1);
        const poolKey = [asset0Location, asset1Location];
        const poolInfo = await assetHubApi.query.assetConversion.pools(poolKey);

        if (poolInfo.isSome) {
          // Pool exists - get reserves for exact ratio
          try {
            const reserves = await assetHubApi.call.assetConversionApi.getReserves(
              asset0Location,
              asset1Location
            );

            if (reserves && !reserves.isNone) {
              const [reserve0Raw, reserve1Raw] = reserves.unwrap();
              const reserve0 = Number(reserve0Raw.toString()) / Math.pow(10, asset0Decimals);
              const reserve1 = Number(reserve1Raw.toString()) / Math.pow(10, asset1Decimals);

              if (reserve0 > 0 && reserve1 > 0) {
                // Use exact reserve ratio for liquidity (no slippage/fees)
                const ratio = reserve1 / reserve0; // asset1 per asset0
                setCurrentPrice(ratio);
                setIsPoolEmpty(false);

                // Calculate minimums based on ratio
                // Pool ratio: 3 HEZ = 1 DOT, so ratio = 1/3 = 0.333
                // If DOT min is 0.1, then HEZ min = 0.1 / 0.333 = 0.3 HEZ
                const requiredAsset0Min = asset1MinBalance / ratio;
                const finalMin0 = Math.max(0.1, requiredAsset0Min);
                const finalMin1 = asset1MinBalance;

                setMinDeposit0(finalMin0);
                setMinDeposit1(finalMin1);

                if (import.meta.env.DEV) {
                  console.log('📊 Pool reserves:', { reserve0, reserve1 });
                  console.log('📊 Ratio (asset1/asset0):', ratio, `(1 ${asset0Name} = ${ratio.toFixed(4)} ${asset1Name})`);
                  console.log('📊 Final minimums:', { [asset0Name]: finalMin0, [asset1Name]: finalMin1 });
                }
              } else {
                setIsPoolEmpty(true);
                setCurrentPrice(null);
                setMinDeposit0(0.1);
                setMinDeposit1(asset1MinBalance);
              }
            } else {
              setIsPoolEmpty(true);
              setCurrentPrice(null);
              setMinDeposit0(0.1);
              setMinDeposit1(asset1MinBalance);
              if (import.meta.env.DEV) console.log('Pool exists but no reserves');
            }
          } catch (reserveErr) {
            if (import.meta.env.DEV) console.error('Error getting reserves:', reserveErr);
            setIsPoolEmpty(true);
            setCurrentPrice(null);
            setMinDeposit0(0.1);
            setMinDeposit1(asset1MinBalance);
          }
        } else {
          setCurrentPrice(null);
          setIsPoolEmpty(true);
          setMinDeposit0(0.1);
          setMinDeposit1(asset1MinBalance);
          if (import.meta.env.DEV) console.log('Pool does not exist yet');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching pool:', err);
        setCurrentPrice(null);
        setIsPoolEmpty(true);
      }
    };

    fetchPoolReserves();
  }, [assetHubApi, isAssetHubReady, isOpen, asset0, asset1, asset0Decimals, asset1Decimals, asset0Name, asset1Name]);

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

      // For native token (-1), use Asset Hub native balance
      // For DOT/ETH/BTC (1001, 1002, 1003), use Asset Hub asset balances
      // For others, use WalletContext
      const getBalanceForValidation = (assetId: number, balanceKey: string): number => {
        if (assetId === -1) {
          return assetHubNativeBalance;
        }
        // DOT, ETH, BTC are only on Asset Hub
        if ([1001, 1002, 1003].includes(assetId)) {
          return assetHubBalances[assetId] || 0;
        }
        const walletBalance = (balances as Balances)[balanceKey];
        return typeof walletBalance === 'string' ? parseFloat(walletBalance) || 0 : walletBalance || 0;
      };

      const bal0 = getBalanceForValidation(asset0, asset0BalanceKey);
      const bal1 = getBalanceForValidation(asset1, asset1BalanceKey);

      if (parseFloat(amount0) > bal0) {
        setError(`Insufficient ${asset0Name} balance on Asset Hub`);
        setIsLoading(false);
        return;
      }

      if (parseFloat(amount1) > bal1) {
        setError(`Insufficient ${asset1Name} balance`);
        setIsLoading(false);
        return;
      }

      // Get the signer (extension or WalletConnect)
      const injector = await getSigner(selectedAccount.address, walletSource, assetHubApi);

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

  // For native token (-1), use Asset Hub native balance
  // For DOT/ETH/BTC (1001, 1002, 1003), use Asset Hub asset balances
  // For other assets, use WalletContext balances (parse string to number)
  const getBalance = (assetId: number, balanceKey: string): number => {
    if (assetId === -1) {
      return assetHubNativeBalance;
    }
    // DOT, ETH, BTC are only on Asset Hub - use directly fetched balances
    if ([1001, 1002, 1003].includes(assetId)) {
      return assetHubBalances[assetId] || 0;
    }
    const walletBalance = (balances as Balances)[balanceKey];
    return typeof walletBalance === 'string' ? parseFloat(walletBalance) || 0 : walletBalance || 0;
  };

  const balance0 = getBalance(asset0, asset0BalanceKey);
  const balance1 = getBalance(asset1, asset1BalanceKey);

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

        {/* Warning when using native HEZ and Asset Hub balance is low */}
        {asset0 === -1 && assetHubNativeBalance < 0.1 && (
          <Alert className="mb-4 bg-orange-900/20 border-orange-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Low Asset Hub Balance:</strong> You have {assetHubNativeBalance.toFixed(4)} HEZ on Asset Hub.
              The DEX requires HEZ on Asset Hub. Use XCM transfer from relay chain if needed.
            </AlertDescription>
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
              Add liquidity to earn 0.3% fees from all swaps. Amounts are auto-calculated based on current pool ratio.
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
