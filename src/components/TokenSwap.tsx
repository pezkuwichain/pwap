import React, { useState, useEffect } from 'react';
import { ArrowDownUp, Settings, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { ASSET_IDS, formatBalance, parseAmount } from '@/lib/wallet';
import { useToast } from '@/hooks/use-toast';

const TokenSwap = () => {
  const { api, isApiReady, selectedAccount } = usePolkadot();
  const { toast } = useToast();
  
  const [fromToken, setFromToken] = useState('PEZ');
  const [toToken, setToToken] = useState('HEZ');
  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // DEX availability check
  const [isDexAvailable, setIsDexAvailable] = useState(false);

  // Real balances from blockchain
  const [fromBalance, setFromBalance] = useState('0');
  const [toBalance, setToBalance] = useState('0');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // Liquidity pool data
  const [liquidityPools, setLiquidityPools] = useState<any[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  const toAmount = fromAmount && exchangeRate > 0 
    ? (parseFloat(fromAmount) * exchangeRate).toFixed(4) 
    : '';

  // Check if AssetConversion pallet is available
  useEffect(() => {
    if (api && isApiReady) {
      const hasAssetConversion = api.tx.assetConversion !== undefined;
      setIsDexAvailable(hasAssetConversion);
      
      if (!hasAssetConversion) {
        console.warn('AssetConversion pallet not available in runtime');
      }
    }
  }, [api, isApiReady]);

  // Fetch balances from blockchain
  useEffect(() => {
    const fetchBalances = async () => {
      if (!api || !isApiReady || !selectedAccount) {
        return;
      }

      setIsLoadingBalances(true);
      try {
        const fromAssetId = ASSET_IDS[fromToken as keyof typeof ASSET_IDS];
        const toAssetId = ASSET_IDS[toToken as keyof typeof ASSET_IDS];

        // Fetch balances from Assets pallet
        const [fromAssetBalance, toAssetBalance] = await Promise.all([
          api.query.assets.account(fromAssetId, selectedAccount.address),
          api.query.assets.account(toAssetId, selectedAccount.address),
        ]);

        // Format balances (12 decimals for PEZ/HEZ tokens)
        const fromBal = fromAssetBalance.toJSON() as any;
        const toBal = toAssetBalance.toJSON() as any;

        setFromBalance(fromBal ? formatBalance(fromBal.balance.toString(), 12) : '0');
        setToBalance(toBal ? formatBalance(toBal.balance.toString(), 12) : '0');
      } catch (error) {
        console.error('Failed to fetch balances:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch token balances',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingBalances(false);
      }
    };

    fetchBalances();
  }, [api, isApiReady, selectedAccount, fromToken, toToken, toast]);

  // Fetch exchange rate from AssetConversion pool
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (!api || !isApiReady || !isDexAvailable) {
        return;
      }

      setIsLoadingRate(true);
      try {
        const fromAssetId = ASSET_IDS[fromToken as keyof typeof ASSET_IDS];
        const toAssetId = ASSET_IDS[toToken as keyof typeof ASSET_IDS];

        // Create pool asset tuple [asset1, asset2]
        const poolAssets = [
          { NativeOrAsset: { Asset: fromAssetId } },
          { NativeOrAsset: { Asset: toAssetId } }
        ];

        // Query pool from AssetConversion pallet
        const poolInfo = await api.query.assetConversion.pools(poolAssets);

        if (poolInfo && !poolInfo.isEmpty) {
          const pool = poolInfo.toJSON() as any;
          
          if (pool && pool[0] && pool[1]) {
            // Pool structure: [reserve0, reserve1]
            const reserve0 = parseFloat(pool[0].toString());
            const reserve1 = parseFloat(pool[1].toString());
            
            // Calculate exchange rate
            const rate = reserve1 / reserve0;
            setExchangeRate(rate);
          } else {
            console.warn('Pool has no reserves');
            setExchangeRate(0);
          }
        } else {
          console.warn('No liquidity pool found for this pair');
          setExchangeRate(0);
        }
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        setExchangeRate(0);
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchExchangeRate();
  }, [api, isApiReady, isDexAvailable, fromToken, toToken]);

  // Fetch liquidity pools
  useEffect(() => {
    const fetchLiquidityPools = async () => {
      if (!api || !isApiReady || !isDexAvailable) {
        return;
      }

      setIsLoadingPools(true);
      try {
        // Query all pools from AssetConversion pallet
        const poolsEntries = await api.query.assetConversion.pools.entries();

        if (poolsEntries && poolsEntries.length > 0) {
          const pools = poolsEntries.map(([key, value]: any) => {
            const poolData = value.toJSON();
            const poolKey = key.toHuman();
            
            // Calculate TVL from reserves
            const tvl = poolData && poolData[0] && poolData[1]
              ? ((parseFloat(poolData[0]) + parseFloat(poolData[1])) / 1e12).toFixed(2)
              : '0';
            
            // Parse asset IDs from pool key
            const assets = poolKey?.[0] || [];
            const asset1 = assets[0]?.NativeOrAsset?.Asset || '?';
            const asset2 = assets[1]?.NativeOrAsset?.Asset || '?';
            
            return {
              pool: `Asset ${asset1} / Asset ${asset2}`,
              tvl: `$${tvl}M`,
              apr: 'TBD', // Requires historical data
              volume: 'TBD', // Requires event indexing
            };
          });

          setLiquidityPools(pools.slice(0, 3));
        } else {
          setLiquidityPools([]);
        }
      } catch (error) {
        console.error('Failed to fetch liquidity pools:', error);
        setLiquidityPools([]);
      } finally {
        setIsLoadingPools(false);
      }
    };

    fetchLiquidityPools();
  }, [api, isApiReady, isDexAvailable]);

  const handleSwap = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
  };

  const handleConfirmSwap = async () => {
    if (!api || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    if (!isDexAvailable) {
      toast({
        title: 'DEX Not Available',
        description: 'AssetConversion pallet is not enabled in runtime',
        variant: 'destructive',
      });
      return;
    }

    if (!exchangeRate || exchangeRate === 0) {
      toast({
        title: 'Error',
        description: 'No liquidity pool available for this pair',
        variant: 'destructive',
      });
      return;
    }

    setIsSwapping(true);
    try {
      const fromAssetId = ASSET_IDS[fromToken as keyof typeof ASSET_IDS];
      const toAssetId = ASSET_IDS[toToken as keyof typeof ASSET_IDS];
      const amountIn = parseAmount(fromAmount, 12);
      
      // Calculate minimum amount out based on slippage
      const minAmountOut = parseAmount(
        (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toString(),
        12
      );

      // Create path for swap
      const path = [
        { NativeOrAsset: { Asset: fromAssetId } },
        { NativeOrAsset: { Asset: toAssetId } }
      ];

      // Get signer from extension
      const { web3FromAddress } = await import('@polkadot/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      // Submit swap transaction to AssetConversion pallet
      const tx = api.tx.assetConversion.swapExactTokensForTokens(
        path,
        amountIn.toString(),
        minAmountOut.toString(),
        selectedAccount.address,
        true // keep_alive
      );

      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            console.log('Swap in block:', status.asInBlock.toHex());
            
            toast({
              title: 'Transaction Submitted',
              description: `Swap in block ${status.asInBlock.toHex().slice(0, 10)}...`,
            });
          }

          if (status.isFinalized) {
            console.log('Swap finalized:', status.asFinalized.toHex());
            
            // Check for successful swap event
            const swapEvent = events.find(({ event }) =>
              api.events.assetConversion?.SwapExecuted?.is(event)
            );

            if (swapEvent) {
              toast({
                title: 'Success!',
                description: `Swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`,
              });

              setShowConfirm(false);
              setFromAmount('');
              
              // Refresh balances
              window.location.reload();
            } else {
              toast({
                title: 'Error',
                description: 'Swap transaction failed',
                variant: 'destructive',
              });
            }
            
            setIsSwapping(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Swap failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Swap transaction failed',
        variant: 'destructive',
      });
      setIsSwapping(false);
    }
  };

  // Show DEX unavailable message
  if (!isDexAvailable && isApiReady) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-yellow-500/10 rounded-full">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">DEX Coming Soon</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                The AssetConversion pallet is not yet enabled in the runtime. 
                Token swapping functionality will be available after the next runtime upgrade.
              </p>
            </div>

            <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
              Scheduled for Next Runtime Upgrade
            </Badge>

            <div className="pt-4">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Token Swap</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>

          {!selectedAccount && (
            <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-300">
                Please connect your wallet to swap tokens
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-gray-900">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-900">From</span>
                <span className="text-sm text-gray-900">
                  Balance: {isLoadingBalances ? '...' : fromBalance} {fromToken}
                </span>
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  className="text-2xl font-bold border-0 bg-transparent"
                  disabled={!selectedAccount}
                />
                <Button variant="outline" className="min-w-[100px]">
                  {fromToken === 'PEZ' ? '🟣 PEZ' : '🟡 HEZ'}
                </Button>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwap}
                className="rounded-full bg-white border-2"
                disabled={!selectedAccount}
              >
                <ArrowDownUp className="h-5 w-5" />
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-gray-900">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-900">To</span>
                <span className="text-sm text-gray-900">
                  Balance: {isLoadingBalances ? '...' : toBalance} {toToken}
                </span>
              </div>
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.0"
                  className="text-2xl font-bold border-0 bg-transparent"
                />
                <Button variant="outline" className="min-w-[100px]">
                  {toToken === 'PEZ' ? '🟣 PEZ' : '🟡 HEZ'}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-gray-900">
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Exchange Rate</span>
                <span className="font-semibold text-gray-900">
                  {isLoadingRate ? (
                    'Loading...'
                  ) : exchangeRate > 0 ? (
                    `1 ${fromToken} = ${exchangeRate.toFixed(4)} ${toToken}`
                  ) : (
                    'No pool available'
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-900">Slippage Tolerance</span>
                <span className="font-semibold text-gray-900">{slippage}%</span>
              </div>
            </div>

            <Button
              className="w-full h-12 text-lg"
              onClick={() => setShowConfirm(true)}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || !selectedAccount || exchangeRate === 0}
            >
              {!selectedAccount ? 'Connect Wallet' : exchangeRate === 0 ? 'No Pool Available' : 'Swap Tokens'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Liquidity Pools
          </h3>
          
          {isLoadingPools ? (
            <div className="text-center text-gray-500 py-8">Loading pools...</div>
          ) : liquidityPools.length > 0 ? (
            <div className="space-y-3">
              {liquidityPools.map((pool, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-gray-900">
                  <div>
                    <div className="font-semibold text-gray-900">{pool.pool}</div>
                    <div className="text-sm text-gray-900">TVL: {pool.tvl}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-600 font-semibold">{pool.apr} APR</div>
                    <div className="text-sm text-gray-900">Vol: {pool.volume}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No liquidity pools available yet
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Swaps
          </h3>
          
          <div className="text-center text-gray-500 py-8">
            {selectedAccount ? 'No swap history yet' : 'Connect wallet to view history'}
          </div>
        </Card>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Slippage Tolerance</label>
              <div className="flex gap-2 mt-2">
                {['0.1', '0.5', '1.0'].map(val => (
                  <Button
                    key={val}
                    variant={slippage === val ? 'default' : 'outline'}
                    onClick={() => setSlippage(val)}
                    className="flex-1"
                  >
                    {val}%
                  </Button>
                ))}
                <Input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Swap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg text-gray-900">
              <div className="flex justify-between mb-2">
                <span className="text-gray-900">You Pay</span>
                <span className="font-bold text-gray-900">{fromAmount} {fromToken}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-900">You Receive</span>
                <span className="font-bold text-gray-900">{toAmount} {toToken}</span>
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t text-sm">
                <span className="text-gray-600">Exchange Rate</span>
                <span className="text-gray-600">1 {fromToken} = {exchangeRate.toFixed(4)} {toToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Slippage</span>
                <span className="text-gray-600">{slippage}%</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleConfirmSwap}
              disabled={isSwapping}
            >
              {isSwapping ? 'Swapping...' : 'Confirm Swap'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokenSwap;