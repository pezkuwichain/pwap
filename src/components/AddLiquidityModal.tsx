import React, { useState, useEffect } from 'react';
import { X, Plus, Info, AlertCircle } from 'lucide-react';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({ isOpen, onClose }) => {
  const { api, selectedAccount, isApiReady } = usePolkadot();
  const { balances, refreshBalances } = useWallet();

  const [whezAmount, setWhezAmount] = useState('');
  const [pezAmount, setPezAmount] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current pool price
  useEffect(() => {
    if (!api || !isApiReady || !isOpen) return;

    const fetchPoolPrice = async () => {
      try {
        const asset1 = 0; // wHEZ
        const asset2 = 1; // PEZ

        const poolId = [asset1, asset2];
        const poolInfo = await api.query.assetConversion.pools(poolId);

        if (poolInfo.isSome) {
          // Derive pool account using AccountIdConverter
          const { stringToU8a } = await import('@polkadot/util');
          const { blake2AsU8a } = await import('@polkadot/util-crypto');

          // PalletId for AssetConversion: "py/ascon" (8 bytes)
          const PALLET_ID = stringToU8a('py/ascon');

          // Create PoolId tuple (u32, u32)
          const poolIdType = api.createType('(u32, u32)', [asset1, asset2]);

          // Create (PalletId, PoolId) tuple: ([u8; 8], (u32, u32))
          const palletIdType = api.createType('[u8; 8]', PALLET_ID);
          const fullTuple = api.createType('([u8; 8], (u32, u32))', [palletIdType, poolIdType]);

          // Hash the SCALE-encoded tuple
          const accountHash = blake2AsU8a(fullTuple.toU8a(), 256);
          const poolAccountId = api.createType('AccountId32', accountHash);

          // Get reserves
          const whezBalanceData = await api.query.assets.account(asset1, poolAccountId);
          const pezBalanceData = await api.query.assets.account(asset2, poolAccountId);

          if (whezBalanceData.isSome && pezBalanceData.isSome) {
            const whezData = whezBalanceData.unwrap().toJSON() as any;
            const pezData = pezBalanceData.unwrap().toJSON() as any;

            const reserve0 = Number(whezData.balance) / 1e12;
            const reserve1 = Number(pezData.balance) / 1e12;

            setCurrentPrice(reserve1 / reserve0);
          }
        }
      } catch (err) {
        console.error('Error fetching pool price:', err);
      }
    };

    fetchPoolPrice();
  }, [api, isApiReady, isOpen]);

  // Auto-calculate PEZ amount based on wHEZ input
  useEffect(() => {
    if (whezAmount && currentPrice) {
      const calculatedPez = parseFloat(whezAmount) * currentPrice;
      setPezAmount(calculatedPez.toFixed(4));
    } else if (!whezAmount) {
      setPezAmount('');
    }
  }, [whezAmount, currentPrice]);

  const handleAddLiquidity = async () => {
    if (!api || !selectedAccount || !whezAmount || !pezAmount) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate amounts
      if (parseFloat(whezAmount) <= 0 || parseFloat(pezAmount) <= 0) {
        setError('Please enter valid amounts');
        setIsLoading(false);
        return;
      }

      if (parseFloat(whezAmount) > whezBalance) {
        setError('Insufficient HEZ balance');
        setIsLoading(false);
        return;
      }

      if (parseFloat(pezAmount) > pezBalance) {
        setError('Insufficient PEZ balance');
        setIsLoading(false);
        return;
      }

      // Get the signer from the extension
      const injector = await web3FromAddress(selectedAccount.address);

      const whezAmountBN = BigInt(Math.floor(parseFloat(whezAmount) * 1e12));
      const pezAmountBN = BigInt(Math.floor(parseFloat(pezAmount) * 1e12));

      // Min amounts (90% of desired to account for slippage - more tolerance for AMM)
      const minWhezBN = (whezAmountBN * BigInt(90)) / BigInt(100);
      const minPezBN = (pezAmountBN * BigInt(90)) / BigInt(100);

      // Need to wrap HEZ to wHEZ first
      const wrapTx = api.tx.tokenWrapper.wrap(whezAmountBN.toString());

      // Add liquidity transaction
      const addLiquidityTx = api.tx.assetConversion.addLiquidity(
        0, // asset1 (wHEZ)
        1, // asset2 (PEZ)
        whezAmountBN.toString(),
        pezAmountBN.toString(),
        minWhezBN.toString(),
        minPezBN.toString(),
        selectedAccount.address
      );

      // Batch transactions
      const tx = api.tx.utility.batchAll([wrapTx, addLiquidityTx]);

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

              // Also check events for more details
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
              setWhezAmount('');
              setPezAmount('');
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

  const whezBalance = balances.HEZ || 0;
  const pezBalance = balances.PEZ || 0;

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
            Add liquidity to earn 3% fees from all swaps. Your HEZ will be automatically wrapped to wHEZ.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* HEZ Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              HEZ Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={whezAmount}
                onChange={(e) => setWhezAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="text-gray-400 text-sm">HEZ</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Balance: {whezBalance.toLocaleString()}</span>
              <button
                onClick={() => setWhezAmount(whezBalance.toString())}
                className="text-blue-400 hover:text-blue-300"
              >
                Max
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <Plus className="w-5 h-5 text-gray-400" />
          </div>

          {/* PEZ Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PEZ Amount (Auto-calculated)
            </label>
            <div className="relative">
              <input
                type="number"
                value={pezAmount}
                placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-400 focus:outline-none cursor-not-allowed"
                disabled={true}
                readOnly
              />
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="text-gray-400 text-sm">PEZ</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Balance: {pezBalance.toLocaleString()}</span>
              <span>
                {currentPrice && `Rate: 1 HEZ = ${currentPrice.toFixed(4)} PEZ`}
              </span>
            </div>
          </div>

          {/* Price Info */}
          {whezAmount && pezAmount && (
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
              !whezAmount ||
              !pezAmount ||
              parseFloat(whezAmount) > whezBalance ||
              parseFloat(pezAmount) > pezBalance
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
