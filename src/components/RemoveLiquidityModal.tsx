import React, { useState } from 'react';
import { X, Minus, AlertCircle, Info } from 'lucide-react';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RemoveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lpPosition: {
    lpTokenBalance: number;
    share: number;
    asset0Amount: number;
    asset1Amount: number;
  };
  lpTokenId: number;
}

export const RemoveLiquidityModal: React.FC<RemoveLiquidityModalProps> = ({
  isOpen,
  onClose,
  lpPosition,
  lpTokenId,
}) => {
  const { api, selectedAccount } = usePolkadot();
  const { refreshBalances } = useWallet();

  const [percentage, setPercentage] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRemoveLiquidity = async () => {
    if (!api || !selectedAccount) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get the signer from the extension
      const injector = await web3FromAddress(selectedAccount.address);

      // Calculate LP tokens to remove
      const lpToRemove = (lpPosition.lpTokenBalance * percentage) / 100;
      const lpToRemoveBN = BigInt(Math.floor(lpToRemove * 1e12));

      // Calculate expected token amounts (with 95% slippage tolerance)
      const expectedWhezBN = BigInt(Math.floor((lpPosition.asset0Amount * percentage) / 100 * 1e12));
      const expectedPezBN = BigInt(Math.floor((lpPosition.asset1Amount * percentage) / 100 * 1e12));

      const minWhezBN = (expectedWhezBN * BigInt(95)) / BigInt(100);
      const minPezBN = (expectedPezBN * BigInt(95)) / BigInt(100);

      // Remove liquidity transaction
      const removeLiquidityTx = api.tx.assetConversion.removeLiquidity(
        0, // asset1 (wHEZ)
        1, // asset2 (PEZ)
        lpToRemoveBN.toString(),
        minWhezBN.toString(),
        minPezBN.toString(),
        selectedAccount.address
      );

      // Unwrap wHEZ back to HEZ
      const unwrapTx = api.tx.tokenWrapper.unwrap(minWhezBN.toString());

      // Batch transactions
      const tx = api.tx.utility.batchAll([removeLiquidityTx, unwrapTx]);

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            console.log('Transaction in block');
          } else if (status.isFinalized) {
            console.log('Transaction finalized');

            // Check for errors
            const hasError = events.some(({ event }) =>
              api.events.system.ExtrinsicFailed.is(event)
            );

            if (hasError) {
              setError('Transaction failed');
              setIsLoading(false);
            } else {
              setSuccess(true);
              setIsLoading(false);
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
      console.error('Error removing liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove liquidity');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const whezToReceive = (lpPosition.asset0Amount * percentage) / 100;
  const pezToReceive = (lpPosition.asset1Amount * percentage) / 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Remove Liquidity</h2>
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
            <AlertDescription>Liquidity removed successfully!</AlertDescription>
          </Alert>
        )}

        <Alert className="mb-4 bg-blue-900/20 border-blue-500">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Remove your liquidity to receive back your tokens. wHEZ will be automatically unwrapped to HEZ.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Percentage Selector */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Amount to Remove</label>
              <span className="text-2xl font-bold text-white">{percentage}%</span>
            </div>

            <input
              type="range"
              min="1"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              disabled={isLoading}
            />

            <div className="flex justify-between mt-2">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setPercentage(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    percentage === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={isLoading}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* You Will Receive */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-300 mb-2">You Will Receive</h3>

            <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-xs text-gray-400">HEZ</p>
                <p className="text-xl font-bold text-white">
                  {whezToReceive.toFixed(4)}
                </p>
              </div>
              <Minus className="w-5 h-5 text-gray-400" />
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-xs text-gray-400">PEZ</p>
                <p className="text-xl font-bold text-white">
                  {pezToReceive.toFixed(4)}
                </p>
              </div>
              <Minus className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* LP Token Info */}
          <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>LP Tokens to Burn</span>
              <span>{((lpPosition.lpTokenBalance * percentage) / 100).toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Remaining LP Tokens</span>
              <span>
                {((lpPosition.lpTokenBalance * (100 - percentage)) / 100).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Slippage Tolerance</span>
              <span>5%</span>
            </div>
          </div>

          <Button
            onClick={handleRemoveLiquidity}
            disabled={isLoading || percentage === 0}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 h-12"
          >
            {isLoading ? 'Removing Liquidity...' : 'Remove Liquidity'}
          </Button>
        </div>
      </div>
    </div>
  );
};
