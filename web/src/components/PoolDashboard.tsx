import React, { useState, useEffect } from 'react';
import { TrendingUp, Droplet, DollarSign, Percent, Info, AlertTriangle, BarChart3, Clock, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { ASSET_IDS, getAssetSymbol } from '@pezkuwi/lib/wallet';
import { NATIVE_TOKEN_ID } from '@/types/dex';
import { AddLiquidityModal } from '@/components/AddLiquidityModal';
import { RemoveLiquidityModal } from '@/components/RemoveLiquidityModal';
import { LPStakingModal } from '@/components/LPStakingModal';
import { useTranslation } from 'react-i18next';

// Helper function to convert asset IDs to user-friendly display names
// Users should only see HEZ, PEZ, USDT - wrapped tokens are backend details
const getDisplayTokenName = (assetId: number): string => {
  if (assetId === -1) return 'HEZ'; // Native HEZ from relay chain
  if (assetId === ASSET_IDS.WHEZ || assetId === 2) return 'wHEZ';
  if (assetId === ASSET_IDS.PEZ || assetId === 1) return 'PEZ';
  if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 'USDT';
  if (assetId === 1001) return 'DOT';
  if (assetId === 1002) return 'ETH';
  if (assetId === 1003) return 'BTC';
  return getAssetSymbol(assetId); // Fallback for other assets
};

interface PoolData {
  asset0: number;
  asset1: number;
  reserve0: number;
  reserve1: number;
  lpTokenId: number;
  poolAccount: string;
}

interface LPPosition {
  lpTokenBalance: number;
  share: number; // Percentage of pool
  asset0Amount: number;
  asset1Amount: number;
}

const PoolDashboard = () => {
  // Use Asset Hub API for DEX operations (assetConversion pallet is on Asset Hub)
  const { assetHubApi, isAssetHubReady, selectedAccount } = usePezkuwi();
  const { t } = useTranslation();

  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [lpPosition, setLPPosition] = useState<LPPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddLiquidityModalOpen, setIsAddLiquidityModalOpen] = useState(false);
  const [isRemoveLiquidityModalOpen, setIsRemoveLiquidityModalOpen] = useState(false);
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);

  // Pool selection state
  const [availablePools, setAvailablePools] = useState<Array<[number, number]>>([]);
  const [selectedPool, setSelectedPool] = useState<string>('0-1'); // Default: wHEZ/PEZ

  // Helper to convert asset ID to XCM Location format (same as CreatePoolModal)
  const formatAssetId = (id: number) => {
    if (id === NATIVE_TOKEN_ID) {
      // Native token from relay chain - XCM location format
      return { parents: 1, interior: 'Here' };
    }
    // Asset on Asset Hub - XCM location format with PalletInstance 50 (assets pallet)
    return { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } };
  };

  // Discover available pools
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady) return;

    const discoverPools = async () => {
      try {
        // All possible pool combinations
        const possiblePools: Array<[number, number]> = [
          // Native HEZ pools
          [NATIVE_TOKEN_ID, ASSET_IDS.PEZ],     // Native HEZ / PEZ
          [NATIVE_TOKEN_ID, ASSET_IDS.WUSDT],   // Native HEZ / wUSDT
          [NATIVE_TOKEN_ID, ASSET_IDS.WHEZ],    // Native HEZ / wHEZ
          [NATIVE_TOKEN_ID, 1001],              // Native HEZ / wDOT
          // wHEZ pools
          [ASSET_IDS.WHEZ, ASSET_IDS.PEZ],      // wHEZ / PEZ
          [ASSET_IDS.WHEZ, ASSET_IDS.WUSDT],    // wHEZ / wUSDT
          // PEZ pools
          [ASSET_IDS.PEZ, ASSET_IDS.WUSDT],     // PEZ / wUSDT
        ];

        const existingPools: Array<[number, number]> = [];

        for (const [asset0, asset1] of possiblePools) {
          try {
            // Use XCM Location format for pool queries
            const poolKey = [formatAssetId(asset0), formatAssetId(asset1)];
            const poolInfo = await assetHubApi.query.assetConversion.pools(poolKey);
            if ((poolInfo as { isSome: boolean }).isSome) {
              existingPools.push([asset0, asset1]);
              if (import.meta.env.DEV) {
                console.log(`✅ Found pool: ${asset0}-${asset1}`);
              }
            }
          } catch (err) {
            // Skip pools that error out (likely don't exist)
            if (import.meta.env.DEV) {
              console.log(`❌ Pool ${asset0}-${asset1} not found or error:`, err);
            }
          }
        }

        if (import.meta.env.DEV) {
          console.log('📊 Total pools found:', existingPools.length, existingPools);
        }

        setAvailablePools(existingPools);

        // Set default pool to first available if current selection doesn't exist
        if (existingPools.length > 0) {
          const currentPoolKey = selectedPool;
          const poolExists = existingPools.some(
            ([a0, a1]) => `${a0}-${a1}` === currentPoolKey
          );
          if (!poolExists) {
            const [firstAsset0, firstAsset1] = existingPools[0];
            setSelectedPool(`${firstAsset0}-${firstAsset1}`);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error discovering pools:', err);
      }
    };

    discoverPools();
  }, [assetHubApi, isAssetHubReady, selectedPool]);
     

  // Fetch pool data
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady || !selectedPool) return;

    const fetchPoolData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Parse selected pool (e.g., "-1-1" -> [-1, 1] for Native HEZ / PEZ)
        const [asset1Str, asset2Str] = selectedPool.split('-').filter(s => s !== '');
        const asset1 = selectedPool.startsWith('-') ? -parseInt(asset1Str) : parseInt(asset1Str);
        const asset2 = parseInt(asset2Str);

        // Use XCM Location format for pool query
        const poolKey = [formatAssetId(asset1), formatAssetId(asset2)];

        const poolInfo = await assetHubApi.query.assetConversion.pools(poolKey);

        if ((poolInfo as { isSome: boolean }).isSome) {
          const lpTokenData = (poolInfo as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON();
          const lpTokenId = lpTokenData.lpToken as number;

          // Get decimals for each asset
          const getAssetDecimals = (assetId: number): number => {
            if (assetId === ASSET_IDS.WUSDT || assetId === 1000) return 6; // wUSDT has 6 decimals
            if (assetId === 1001) return 10; // wDOT has 10 decimals
            if (assetId === 1002) return 18; // wETH has 18 decimals
            if (assetId === 1003) return 8;  // wBTC has 8 decimals
            return 12; // Native, wHEZ, PEZ have 12 decimals
          };

          const asset1Decimals = getAssetDecimals(asset1);
          const asset2Decimals = getAssetDecimals(asset2);

          // Use getReserves runtime API for accurate reserve values
          let reserve0 = 0;
          let reserve1 = 0;

          try {
            const reserves = await assetHubApi.call.assetConversionApi.getReserves(
              formatAssetId(asset1),
              formatAssetId(asset2)
            );

            if (reserves && !(reserves as { isNone?: boolean }).isNone) {
              const [reserve0Raw, reserve1Raw] = (reserves as { unwrap: () => [{ toString: () => string }, { toString: () => string }] }).unwrap();
              reserve0 = Number(reserve0Raw.toString()) / Math.pow(10, asset1Decimals);
              reserve1 = Number(reserve1Raw.toString()) / Math.pow(10, asset2Decimals);

              if (import.meta.env.DEV) {
                console.log('📊 Pool reserves:', { reserve0, reserve1 });
              }
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('Could not fetch reserves:', err);
          }

          const poolAccount = 'Pool Account (derived)';

          setPoolData({
            asset0: asset1,
            asset1: asset2,
            reserve0,
            reserve1,
            lpTokenId,
            poolAccount,
          });

          // Get user's LP position if account connected
          if (selectedAccount) {
            await fetchLPPosition(lpTokenId, reserve0, reserve1);
          }
        } else {
          setError('Pool not found');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching pool data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pool data');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchLPPosition = async (lpTokenId: number, reserve0: number, reserve1: number) => {
      if (!assetHubApi || !selectedAccount) return;

      try {
        // LP tokens can be in either poolAssets or assets pallet - check both
        let userLpBalance = 0;
        let totalSupply = 0;

        // Try poolAssets pallet first (newer LP tokens)
        try {
          const poolLpBalance = await assetHubApi.query.poolAssets.account(lpTokenId, selectedAccount.address);
          if ((poolLpBalance as { isSome: boolean }).isSome) {
            const lpData = (poolLpBalance as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON();
            userLpBalance += Number(lpData.balance) / 1e12;
          }

          const poolLpAsset = await assetHubApi.query.poolAssets.asset(lpTokenId);
          if ((poolLpAsset as { isSome: boolean }).isSome) {
            const assetInfo = (poolLpAsset as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON();
            totalSupply += Number(assetInfo.supply) / 1e12;
          }
        } catch {
          if (import.meta.env.DEV) console.log('poolAssets not available for LP token', lpTokenId);
        }

        // Also check assets pallet (some LP tokens might be there)
        try {
          const assetsLpBalance = await assetHubApi.query.assets.account(lpTokenId, selectedAccount.address);
          if ((assetsLpBalance as { isSome: boolean }).isSome) {
            const lpData = (assetsLpBalance as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON();
            userLpBalance += Number(lpData.balance) / 1e12;
          }

          const assetsLpAsset = await assetHubApi.query.assets.asset(lpTokenId);
          if ((assetsLpAsset as { isSome: boolean }).isSome) {
            const assetInfo = (assetsLpAsset as { unwrap: () => { toJSON: () => Record<string, unknown> } }).unwrap().toJSON();
            // Only add if not already counted from poolAssets
            if (totalSupply === 0) {
              totalSupply = Number(assetInfo.supply) / 1e12;
            }
          }
        } catch {
          if (import.meta.env.DEV) console.log('assets pallet LP check failed for', lpTokenId);
        }

        if (userLpBalance > 0) {
          // Calculate user's share
          const sharePercentage = totalSupply > 0 ? (userLpBalance / totalSupply) * 100 : 0;

          // Calculate user's actual token amounts
          const asset0Amount = (sharePercentage / 100) * reserve0;
          const asset1Amount = (sharePercentage / 100) * reserve1;

          setLPPosition({
            lpTokenBalance: userLpBalance,
            share: sharePercentage,
            asset0Amount,
            asset1Amount,
          });

          if (import.meta.env.DEV) {
            console.log('📊 LP Position:', { userLpBalance, totalSupply, sharePercentage });
          }
        } else {
          setLPPosition(null);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching LP position:', err);
      }
    };

    fetchPoolData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPoolData, 30000);

    return () => clearInterval(interval);
  }, [assetHubApi, isAssetHubReady, selectedAccount, selectedPool]);

  // Calculate metrics
  const constantProduct = poolData ? poolData.reserve0 * poolData.reserve1 : 0;
  const currentPrice = poolData ? poolData.reserve1 / poolData.reserve0 : 0;
  const totalLiquidityUSD = poolData ? poolData.reserve0 * 2 : 0; // Simplified: assumes 1:1 USD peg

  // APR calculation (simplified - would need 24h volume data)
  const estimateAPR = () => {
    if (!poolData) return 0;

    // Estimate based on pool size and typical volume
    // This is a simplified calculation
    // Real APR = (24h fees × 365) / TVL
    const dailyVolumeEstimate = totalLiquidityUSD * 0.1; // Assume 10% daily turnover
    const dailyFees = dailyVolumeEstimate * 0.003; // 0.3% fee
    const annualFees = dailyFees * 365;
    const apr = (annualFees / totalLiquidityUSD) * 100;

    return apr;
  };

  // Impermanent loss calculator
  const calculateImpermanentLoss = (priceChange: number) => {
    // IL formula: 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
    const priceRatio = 1 + priceChange / 100;
    const il = ((2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1) * 100;
    return il;
  };

  if (isLoading && !poolData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">{t('poolDash.loadingPoolData')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-900/20 border-red-500">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!poolData) {
    return (
      <Alert className="bg-yellow-900/20 border-yellow-500">
        <Info className="h-4 w-4" />
        <AlertDescription>{t('poolDash.noPoolData')}</AlertDescription>
      </Alert>
    );
  }

  // Get asset symbols for the selected pool (using display names)
  const asset0Symbol = poolData ? getDisplayTokenName(poolData.asset0) : '';
  const asset1Symbol = poolData ? getDisplayTokenName(poolData.asset1) : '';

  return (
    <div className="space-y-6">
      {/* Pool Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">{t('poolDash.poolDashboards')}</h3>
            <Select value={selectedPool} onValueChange={setSelectedPool}>
              <SelectTrigger className="w-[240px] bg-gray-800/50 border-gray-700">
                <SelectValue placeholder={t('poolDash.selectPool')} />
              </SelectTrigger>
              <SelectContent>
                {availablePools.map(([asset0, asset1]) => {
                  const symbol0 = getDisplayTokenName(asset0);
                  const symbol1 = getDisplayTokenName(asset1);
                  return (
                    <SelectItem key={`${asset0}-${asset1}`} value={`${asset0}-${asset1}`}>
                      {symbol0}/{symbol1}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('poolDash.live')}
        </Badge>
      </div>

      {/* Pool Dashboard Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Droplet className="h-6 w-6 text-blue-400" />
            {t('poolDash.poolDashboard', { asset0: asset0Symbol, asset1: asset1Symbol })}
          </h2>
          <p className="text-gray-400 mt-1">{t('poolDash.monitorDesc')}</p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Liquidity */}
        <Card className="p-4 bg-gray-800/50 border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{t('poolDash.totalLiquidity')}</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${totalLiquidityUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {poolData.reserve0.toLocaleString()} {asset0Symbol} + {poolData.reserve1.toLocaleString()} {asset1Symbol}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </Card>

        {/* Current Price */}
        <Card className="p-4 bg-gray-800/50 border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{t('poolDash.price', { symbol: asset0Symbol })}</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${currentPrice.toFixed(4)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                1 {asset1Symbol} = {(1 / currentPrice).toFixed(4)} {asset0Symbol}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-400" />
          </div>
        </Card>

        {/* APR */}
        <Card className="p-4 bg-gray-800/50 border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{t('poolDash.estimatedApr')}</p>
              <p className="text-2xl font-bold text-white mt-1">
                {estimateAPR().toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('poolDash.fromSwapFees')}
              </p>
            </div>
            <Percent className="h-8 w-8 text-yellow-400" />
          </div>
        </Card>

        {/* Constant Product */}
        <Card className="p-4 bg-gray-800/50 border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{t('poolDash.constant')}</p>
              <p className="text-2xl font-bold text-white mt-1">
                {(constantProduct / 1e9).toFixed(1)}B
              </p>
              <p className="text-xs text-gray-500 mt-1">
                x × y = k
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-400" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="reserves" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="reserves">{t('poolDash.reserves')}</TabsTrigger>
          <TabsTrigger value="position">{t('poolDash.yourPosition')}</TabsTrigger>
          <TabsTrigger value="calculator">{t('poolDash.ilCalculator')}</TabsTrigger>
        </TabsList>

        {/* Reserves Tab */}
        <TabsContent value="reserves" className="space-y-4">
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">{t('poolDash.poolReserves')}</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">{t('poolDash.reserve', { symbol: asset0Symbol })}</p>
                  <p className="text-2xl font-bold text-white">{poolData.reserve0.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                </div>
                <Badge variant="outline">Asset 1</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">{t('poolDash.reserve', { symbol: asset1Symbol })}</p>
                  <p className="text-2xl font-bold text-white">{poolData.reserve1.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                </div>
                <Badge variant="outline">Asset 2</Badge>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold text-blue-400 mb-1">{t('poolDash.ammFormula')}</p>
                  <p>{t('poolDash.poolMaintains')}</p>
                  <p className="mt-2 font-mono text-xs">
                    {poolData.reserve0.toFixed(2)} × {poolData.reserve1.toFixed(2)} = {constantProduct.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Your Position Tab */}
        <TabsContent value="position" className="space-y-4">
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">{t('poolDash.yourLpPosition')}</h3>

            {!selectedAccount ? (
              <Alert className="bg-yellow-900/20 border-yellow-500">
                <Info className="h-4 w-4" />
                <AlertDescription>{t('poolDash.connectWallet')}</AlertDescription>
              </Alert>
            ) : !lpPosition ? (
              <div className="text-center py-8 text-gray-400">
                <Droplet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('poolDash.noPosition')}</p>
                <Button
                  onClick={() => setIsAddLiquidityModalOpen(true)}
                  className="mt-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  {t('poolDash.addLiquidity')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">{t('poolDash.lpTokens')}</p>
                    <p className="text-xl font-bold text-white">{lpPosition.lpTokenBalance.toFixed(4)}</p>
                  </div>
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">{t('poolDash.poolShare')}</p>
                    <p className="text-xl font-bold text-white">{lpPosition.share.toFixed(4)}%</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">{t('poolDash.positionValue')}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">{asset0Symbol}:</span>
                      <span className="text-white font-semibold">{lpPosition.asset0Amount.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{asset1Symbol}:</span>
                      <span className="text-white font-semibold">{lpPosition.asset1Amount.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">{t('poolDash.estimatedEarnings', { apr: estimateAPR().toFixed(2) })}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">{t('poolDash.daily')}</span>
                      <span className="text-green-400">~{((lpPosition.asset0Amount * 2 * estimateAPR()) / 365 / 100).toFixed(4)} {asset0Symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{t('poolDash.monthly')}</span>
                      <span className="text-green-400">~{((lpPosition.asset0Amount * 2 * estimateAPR()) / 12 / 100).toFixed(4)} {asset0Symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{t('poolDash.yearly')}</span>
                      <span className="text-green-400">~{((lpPosition.asset0Amount * 2 * estimateAPR()) / 100).toFixed(4)} {asset0Symbol}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Button
                    onClick={() => setIsAddLiquidityModalOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    {t('poolDash.addMore')}
                  </Button>
                  <Button
                    onClick={() => setIsStakingModalOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Lock className="w-4 h-4 mr-1" />
                    {t('poolDash.stakeLP')}
                  </Button>
                  <Button
                    onClick={() => setIsRemoveLiquidityModalOpen(true)}
                    variant="outline"
                    className="border-red-600 text-red-400 hover:bg-red-900/20"
                  >
                    {t('poolDash.remove')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Impermanent Loss Calculator Tab */}
        <TabsContent value="calculator" className="space-y-4">
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">{t('poolDash.ilCalcTitle')}</h3>

            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-3">{t('poolDash.ifPriceChanges', { symbol: asset0Symbol })}</p>

                <div className="space-y-2">
                  {[10, 25, 50, 100, 200].map((change) => {
                    const il = calculateImpermanentLoss(change);
                    return (
                      <div key={change} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                        <span className="text-gray-300">+{change}%</span>
                        <Badge
                          variant="outline"
                          className={il < -1 ? 'border-red-500 text-red-400' : 'border-yellow-500 text-yellow-400'}
                        >
                          {t('poolDash.loss', { percent: il.toFixed(2) })}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Alert className="bg-orange-900/20 border-orange-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">{t('poolDash.whatIsIL')}</p>
                  <p className="text-sm text-gray-300">
                    {t('poolDash.ilExplanation')}
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddLiquidityModal
        isOpen={isAddLiquidityModalOpen}
        onClose={() => setIsAddLiquidityModalOpen(false)}
        asset0={poolData?.asset0}
        asset1={poolData?.asset1}
      />

      {lpPosition && poolData && (
        <RemoveLiquidityModal
          isOpen={isRemoveLiquidityModalOpen}
          onClose={() => setIsRemoveLiquidityModalOpen(false)}
          lpPosition={lpPosition}
          lpTokenId={poolData.lpTokenId}
          asset0={poolData.asset0}
          asset1={poolData.asset1}
        />
      )}

      <LPStakingModal
        isOpen={isStakingModalOpen}
        onClose={() => setIsStakingModalOpen(false)}
      />
    </div>
  );
};

export default PoolDashboard;
