import React, { useState, useEffect } from 'react';
import { X, Plus, Info, AlertCircle } from 'lucide-react';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ASSET_IDS, getAssetSymbol } from '@/lib/wallet';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset0?: number;  // Pool's first asset ID
  asset1?: number;  // Pool's second asset ID
}

// Helper to get display name (users see HEZ not wHEZ, PEZ, USDT not wUSDT)
const getDisplayName = (assetId: number): string => {
  if (assetId === ASSET_IDS.WHEZ || assetId === 0) return 'HEZ';
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 2) return 'USDT';
  return getAssetSymbol(assetId);
};

// Helper to get balance key for the asset
const getBalanceKey = (assetId: number): string => {
  if (assetId === ASSET_IDS.WHEZ || assetId === 0) return 'HEZ';
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 2) return 'USDT';
  return getAssetSymbol(assetId);
};

// Helper to get decimals for asset
const getAssetDecimals = (assetId: number): number => {
  if (assetId === ASSET_IDS.WUSDT || assetId === 2) return 6; // wUSDT has 6 decimals
  return 12; // wHEZ, PEZ have 12 decimals
};

export const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  isOpen,
  onClose,
  asset0 = 0,  // Default to wHEZ
  asset1 = 1   // Default to PEZ
}) => {
  const { api, selectedAccount, isApiReady } = usePolkadot();
  const { balances, refreshBalances } = useWallet();

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
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

  // Fetch current pool price
  useEffect(() => {
    if (!api || !isApiReady || !isOpen) return;

    const fetchPoolPrice = async () => {
      try {
        const poolId = [asset0, asset1];
        const poolInfo = await api.query.assetConversion.pools(poolId);

        if (poolInfo.isSome) {
          // Derive pool account using AccountIdConverter
          const { stringToU8a } = await import('@polkadot/util');
          const { blake2AsU8a } = await import('@polkadot/util-crypto');

          const PALLET_ID = stringToU8a('py/ascon');
          const poolIdType = api.createType('(u32, u32)', [asset0, asset1]);
          const palletIdType = api.createType('[u8; 8]', PALLET_ID);
          const fullTuple = api.createType('([u8; 8], (u32, u32))', [palletIdType, poolIdType]);

          const accountHash = blake2AsU8a(fullTuple.toU8a(), 256);
          const poolAccountId = api.createType('AccountId32', accountHash);

          // Get reserves
          const balance0Data = await api.query.assets.account(asset0, poolAccountId);
          const balance1Data = await api.query.assets.account(asset1, poolAccountId);

          if (balance0Data.isSome && balance1Data.isSome) {
            const data0 = balance0Data.unwrap().toJSON() as any;
            const data1 = balance1Data.unwrap().toJSON() as any;

            const reserve0 = Number(data0.balance) / Math.pow(10, asset0Decimals);
            const reserve1 = Number(data1.balance) / Math.pow(10, asset1Decimals);

            setCurrentPrice(reserve1 / reserve0);
          }
        }
      } catch (err) {
        console.error('Error fetching pool price:', err);
      }
    };

    fetchPoolPrice();
  }, [api, isApiReady, isOpen, asset0, asset1, asset0Decimals, asset1Decimals]);

  // Auto-calculate asset1 amount based on asset0 input
  useEffect(() => {
    if (amount0 && currentPrice) {
      const calculated = parseFloat(amount0) * currentPrice;
      setAmount1(calculated.toFixed(asset1Decimals === 6 ? 2 : 4));
    } else if (!amount0) {
      setAmount1('');
    }
  }, [amount0, currentPrice, asset1Decimals]);

  const handleAddLiquidity = async () => {
    if (!api || !selectedAccount || !amount0 || !amount1) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate amounts
      if (parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
        setError('Please enter valid amounts');
        setIsLoading(false);
        return;
      }

      const balance0 = (balances as any)[asset0BalanceKey] || 0;
      const balance1 = (balances as any)[asset1BalanceKey] || 0;

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

      // Build transaction(s)
      let tx;

      // If asset0 is HEZ (0), need to wrap it first
      if (asset0 === 0 || asset0 === ASSET_IDS.WHEZ) {
        const wrapTx = api.tx.tokenWrapper.wrap(amount0BN.toString());

        const addLiquidityTx = api.tx.assetConversion.addLiquidity(
          asset0,
          asset1,
          amount0BN.toString(),
          amount1BN.toString(),
          minAmount0BN.toString(),
          minAmount1BN.toString(),
          selectedAccount.address
        );

        // Batch wrap + add liquidity
        tx = api.tx.utility.batchAll([wrapTx, addLiquidityTx]);
      } else {
        // Direct add liquidity (no wrapping needed)
        tx = api.tx.assetConversion.addLiquidity(
          asset0,
          asset1,
          amount0BN.toString(),
          amount1BN.toString(),
          minAmount0BN.toString(),
          minAmount1BN.toString(),
          selectedAccount.address
        );
      }

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events, dispatchError }) => {
          if (status.isInBlock) {
            console.log('Transaction in block:', status.asInBlock.toHex());
          } else if (status.isFinalized) {
            console.log('Transaction finalized:', status.asFinalized.toHex());

            // Check for errors
            const hasError = events.some(({ event }) =>
              api.events.system.ExtrinsicFailed.is(event)
            );

            if (hasError || dispatchError) {
              let errorMessage = 'Transaction failed';

              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  const { docs, name, section } = decoded;
                  errorMessage = `${section}.${name}: ${docs.join(' ')}`;
                  console.error('Dispatch error:', errorMessage);
                } else {
                  errorMessage = dispatchError.toString();
                  console.error('Dispatch error:', errorMessage);
                }
              }

              events.forEach(({ event }) => {
                if (api.events.system.ExtrinsicFailed.is(event)) {
                  console.error('ExtrinsicFailed event:', event.toHuman());
                }
              });

              setError(errorMessage);
              setIsLoading(false);
            } else {
              console.log('Transaction successful');
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
      console.error('Error adding liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to add liquidity');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const balance0 = (balances as any)[asset0BalanceKey] || 0;
  const balance1 = (balances as any)[asset1BalanceKey] || 0;

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

        <Alert className="mb-4 bg-blue-900/20 border-blue-500">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Add liquidity to earn 3% fees from all swaps.
            {(asset0 === 0 || asset0 === ASSET_IDS.WHEZ) && ' Your HEZ will be automatically wrapped to wHEZ.'}
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Asset 0 Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {asset0Name} Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                placeholder="0.0"
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
              {asset1Name} Amount (Auto-calculated)
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount1}
                placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-400 focus:outline-none cursor-not-allowed"
                disabled={true}
                readOnly
              />
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="text-gray-400 text-sm">{asset1Name}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Balance: {balance1.toLocaleString()}</span>
              <span>
                {currentPrice && `Rate: 1 ${asset0Name} = ${currentPrice.toFixed(asset1Decimals === 6 ? 2 : 4)} ${asset1Name}`}
              </span>
            </div>
          </div>

          {/* Price Info */}
          {amount0 && amount1 && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Share of Pool</span>
                <span>~0.1%</span>
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
