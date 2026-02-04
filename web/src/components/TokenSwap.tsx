import React, { useState, useEffect } from 'react';
import { ArrowDownUp, Settings, TrendingUp, Clock, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { ASSET_IDS, formatBalance, parseAmount } from '@pezkuwi/lib/wallet';
import { formatAssetLocation, NATIVE_TOKEN_ID } from '@pezkuwi/utils/dex';
import { useToast } from '@/hooks/use-toast';
import { KurdistanSun } from './KurdistanSun';
import { PriceChart } from './trading/PriceChart';

// Available tokens for swap
const AVAILABLE_TOKENS = [
  { symbol: 'HEZ', emoji: '🟡', assetId: 0, name: 'HEZ', badge: true, displaySymbol: 'HEZ' },
  { symbol: 'PEZ', emoji: '🟣', assetId: 1, name: 'PEZ', badge: true, displaySymbol: 'PEZ' },
  { symbol: 'USDT', emoji: '💵', assetId: 1000, name: 'USDT', badge: true, displaySymbol: 'USDT' },
] as const;

const TokenSwap = () => {
  // Use Asset Hub API for DEX operations (assetConversion pallet is on Asset Hub)
  const { assetHubApi, isAssetHubReady, selectedAccount } = usePezkuwi();
  const { balances, refreshBalances } = useWallet();
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

  // Exchange rate and loading states
  const [exchangeRate, setExchangeRate] = useState(0);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // Get balances from wallet context
  if (import.meta.env.DEV) console.log('🔍 TokenSwap balances from context:', balances);
  if (import.meta.env.DEV) console.log('🔍 fromToken:', fromToken, 'toToken:', toToken);
  const fromBalance = balances[fromToken as keyof typeof balances];
  const toBalance = balances[toToken as keyof typeof balances];
  if (import.meta.env.DEV) console.log('🔍 Final balances:', { fromBalance, toBalance });

  // Liquidity pool data
  interface LiquidityPool {
    key: string;
    data: unknown;
    tvl: number;
  }
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPool[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  // Transaction history
  interface SwapTransaction {
    blockNumber: number;
    timestamp: number;
    from: string;
    fromToken: string;
    fromAmount: string;
    toToken: string;
    toAmount: string;
    txHash: string;
  }
  const [swapHistory, setSwapHistory] = useState<SwapTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pool reserves for AMM calculation
  const [poolReserves, setPoolReserves] = useState<{ reserve0: number; reserve1: number; asset0: number; asset1: number } | null>(null);

  // Helper: Get display name for token (USDT instead of wUSDT)
  const getTokenDisplayName = (tokenSymbol: string) => {
    const token = AVAILABLE_TOKENS.find(t => t.symbol === tokenSymbol);
    return token?.displaySymbol || tokenSymbol;
  };

  // Check if user has insufficient balance
  const hasInsufficientBalance = React.useMemo(() => {
    const fromAmountNum = parseFloat(fromAmount || '0');
    const fromBalanceNum = parseFloat(fromBalance?.toString() || '0');
    return fromAmountNum > 0 && fromAmountNum > fromBalanceNum;
  }, [fromAmount, fromBalance]);

  // Calculate toAmount and price impact using AMM constant product formula
  const swapCalculations = React.useMemo(() => {
    if (!fromAmount || !poolReserves || parseFloat(fromAmount) <= 0) {
      return { toAmount: '', priceImpact: 0, minimumReceived: '', lpFee: '' };
    }

    const amountIn = parseFloat(fromAmount);
    const { reserve0, reserve1, asset0 } = poolReserves;

    // Determine which reserve is input and which is output
    // Native HEZ uses NATIVE_TOKEN_ID (-1)
    const fromAssetId = fromToken === 'HEZ' ? NATIVE_TOKEN_ID : ASSET_IDS[fromToken as keyof typeof ASSET_IDS];
    const isAsset0ToAsset1 = fromAssetId === asset0;

    const reserveIn = isAsset0ToAsset1 ? reserve0 : reserve1;
    const reserveOut = isAsset0ToAsset1 ? reserve1 : reserve0;

    // Uniswap V2 AMM formula (matches Substrate runtime exactly)
    // Runtime: amount_in_with_fee = amount_in * (1000 - LPFee) = amount_in * 997
    // LPFee = 3 (0.3% fee - standard DEX fee)
    // Formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    const LP_FEE = 3; // 0.3% fee
    const amountInWithFee = amountIn * (1000 - LP_FEE); // = amountIn * 970
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000 + amountInWithFee;
    const amountOut = numerator / denominator;

    // Calculate price impact (like Uniswap)
    // Price impact = (amount_in / reserve_in) / (1 + amount_in / reserve_in) * 100
    const priceImpact = (amountIn / (reserveIn + amountIn)) * 100;

    // Calculate LP fee amount
    const lpFeeAmount = (amountIn * (LP_FEE / 1000)).toFixed(4);

    // Calculate minimum received with slippage
    const minReceived = (amountOut * (1 - parseFloat(slippage) / 100)).toFixed(4);

    if (import.meta.env.DEV) console.log('🔍 Uniswap V2 AMM:', {
      amountIn,
      amountInWithFee,
      reserveIn,
      reserveOut,
      numerator,
      denominator,
      amountOut,
      priceImpact: priceImpact.toFixed(2) + '%',
      lpFeeAmount,
      minReceived,
      feePercent: LP_FEE / 10 + '%'
    });

    return {
      toAmount: amountOut.toFixed(4),
      priceImpact,
      minimumReceived: minReceived,
      lpFee: lpFeeAmount
    };
  }, [fromAmount, poolReserves, fromToken, slippage]);

  const { toAmount, priceImpact, minimumReceived, lpFee } = swapCalculations;

  // Check if AssetConversion pallet is available
  useEffect(() => {
    if (import.meta.env.DEV) console.log('🔍 Checking DEX availability...', { assetHubApi: !!assetHubApi, isAssetHubReady });
    if (assetHubApi && isAssetHubReady) {
      const hasAssetConversion = assetHubApi.tx.assetConversion !== undefined;
      if (import.meta.env.DEV) console.log('🔍 AssetConversion pallet check:', hasAssetConversion);
      setIsDexAvailable(hasAssetConversion);

      if (!hasAssetConversion) {
        if (import.meta.env.DEV) console.warn('⚠️ AssetConversion pallet not available in runtime');
      } else {
        if (import.meta.env.DEV) console.log('✅ AssetConversion pallet is available!');
      }
    }
  }, [assetHubApi, isAssetHubReady]);

  // Fetch exchange rate from AssetConversion pool
  // Always use wHEZ/PEZ pool (the only valid pool)
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (import.meta.env.DEV) console.log('🔍 fetchExchangeRate check:', { assetHubApi: !!assetHubApi, isAssetHubReady, isDexAvailable, fromToken, toToken });

      if (!assetHubApi || !isAssetHubReady || !isDexAvailable) {
        if (import.meta.env.DEV) console.log('⚠️ Skipping fetchExchangeRate:', { assetHubApi: !!assetHubApi, isAssetHubReady, isDexAvailable });
        return;
      }

      if (import.meta.env.DEV) console.log('✅ Starting fetchExchangeRate...');
      setIsLoadingRate(true);
      try {
        // Map user-selected tokens to actual pool assets
        // HEZ → Native token (NATIVE_TOKEN_ID = -1)
        const getPoolAssetId = (token: string) => {
          if (token === 'HEZ') return NATIVE_TOKEN_ID; // Native HEZ (-1)
          if (token === 'PEZ') return 1;
          if (token === 'USDT') return 1000;
          return ASSET_IDS[token as keyof typeof ASSET_IDS];
        };

        const fromAssetId = getPoolAssetId(fromToken);
        const toAssetId = getPoolAssetId(toToken);

        if (import.meta.env.DEV) console.log('🔍 Looking for pool:', { fromToken, toToken, fromAssetId, toAssetId });

        // IMPORTANT: Pool ID must be sorted (native token first, then by asset ID)
        // Native token (-1) always comes first
        const [asset1, asset2] = fromAssetId === NATIVE_TOKEN_ID
          ? [fromAssetId, toAssetId]
          : toAssetId === NATIVE_TOKEN_ID
            ? [toAssetId, fromAssetId]
            : fromAssetId < toAssetId
              ? [fromAssetId, toAssetId]
              : [toAssetId, fromAssetId];

        if (import.meta.env.DEV) console.log('🔍 Sorted pool assets:', { asset1, asset2 });

        // Create pool asset tuple using XCM Location format
        // Native token: { parents: 1, interior: 'Here' }
        // Assets: { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } }
        const poolAssets = [
          formatAssetLocation(asset1),
          formatAssetLocation(asset2)
        ];

        if (import.meta.env.DEV) console.log('🔍 Pool query with XCM Locations:', poolAssets);

        // Query pool from AssetConversion pallet
        const poolInfo = await assetHubApi.query.assetConversion.pools(poolAssets);
        if (import.meta.env.DEV) console.log('🔍 Pool query result:', poolInfo.toHuman());

        if (import.meta.env.DEV) console.log('🔍 Pool isEmpty?', poolInfo.isEmpty, 'exists?', !poolInfo.isEmpty);

        if (poolInfo && !poolInfo.isEmpty) {
          const pool = poolInfo.toJSON() as Record<string, unknown>;
          if (import.meta.env.DEV) console.log('🔍 Pool data:', pool);

          try {
            // Use Runtime API to get exchange rate (quotePriceExactTokensForTokens)
            // This is more reliable than deriving pool account manually
            const decimals0 = asset1 === 1000 ? 6 : 12; // wUSDT: 6, others: 12
            const decimals1 = asset2 === 1000 ? 6 : 12;

            const oneUnit = BigInt(Math.pow(10, decimals0));

            if (import.meta.env.DEV) console.log('🔍 Querying price via runtime API...');

            const quote = await (assetHubApi.call as any).assetConversionApi.quotePriceExactTokensForTokens(
              formatAssetLocation(asset1),
              formatAssetLocation(asset2),
              oneUnit.toString(),
              true
            );

            if (import.meta.env.DEV) console.log('🔍 Quote result:', quote?.toHuman?.() || quote);

            if (quote && !(quote as any).isNone) {
              const priceRaw = (quote as any).unwrap().toString();
              const price = Number(BigInt(priceRaw)) / Math.pow(10, decimals1);

              if (import.meta.env.DEV) console.log('✅ Price from runtime API:', price);

              // For AMM calculation, estimate reserves from LP supply
              const lpTokenId = pool.lpToken;
              let lpSupply = BigInt(1);

              if (assetHubApi.query.poolAssets?.asset) {
                const lpAssetDetails = await assetHubApi.query.poolAssets.asset(lpTokenId);
                if ((lpAssetDetails as any).isSome) {
                  lpSupply = BigInt(((lpAssetDetails as any).unwrap() as any).supply.toString());
                }
              }

              // Estimate reserves: LP = sqrt(r0 * r1), price = r1/r0
              // r0 = LP / sqrt(price), r1 = LP * sqrt(price)
              const sqrtPrice = Math.sqrt(price);
              const reserve0 = Number(lpSupply) / sqrtPrice / Math.pow(10, 12);
              const reserve1 = Number(lpSupply) * sqrtPrice / Math.pow(10, 12);

              if (import.meta.env.DEV) console.log('✅ Estimated reserves:', { reserve0, reserve1, lpSupply: lpSupply.toString() });

              // Store pool reserves for AMM calculation
              setPoolReserves({
                reserve0,
                reserve1,
                asset0: asset1,
                asset1: asset2
              });

              // Calculate exchange rate based on direction
              const rate = fromAssetId === asset1 ? price : 1 / price;

              if (import.meta.env.DEV) console.log('✅ Exchange rate:', rate);
              setExchangeRate(rate);
            } else {
              if (import.meta.env.DEV) console.warn('⚠️ No price quote available');
              setExchangeRate(0);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.error('❌ Error fetching price:', err);
            setExchangeRate(0);
          }
        } else {
          if (import.meta.env.DEV) console.warn('No liquidity pool found for this pair');
          setExchangeRate(0);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch exchange rate:', error);
        setExchangeRate(0);
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchExchangeRate();
  }, [assetHubApi, isAssetHubReady, isDexAvailable, fromToken, toToken]);

  // Fetch liquidity pools
  useEffect(() => {
    const fetchLiquidityPools = async () => {
      if (!assetHubApi || !isAssetHubReady || !isDexAvailable) {
        return;
      }

      setIsLoadingPools(true);
      try {
        // Query all pools from AssetConversion pallet
        const poolsEntries = await assetHubApi.query.assetConversion.pools.entries();

        if (poolsEntries && poolsEntries.length > 0) {
          const pools = poolsEntries.map(([key, value]: [unknown, unknown]) => {
            const poolData = value.toJSON();
            const poolKey = key.toHuman();
            
            // Calculate TVL from reserves
            const tvl = poolData && poolData[0] && poolData[1]
              ? ((parseFloat(poolData[0]) + parseFloat(poolData[1])) / 1e12).toFixed(2)
              : '0';
            
            // Parse asset IDs from pool key
            const assets = poolKey?.[0] || [];
            //const _asset1 = assets[0]?.NativeOrAsset?.Asset || '?';
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
        if (import.meta.env.DEV) console.error('Failed to fetch liquidity pools:', error);
        setLiquidityPools([]);
      } finally {
        setIsLoadingPools(false);
      }
    };

    fetchLiquidityPools();
  }, [assetHubApi, isAssetHubReady, isDexAvailable]);

  // Fetch swap transaction history
  useEffect(() => {
    const fetchSwapHistory = async () => {
      if (!assetHubApi || !isAssetHubReady || !isDexAvailable || !selectedAccount) {
        return;
      }

      setIsLoadingHistory(true);
      try {
        // Get recent finalized blocks (last 100 blocks)
        const finalizedHead = await assetHubApi.rpc.chain.getFinalizedHead();
        const finalizedBlock = await assetHubApi.rpc.chain.getBlock(finalizedHead);
        const currentBlockNumber = finalizedBlock.block.header.number.toNumber();

        const startBlock = Math.max(0, currentBlockNumber - 100);

        if (import.meta.env.DEV) console.log('🔍 Fetching swap history from block', startBlock, 'to', currentBlockNumber);

        const transactions: SwapTransaction[] = [];

        // Query block by block for SwapExecuted events
        for (let blockNum = currentBlockNumber; blockNum >= startBlock && transactions.length < 10; blockNum--) {
          try {
            const blockHash = await assetHubApi.rpc.chain.getBlockHash(blockNum);
            const apiAt = await assetHubApi.at(blockHash);
            const events = await apiAt.query.system.events();
            //const block = await assetHubApi.rpc.chain.getBlock(blockHash);
            const timestamp = Date.now() - ((currentBlockNumber - blockNum) * 6000); // Estimate 6s per block

            events.forEach((record: { event: { data: unknown[] } }) => {
              const { event } = record;

              // Check for AssetConversion::SwapExecuted event
              if (assetHubApi.events.assetConversion?.SwapExecuted?.is(event)) {
                // SwapExecuted has 5 fields: (who, send_to, amountIn, amountOut, path)
                const [who, , amountIn, amountOut, path] = event.data;

                // Parse path to get token symbols - path is Vec<MultiAsset>
                let fromAssetId = 0;
                let toAssetId = 0;

                try {
                  // Path structure is: [[assetId, amount], [assetId, amount]]
                  const pathArray = path.toJSON ? path.toJSON() : path;

                  if (Array.isArray(pathArray) && pathArray.length >= 2) {
                    // Extract asset IDs from path
                    const asset0 = pathArray[0];
                    //const _asset1 = pathArray[1];

                    // Each element is a tuple where index 0 is the asset ID
                    if (Array.isArray(asset0) && asset0.length >= 1) {
                      fromAssetId = typeof asset0[0] === 'number' ? asset0[0] : parseInt(asset0[0]) || 0;
                    }
                    if (Array.isArray(asset1) && asset1.length >= 1) {
                      toAssetId = typeof asset1[0] === 'number' ? asset1[0] : parseInt(asset1[0]) || 0;
                    }
                  }
                } catch (err) {
                  if (import.meta.env.DEV) console.warn('Failed to parse swap path:', err);
                }

                const fromTokenSymbol = fromAssetId === 0 ? 'wHEZ' : fromAssetId === 1 ? 'PEZ' : fromAssetId === 1000 ? 'USDT' : `Asset${fromAssetId}`;
                const toTokenSymbol = toAssetId === 0 ? 'wHEZ' : toAssetId === 1 ? 'PEZ' : toAssetId === 1000 ? 'USDT' : `Asset${toAssetId}`;

                // Only show transactions from current user
                if (who.toString() === selectedAccount.address) {
                  transactions.push({
                    blockNumber: blockNum,
                    timestamp,
                    from: who.toString(),
                    fromToken: fromTokenSymbol === 'wHEZ' ? 'HEZ' : fromTokenSymbol,
                    fromAmount: formatBalance(amountIn.toString()),
                    toToken: toTokenSymbol === 'wHEZ' ? 'HEZ' : toTokenSymbol,
                    toAmount: formatBalance(amountOut.toString()),
                    txHash: blockHash.toHex()
                  });
                }
              }
            });
          } catch (err) {
            if (import.meta.env.DEV) console.warn(`Failed to fetch block ${blockNum}:`, err);
          }
        }

        if (import.meta.env.DEV) console.log('✅ Swap history fetched:', transactions.length, 'transactions');
        setSwapHistory(transactions.slice(0, 10)); // Show max 10
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch swap history:', error);
        setSwapHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchSwapHistory();
  }, [assetHubApi, isAssetHubReady, isDexAvailable, selectedAccount]);

  const handleSwap = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
  };

  const handleConfirmSwap = async () => {
    if (!assetHubApi || !selectedAccount) {
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

    // ✅ BALANCE VALIDATION - Check if user has sufficient balance
    const fromAmountNum = parseFloat(fromAmount);
    const fromBalanceNum = parseFloat(fromBalance?.toString() || '0');

    if (fromAmountNum > fromBalanceNum) {
      toast({
        title: 'Insufficient Balance',
        description: `You only have ${fromBalanceNum.toFixed(4)} ${getTokenDisplayName(fromToken)}. Cannot swap ${fromAmountNum} ${getTokenDisplayName(fromToken)}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSwapping(true);
    setShowConfirm(false); // Close dialog before transaction starts
    try {
      // Get correct decimals for each token
      const getTokenDecimals = (token: string) => {
        if (token === 'USDT') return 6; // USDT has 6 decimals
        return 12; // HEZ, wHEZ, PEZ all have 12 decimals
      };

      const fromDecimals = getTokenDecimals(fromToken);
      const toDecimals = getTokenDecimals(toToken);

      const amountIn = parseAmount(fromAmount, fromDecimals);
      const minAmountOut = parseAmount(
        (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toString(),
        toDecimals
      );

      if (import.meta.env.DEV) console.log('💰 Swap amounts:', {
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        fromDecimals,
        toDecimals,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString()
      });

      // Get signer from extension
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      // Build transaction based on token types
      let tx;

      // Use XCM MultiLocation format for swap paths
      // Native HEZ: { parents: 1, interior: 'Here' }
      // Assets: { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } }
      const nativeLocation = formatAssetLocation(NATIVE_TOKEN_ID);
      const pezLocation = formatAssetLocation(1);
      const usdtLocation = formatAssetLocation(1000);

      if (fromToken === 'HEZ' && toToken === 'PEZ') {
        // HEZ → PEZ: Direct swap using native token pool
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [nativeLocation, pezLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else if (fromToken === 'PEZ' && toToken === 'HEZ') {
        // PEZ → HEZ: Direct swap to native token
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [pezLocation, nativeLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else if (fromToken === 'HEZ' && toToken === 'USDT') {
        // HEZ → USDT: Direct swap using native token pool
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [nativeLocation, usdtLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else if (fromToken === 'USDT' && toToken === 'HEZ') {
        // USDT → HEZ: Direct swap to native token
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [usdtLocation, nativeLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else if (fromToken === 'PEZ' && toToken === 'USDT') {
        // PEZ → USDT: Multi-hop through HEZ (PEZ → HEZ → USDT)
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [pezLocation, nativeLocation, usdtLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else if (fromToken === 'USDT' && toToken === 'PEZ') {
        // USDT → PEZ: Multi-hop through HEZ (USDT → HEZ → PEZ)
        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [usdtLocation, nativeLocation, pezLocation],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );

      } else {
        // Generic swap using XCM Locations
        const getAssetLocation = (token: string) => {
          if (token === 'HEZ') return nativeLocation;
          if (token === 'PEZ') return pezLocation;
          if (token === 'USDT') return usdtLocation;
          const assetId = ASSET_IDS[token as keyof typeof ASSET_IDS];
          return formatAssetLocation(assetId);
        };

        tx = assetHubApi.tx.assetConversion.swapExactTokensForTokens(
          [getAssetLocation(fromToken), getAssetLocation(toToken)],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
      }

      // Sign and send transaction
      await tx.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        async ({ status, events, dispatchError }) => {
          if (import.meta.env.DEV) console.log('🔍 Transaction status:', status.toHuman());

          if (status.isInBlock) {
            if (import.meta.env.DEV) console.log('✅ Transaction in block:', status.asInBlock.toHex());

            toast({
              title: 'Transaction Submitted',
              description: `Processing in block ${status.asInBlock.toHex().slice(0, 10)}...`,
            });
          }

          if (status.isFinalized) {
            if (import.meta.env.DEV) console.log('✅ Transaction finalized:', status.asFinalized.toHex());
            if (import.meta.env.DEV) console.log('🔍 All events:', events.map(({ event }) => event.toHuman()));
            if (import.meta.env.DEV) console.log('🔍 dispatchError:', dispatchError?.toHuman());

            // Check for errors
            if (dispatchError) {
              let errorMessage = 'Transaction failed';

              if (dispatchError.isModule) {
                const decoded = assetHubApi.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              }

              toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
              });
              setIsSwapping(false);
              return;
            }

            // Success - check for swap event
            const hasSwapEvent = events.some(({ event }) =>
              assetHubApi.events.assetConversion?.SwapExecuted?.is(event)
            );

            if (hasSwapEvent || fromToken === 'HEZ' || toToken === 'HEZ') {
              toast({
                title: 'Success!',
                description: `Swapped ${fromAmount} ${fromToken} for ~${toAmount} ${toToken}`,
              });

              setFromAmount('');

              // Refresh balances and history without page reload
              await refreshBalances();
              if (import.meta.env.DEV) console.log('✅ Balances refreshed after swap');

              // Refresh swap history after 3 seconds (wait for block finalization)
              setTimeout(async () => {
                if (import.meta.env.DEV) console.log('🔄 Refreshing swap history...');
                const fetchSwapHistory = async () => {
                  if (!assetHubApi || !isAssetHubReady || !isDexAvailable || !selectedAccount) return;
                  setIsLoadingHistory(true);
                  try {
                    const finalizedHead = await assetHubApi.rpc.chain.getFinalizedHead();
                    const finalizedBlock = await assetHubApi.rpc.chain.getBlock(finalizedHead);
                    const currentBlockNumber = finalizedBlock.block.header.number.toNumber();
                    const startBlock = Math.max(0, currentBlockNumber - 100);
                    const transactions: SwapTransaction[] = [];
                    for (let blockNum = currentBlockNumber; blockNum >= startBlock && transactions.length < 10; blockNum--) {
                      try {
                        const blockHash = await assetHubApi.rpc.chain.getBlockHash(blockNum);
                        const apiAt = await assetHubApi.at(blockHash);
                        const events = await apiAt.query.system.events();
                        const timestamp = Date.now() - ((currentBlockNumber - blockNum) * 6000);
                        events.forEach((record: { event: { data: unknown[] } }) => {
                          const { event } = record;
                          if (assetHubApi.events.assetConversion?.SwapExecuted?.is(event)) {
                            // SwapExecuted has 5 fields: (who, send_to, amountIn, amountOut, path)
                            const [who, , amountIn, amountOut, path] = event.data;

                            // Parse path (same logic as main history fetch)
                            let fromAssetId = 0;
                            let toAssetId = 0;
                            try {
                              // Path structure is: [[assetId, amount], [assetId, amount]]
                              const pathArray = path.toJSON ? path.toJSON() : path;

                              if (Array.isArray(pathArray) && pathArray.length >= 2) {
                                const asset0 = pathArray[0];
                                const asset1 = pathArray[1];

                                // Each element is a tuple where index 0 is the asset ID
                                if (Array.isArray(asset0) && asset0.length >= 1) {
                                  fromAssetId = typeof asset0[0] === 'number' ? asset0[0] : parseInt(asset0[0]) || 0;
                                }
                                if (Array.isArray(asset1) && asset1.length >= 1) {
                                  toAssetId = typeof asset1[0] === 'number' ? asset1[0] : parseInt(asset1[0]) || 0;
                                }
                              }
                            } catch (err) {
                              if (import.meta.env.DEV) console.warn('Failed to parse swap path in refresh:', err);
                            }

                            const fromTokenSymbol = fromAssetId === 0 ? 'wHEZ' : fromAssetId === 1 ? 'PEZ' : fromAssetId === 1000 ? 'USDT' : `Asset${fromAssetId}`;
                            const toTokenSymbol = toAssetId === 0 ? 'wHEZ' : toAssetId === 1 ? 'PEZ' : toAssetId === 1000 ? 'USDT' : `Asset${toAssetId}`;

                            if (who.toString() === selectedAccount.address) {
                              transactions.push({
                                blockNumber: blockNum,
                                timestamp,
                                from: who.toString(),
                                fromToken: fromTokenSymbol === 'wHEZ' ? 'HEZ' : fromTokenSymbol,
                                fromAmount: formatBalance(amountIn.toString()),
                                toToken: toTokenSymbol === 'wHEZ' ? 'HEZ' : toTokenSymbol,
                                toAmount: formatBalance(amountOut.toString()),
                                txHash: blockHash.toHex()
                              });
                            }
                          }
                        });
                      } catch (err) {
                        if (import.meta.env.DEV) console.warn(`Failed to fetch block ${blockNum}:`, err);
                      }
                    }
                    setSwapHistory(transactions.slice(0, 10));
                  } catch (error) {
                    if (import.meta.env.DEV) console.error('Failed to refresh swap history:', error);
                  } finally {
                    setIsLoadingHistory(false);
                  }
                };
                await fetchSwapHistory();
              }, 3000);
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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Swap failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Swap transaction failed',
        variant: 'destructive',
      });
      setIsSwapping(false);
    }
  };

  // Show DEX unavailable message
  if (!isDexAvailable && isAssetHubReady) {
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
              <p className="text-gray-300 max-w-md mx-auto">
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
      {/* Kurdistan Sun Animation Overlay during swap (only after confirm dialog is closed) */}
      {isSwapping && !showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <KurdistanSun size={300} />
            <p className="text-white text-xl font-semibold animate-pulse">
              Processing your swap...
            </p>
          </div>
        </div>
      )}

      <div className="lg:col-span-2 space-y-6">
        {/* Price Chart */}
        {exchangeRate > 0 && (
          <PriceChart
            fromToken={fromToken}
            toToken={toToken}
            currentPrice={exchangeRate}
          />
        )}

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
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">From</span>
                <span className="text-sm text-gray-400">
                  Balance: {fromBalance} {getTokenDisplayName(fromToken)}
                </span>
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="Amount"
                  className="text-2xl font-bold border-0 bg-transparent text-white placeholder:text-gray-500 placeholder:opacity-50"
                  disabled={!selectedAccount}
                />
                <Select
                  value={fromToken}
                  onValueChange={(value) => {
                    setFromToken(value);
                    // Prevent selecting same token for both sides
                    if (value === toToken) {
                      const otherToken = AVAILABLE_TOKENS.find(t => t.symbol !== value);
                      if (otherToken) setToToken(otherToken.symbol);
                    }
                  }}
                  disabled={!selectedAccount}
                >
                  <SelectTrigger className="min-w-[140px] border-gray-600 hover:border-gray-500">
                    <SelectValue>
                      {(() => {
                        const token = AVAILABLE_TOKENS.find(t => t.symbol === fromToken);
                        return (
                          <span className="flex items-center gap-1.5 relative">
                            {token?.emoji} {token?.displaySymbol || token?.name}
                            {token?.badge && (
                              <span className="w-2 h-2 bg-gradient-to-br from-red-500 via-yellow-400 to-green-500 rounded-sm absolute -bottom-0.5 -right-0.5"></span>
                            )}
                          </span>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_TOKENS.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <span className="flex items-center gap-2">
                          <span>{token.emoji} {token.name}</span>
                          {token.badge && (
                            <span className="w-2.5 h-2.5 bg-gradient-to-br from-red-500 via-yellow-400 to-green-500 rounded-sm ml-1"></span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center -my-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwap}
                className="rounded-full bg-gray-800 border-2 border-gray-700 hover:bg-gray-700 hover:border-gray-600"
                disabled={!selectedAccount}
              >
                <ArrowDownUp className="h-5 w-5 text-gray-300" />
              </Button>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">To</span>
                <span className="text-sm text-gray-400">
                  Balance: {toBalance} {getTokenDisplayName(toToken)}
                </span>
              </div>
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="Amount"
                  className="text-2xl font-bold border-0 bg-transparent text-white placeholder:text-gray-500 placeholder:opacity-50"
                />
                <Select
                  value={toToken}
                  onValueChange={(value) => {
                    setToToken(value);
                    // Prevent selecting same token for both sides
                    if (value === fromToken) {
                      const otherToken = AVAILABLE_TOKENS.find(t => t.symbol !== value);
                      if (otherToken) setFromToken(otherToken.symbol);
                    }
                  }}
                  disabled={!selectedAccount}
                >
                  <SelectTrigger className="min-w-[140px] border-gray-600 hover:border-gray-500">
                    <SelectValue>
                      {(() => {
                        const token = AVAILABLE_TOKENS.find(t => t.symbol === toToken);
                        return (
                          <span className="flex items-center gap-1.5 relative">
                            {token?.emoji} {token?.displaySymbol || token?.name}
                            {token?.badge && (
                              <span className="w-2 h-2 bg-gradient-to-br from-red-500 via-yellow-400 to-green-500 rounded-sm absolute -bottom-0.5 -right-0.5"></span>
                            )}
                          </span>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_TOKENS.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <span className="flex items-center gap-2">
                          <span>{token.emoji} {token.name}</span>
                          {token.badge && (
                            <span className="w-2.5 h-2.5 bg-gradient-to-br from-red-500 via-yellow-400 to-green-500 rounded-sm ml-1"></span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap Details - Uniswap Style */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Exchange Rate
                </span>
                <span className="font-semibold text-white">
                  {isLoadingRate ? (
                    'Loading...'
                  ) : exchangeRate > 0 ? (
                    `1 ${getTokenDisplayName(fromToken)} = ${exchangeRate.toFixed(4)} ${getTokenDisplayName(toToken)}`
                  ) : (
                    'No pool available'
                  )}
                </span>
              </div>

              {/* Price Impact Indicator (Uniswap style) */}
              {fromAmount && parseFloat(fromAmount) > 0 && priceImpact > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <AlertTriangle className={`w-3 h-3 ${
                      priceImpact < 1 ? 'text-green-500' :
                      priceImpact < 5 ? 'text-yellow-500' :
                      'text-red-500'
                    }`} />
                    Price Impact
                  </span>
                  <span className={`font-semibold ${
                    priceImpact < 1 ? 'text-green-400' :
                    priceImpact < 5 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {priceImpact < 0.01 ? '<0.01%' : `${priceImpact.toFixed(2)}%`}
                  </span>
                </div>
              )}

              {/* LP Fee */}
              {fromAmount && parseFloat(fromAmount) > 0 && lpFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Liquidity Provider Fee</span>
                  <span className="text-gray-300">{lpFee} {getTokenDisplayName(fromToken)}</span>
                </div>
              )}

              {/* Minimum Received */}
              {fromAmount && parseFloat(fromAmount) > 0 && minimumReceived && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Minimum Received</span>
                  <span className="text-gray-300">{minimumReceived} {getTokenDisplayName(toToken)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span className="font-semibold text-blue-400">{slippage}%</span>
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {hasInsufficientBalance && (
              <Alert className="bg-red-900/20 border-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-300 text-sm">
                  Insufficient {getTokenDisplayName(fromToken)} balance. You have {fromBalance} {getTokenDisplayName(fromToken)} but trying to swap {fromAmount} {getTokenDisplayName(fromToken)}.
                </AlertDescription>
              </Alert>
            )}

            {/* High Price Impact Warning (>5%) */}
            {priceImpact >= 5 && !hasInsufficientBalance && (
              <Alert className="bg-red-900/20 border-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-300 text-sm">
                  High price impact! Your trade will significantly affect the pool price. Consider a smaller amount or check if there&apos;s better liquidity.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-12 text-lg"
              onClick={() => setShowConfirm(true)}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || !selectedAccount || exchangeRate === 0 || hasInsufficientBalance}
            >
              {!selectedAccount
                ? 'Connect Wallet'
                : hasInsufficientBalance
                ? `Insufficient ${getTokenDisplayName(fromToken)} Balance`
                : exchangeRate === 0
                ? 'No Pool Available'
                : 'Swap Tokens'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Liquidity Pools
          </h3>
          
          {isLoadingPools ? (
            <div className="text-center text-gray-400 py-8">Loading pools...</div>
          ) : liquidityPools.length > 0 ? (
            <div className="space-y-3">
              {liquidityPools.map((pool, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
                  <div>
                    <div className="font-semibold text-gray-200">{pool.pool}</div>
                    <div className="text-sm text-gray-400">TVL: {pool.tvl}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-semibold">{pool.apr} APR</div>
                    <div className="text-sm text-gray-400">Vol: {pool.volume}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
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

          {!selectedAccount ? (
            <div className="text-center text-gray-400 py-8">
              Connect wallet to view history
            </div>
          ) : isLoadingHistory ? (
            <div className="text-center text-gray-400 py-8">
              Loading history...
            </div>
          ) : swapHistory.length > 0 ? (
            <div className="space-y-3">
              {swapHistory.map((tx, idx) => (
                <div key={idx} className="p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ArrowDownUp className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">
                        {getTokenDisplayName(tx.fromToken)} → {getTokenDisplayName(tx.toToken)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      #{tx.blockNumber}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="text-red-400">-{tx.fromAmount} {getTokenDisplayName(tx.fromToken)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Received:</span>
                      <span className="text-green-400">+{tx.toAmount} {getTokenDisplayName(tx.toToken)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-700">
                      <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                      <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              No swap history yet
            </div>
          )}
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
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">You Pay</span>
                <span className="font-bold text-white">{fromAmount} {getTokenDisplayName(fromToken)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">You Receive</span>
                <span className="font-bold text-white">{toAmount} {getTokenDisplayName(toToken)}</span>
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-700 text-sm">
                <span className="text-gray-400">Exchange Rate</span>
                <span className="text-gray-400">1 {getTokenDisplayName(fromToken)} = {exchangeRate.toFixed(4)} {getTokenDisplayName(toToken)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Slippage</span>
                <span className="text-gray-400">{slippage}%</span>
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