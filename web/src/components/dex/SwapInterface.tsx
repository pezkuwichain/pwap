import React, { useState, useEffect, useCallback } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { ArrowDownUp, AlertCircle, Loader2, Info, Settings, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PoolInfo } from '@/types/dex';
import {
  parseTokenInput,
  formatTokenBalance,
  formatAssetLocation,
} from '@pezkuwi/utils/dex';
import { getAllPrices, calculateOracleSwap, formatUsdPrice } from '@pezkuwi/lib/priceOracle';
import { useToast } from '@/hooks/use-toast';

interface SwapInterfaceProps {
  initialPool?: PoolInfo | null;
  pools: PoolInfo[];
}

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

// User-facing tokens - All pairs go through USDT
const USER_TOKENS = [
  { symbol: 'HEZ', emoji: '🟡', assetId: -1, name: 'HEZ', decimals: 12, displaySymbol: 'HEZ', logo: '/shared/images/hez_token_512.png' },
  { symbol: 'USDT', emoji: '💵', assetId: 1000, name: 'USDT', decimals: 6, displaySymbol: 'USDT', logo: '/shared/images/USDT(hez)logo.png' },
  { symbol: 'DOT', emoji: '🔴', assetId: 1001, name: 'DOT', decimals: 10, displaySymbol: 'DOT', logo: '/shared/images/dot.png' },
  { symbol: 'ETH', emoji: '💎', assetId: 1002, name: 'ETH', decimals: 18, displaySymbol: 'ETH', logo: '/shared/images/etherium.png' },
  { symbol: 'BTC', emoji: '🟠', assetId: 1003, name: 'BTC', decimals: 8, displaySymbol: 'BTC', logo: '/shared/images/bitcoin.png' },
] as const;

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ pools }) => {
  // Use Asset Hub API for DEX operations
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const { account, signer } = useWallet();
  const { toast } = useToast();

  const [fromToken, setFromToken] = useState('HEZ');
  const [toToken, setToToken] = useState('PEZ');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5% default
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fromBalance, setFromBalance] = useState<string>('0');
  const [toBalance, setToBalance] = useState<string>('0');

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Oracle prices state
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [swapRoute, setSwapRoute] = useState<string[]>([]);

  // Fetch oracle prices
  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const fetchedPrices = await getAllPrices();
      setPrices(fetchedPrices);
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
    setPricesLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices();
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Get asset IDs (for pool lookup)
  const getAssetId = (symbol: string) => {
    const token = USER_TOKENS.find(t => t.symbol === symbol);
    return token?.assetId ?? null;
  };

  const fromAssetId = getAssetId(fromToken);
  const toAssetId = getAssetId(toToken);

  // Find active pool for selected pair
  const activePool = pools.find(
    (p) =>
      (p.asset1 === fromAssetId && p.asset2 === toAssetId) ||
      (p.asset1 === toAssetId && p.asset2 === fromAssetId)
  );

  // Get token info
  const fromTokenInfo = USER_TOKENS.find(t => t.symbol === fromToken);
  const toTokenInfo = USER_TOKENS.find(t => t.symbol === toToken);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!assetHubApi || !isAssetHubReady || !account) return;

      // For HEZ, fetch native balance (not wHEZ asset balance)
      if (fromToken === 'HEZ') {
        try {
          const balance = await assetHubApi.query.system.account(account);
          const freeBalance = balance.data.free.toString();
          setFromBalance(freeBalance);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to fetch HEZ balance:', error);
          setFromBalance('0');
        }
      } else if (fromAssetId !== null) {
        try {
          const balanceData = await assetHubApi.query.assets.account(fromAssetId, account);
          setFromBalance(balanceData.isSome ? balanceData.unwrap().balance.toString() : '0');
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to fetch from balance:', error);
          setFromBalance('0');
        }
      }

      // For HEZ, fetch native balance
      if (toToken === 'HEZ') {
        try {
          const balance = await assetHubApi.query.system.account(account);
          const freeBalance = balance.data.free.toString();
          setToBalance(freeBalance);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to fetch HEZ balance:', error);
          setToBalance('0');
        }
      } else if (toAssetId !== null) {
        try {
          const balanceData = await assetHubApi.query.assets.account(toAssetId, account);
          setToBalance(balanceData.isSome ? balanceData.unwrap().balance.toString() : '0');
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to fetch to balance:', error);
          setToBalance('0');
        }
      }
    };

    fetchBalances();
  }, [assetHubApi, isAssetHubReady, account, fromToken, toToken, fromAssetId, toAssetId]);

  // Calculate output amount using Oracle prices
  useEffect(() => {
    const calculateSwap = async () => {
      if (!fromAmount || !fromTokenInfo || !toTokenInfo || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        setSwapRoute([]);
        return;
      }

      try {
        const result = await calculateOracleSwap(
          fromToken,
          toToken,
          parseFloat(fromAmount),
          0.3 // 0.3% fee per hop
        );

        if (result) {
          // Format output based on decimals
          const formattedOutput = result.toAmount.toFixed(
            toTokenInfo.decimals > 6 ? 6 : toTokenInfo.decimals
          );
          setToAmount(formattedOutput);
          setSwapRoute(result.route);
        } else {
          setToAmount('');
          setSwapRoute([]);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to calculate swap:', error);
        setToAmount('');
        setSwapRoute([]);
      }
    };

    calculateSwap();
  }, [fromAmount, fromToken, toToken, fromTokenInfo, toTokenInfo, prices]);

  // Get oracle exchange rate
  const oracleRate = React.useMemo(() => {
    const fromPrice = prices[fromToken];
    const toPrice = prices[toToken];
    if (!fromPrice || !toPrice) return null;
    return fromPrice / toPrice;
  }, [prices, fromToken, toToken]);

  // Check if user has insufficient balance
  const hasInsufficientBalance = React.useMemo(() => {
    const fromAmountNum = parseFloat(fromAmount || '0');
    const fromBalanceNum = parseFloat(formatTokenBalance(fromBalance, fromTokenInfo?.decimals ?? 12, 6));
    return fromAmountNum > 0 && fromAmountNum > fromBalanceNum;
  }, [fromAmount, fromBalance, fromTokenInfo]);

  const handleSwapDirection = () => {
    const tempToken = fromToken;
    const tempBalance = fromBalance;

    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setFromBalance(toBalance);
    setToBalance(tempBalance);
  };

  const handleMaxClick = () => {
    if (fromTokenInfo) {
      const maxAmount = formatTokenBalance(fromBalance, fromTokenInfo.decimals, 6);
      setFromAmount(maxAmount);
    }
  };

  const handleConfirmSwap = async () => {
    if (!assetHubApi || !signer || !account || !fromTokenInfo || !toTokenInfo) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    if (!activePool) {
      toast({
        title: 'Error',
        description: 'No liquidity pool available for this pair',
        variant: 'destructive',
      });
      return;
    }

    setTxStatus('signing');
    setShowConfirm(false);
    setErrorMessage('');

    try {
      const amountIn = parseTokenInput(fromAmount, fromTokenInfo.decimals);
      const minAmountOut = parseTokenInput(
        (parseFloat(toAmount) * (1 - slippage / 100)).toString(),
        toTokenInfo.decimals
      );

      if (import.meta.env.DEV) console.log('💰 Swap transaction:', {
        from: fromToken,
        to: toToken,
        amount: fromAmount,
        minOut: minAmountOut.toString(),
      });

      // XCM Locations for all supported tokens
      const nativeLocation = formatAssetLocation(-1);    // HEZ (native)
      const usdtLocation = formatAssetLocation(1000);    // wUSDT
      const wdotLocation = formatAssetLocation(1001);    // wDOT
      const wethLocation = formatAssetLocation(1002);    // wETH
      const wbtcLocation = formatAssetLocation(1003);    // wBTC

      // Build swap path - all pairs go through USDT
      const getLocation = (symbol: string) => {
        switch (symbol) {
          case 'HEZ': return nativeLocation;
          case 'USDT': return usdtLocation;
          case 'DOT': return wdotLocation;
          case 'ETH': return wethLocation;
          case 'BTC': return wbtcLocation;
          default: return formatAssetLocation(fromAssetId!);
        }
      };

      const fromLocation = getLocation(fromToken);
      const toLocation = getLocation(toToken);

      // Determine swap path based on route
      let swapPath: unknown[];

      if (fromToken === 'USDT' || toToken === 'USDT') {
        // Direct swap with USDT
        swapPath = [fromLocation, toLocation];
      } else {
        // Multi-hop through USDT: X → USDT → Y
        swapPath = [fromLocation, usdtLocation, toLocation];
      }

      if (import.meta.env.DEV) console.log('Swap path:', swapRoute, swapPath);

      const tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
        swapPath,
        amountIn.toString(),
        minAmountOut.toString(),
        account,
        true
      );

      setTxStatus('submitting');

      await tx.signAndSend(
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
              toast({
                title: 'Transaction Failed',
                description: errorMessage,
                variant: 'destructive',
              });
            } else {
              setTxStatus('success');
              toast({
                title: 'Success!',
                description: `Swapped ${fromAmount} ${fromToken} for ~${toAmount} ${toToken}`,
              });
              setTimeout(() => {
                setFromAmount('');
                setToAmount('');
                setTxStatus('idle');
              }, 2000);
            }
          }
        }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error('Swap failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Transaction failed');
      setTxStatus('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Swap transaction failed',
        variant: 'destructive',
      });
    }
  };

  // Exchange rate from oracle
  const exchangeRate = oracleRate ? oracleRate.toFixed(6) : '0';

  return (
    <div className="max-w-lg mx-auto">
      {/* Transaction Loading Overlay */}
      {(txStatus === 'signing' || txStatus === 'submitting') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-green-400" />
            <p className="text-white text-xl font-semibold">
              {txStatus === 'signing' ? 'Waiting for signature...' : 'Processing swap...'}
            </p>
          </div>
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white">Swap Tokens</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5 text-gray-400" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {!account && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-300">
                Please connect your wallet to swap tokens
              </AlertDescription>
            </Alert>
          )}

          {/* From Token */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">From</span>
              <span className="text-gray-400">
                Balance: {formatTokenBalance(fromBalance, fromTokenInfo?.decimals ?? 12, 4)} {fromToken}
              </span>
            </div>

            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  className="text-2xl font-bold border-0 bg-transparent text-white placeholder:text-gray-600 focus-visible:ring-0"
                  disabled={!account}
                />
                <Select
                  value={fromToken}
                  onValueChange={(value) => {
                    setFromToken(value);
                    if (value === toToken) {
                      const otherToken = USER_TOKENS.find(t => t.symbol !== value);
                      if (otherToken) setToToken(otherToken.symbol);
                    }
                  }}
                  disabled={!account}
                >
                  <SelectTrigger className="min-w-[140px] border-gray-600 bg-gray-900">
                    <SelectValue>
                      {(() => {
                        const token = USER_TOKENS.find(t => t.symbol === fromToken);
                        return <span className="flex items-center gap-2">{token?.emoji} {token?.displaySymbol}</span>;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {USER_TOKENS.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <span className="flex items-center gap-2">{token.emoji} {token.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={handleMaxClick}
                className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded border border-green-600/30 transition-colors"
                disabled={!account}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapDirection}
              className="rounded-full bg-gray-800 border-2 border-gray-700 hover:bg-gray-700"
              disabled={!account}
            >
              <ArrowDownUp className="h-5 w-5 text-gray-300" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">To</span>
              <span className="text-gray-400">
                Balance: {formatTokenBalance(toBalance, toTokenInfo?.decimals ?? 12, 4)} {toToken}
              </span>
            </div>

            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.0"
                  className="text-2xl font-bold border-0 bg-transparent text-white placeholder:text-gray-600 focus-visible:ring-0"
                />
                <Select
                  value={toToken}
                  onValueChange={(value) => {
                    setToToken(value);
                    if (value === fromToken) {
                      const otherToken = USER_TOKENS.find(t => t.symbol !== value);
                      if (otherToken) setFromToken(otherToken.symbol);
                    }
                  }}
                  disabled={!account}
                >
                  <SelectTrigger className="min-w-[140px] border-gray-600 bg-gray-900">
                    <SelectValue>
                      {(() => {
                        const token = USER_TOKENS.find(t => t.symbol === toToken);
                        return <span className="flex items-center gap-2">{token?.emoji} {token?.displaySymbol}</span>;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {USER_TOKENS.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <span className="flex items-center gap-2">{token.emoji} {token.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Swap Details - Oracle Prices */}
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Exchange Rate
                <span className="text-xs text-green-500">(CoinGecko)</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-white">
                  {oracleRate ? `1 ${fromToken} = ${exchangeRate} ${toToken}` : 'Loading...'}
                </span>
                <button onClick={fetchPrices} className="text-gray-400 hover:text-white">
                  <RefreshCw className={`w-3 h-3 ${pricesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* USD Prices */}
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                {fromToken}: {prices[fromToken] ? formatUsdPrice(prices[fromToken]) : '...'}
              </span>
              <span className="text-gray-500">
                {toToken}: {prices[toToken] ? formatUsdPrice(prices[toToken]) : '...'}
              </span>
            </div>

            {/* Route */}
            {swapRoute.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Route</span>
                <span className="text-purple-400 text-xs">
                  {swapRoute.join(' → ')}
                </span>
              </div>
            )}

            {/* Fees */}
            <div className="flex justify-between">
              <span className="text-gray-400">Swap Fee</span>
              <span className="text-yellow-400">
                {swapRoute.length > 2 ? '0.6%' : '0.3%'}
                {swapRoute.length > 2 && <span className="text-xs text-gray-500 ml-1">(2 hops)</span>}
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-400">Slippage Tolerance</span>
              <span className="text-blue-400">{slippage}%</span>
            </div>
          </div>

          {/* Warnings */}
          {hasInsufficientBalance && (
            <Alert className="bg-red-900/20 border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-300 text-sm">
                Insufficient {fromToken} balance
              </AlertDescription>
            </Alert>
          )}

          {swapRoute.length > 2 && !hasInsufficientBalance && (
            <Alert className="bg-yellow-900/20 border-yellow-500/30">
              <Info className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-300 text-sm">
                This swap uses multi-hop routing ({swapRoute.join(' → ')}). Double fee applies.
              </AlertDescription>
            </Alert>
          )}

          {/* Swap Button */}
          <Button
            className="w-full h-12 text-lg"
            onClick={() => setShowConfirm(true)}
            disabled={
              !account ||
              !fromAmount ||
              parseFloat(fromAmount) <= 0 ||
              !oracleRate ||
              !toAmount ||
              hasInsufficientBalance ||
              txStatus === 'signing' ||
              txStatus === 'submitting'
            }
          >
            {!account
              ? 'Connect Wallet'
              : hasInsufficientBalance
              ? `Insufficient ${fromToken} Balance`
              : !oracleRate
              ? 'Price Not Available'
              : pricesLoading
              ? 'Loading Prices...'
              : 'Swap Tokens'}
          </Button>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Swap Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Slippage Tolerance</label>
              <div className="flex gap-2 mt-2">
                {[0.1, 0.5, 1.0, 2.0].map(val => (
                  <Button
                    key={val}
                    variant={slippage === val ? 'default' : 'outline'}
                    onClick={() => setSlippage(val)}
                    className="flex-1"
                  >
                    {val}%
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Swap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">You Pay</span>
                <span className="font-bold text-white">{fromAmount} {fromToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">You Receive</span>
                <span className="font-bold text-white">{toAmount} {toToken}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                <span className="text-gray-400">Exchange Rate</span>
                <span className="text-gray-400">1 {fromToken} = {exchangeRate} {toToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Slippage</span>
                <span className="text-gray-400">{slippage}%</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleConfirmSwap}
              disabled={txStatus === 'signing' || txStatus === 'submitting'}
            >
              {txStatus === 'signing' ? 'Signing...' : txStatus === 'submitting' ? 'Swapping...' : 'Confirm Swap'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
