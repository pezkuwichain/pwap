import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, WifiOff, Users, Box, TrendingUp } from 'lucide-react';

export const NetworkStats: React.FC = () => {
  const { t } = useTranslation();
  const { api, assetHubApi, peopleApi, isApiReady, isAssetHubReady, isPeopleReady, error } = usePezkuwi();
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [blockHash, setBlockHash] = useState<string>('');
  const [finalizedBlock, setFinalizedBlock] = useState<number>(0);
  const [validatorCount, setValidatorCount] = useState<number>(0);
  const [collatorCount, setCollatorCount] = useState<number>(0);
  const [nominatorCount, setNominatorCount] = useState<number>(0);
  const [peers, setPeers] = useState<number>(0);

  useEffect(() => {
    if (!api || !isApiReady) return;

    let unsubscribeNewHeads: () => void;
    let unsubscribeFinalizedHeads: () => void;
    let intervalId: NodeJS.Timeout;

    const subscribeToBlocks = async () => {
      try {
        // Subscribe to new blocks
        unsubscribeNewHeads = await api.rpc.chain.subscribeNewHeads((header) => {
          setBlockNumber(header.number.toNumber());
          setBlockHash(header.hash.toHex());
        });

        // Subscribe to finalized blocks
        unsubscribeFinalizedHeads = await api.rpc.chain.subscribeFinalizedHeads((header) => {
          setFinalizedBlock(header.number.toNumber());
        });

        // Update validator count, collator count, nominator count, and peer count every 3 seconds
        const updateNetworkStats = async () => {
          try {
            const health = await api.rpc.system.health();

            // 1. Fetch Validators
            let vCount = 0;
            try {
              if (api.query.session?.validators) {
                const validators = await api.query.session.validators();
                if (validators) {
                  vCount = validators.length;
                }
              }
            } catch (err) {
              if (import.meta.env.DEV) console.warn('Failed to fetch validators', err);
            }

            // 2. Fetch Collators from Parachains (Asset Hub + People Chain)
            let cCount = 0;

            // Fetch from Asset Hub
            try {
              if (isAssetHubReady && assetHubApi?.query.collatorSelection?.invulnerables) {
                const assetHubCollators = await assetHubApi.query.collatorSelection.invulnerables();
                if (assetHubCollators) {
                  cCount += assetHubCollators.length;
                }
              }
            } catch (err) {
              if (import.meta.env.DEV) console.warn('Failed to fetch Asset Hub collators', err);
            }

            // Fetch from People Chain
            try {
              if (isPeopleReady && peopleApi?.query.collatorSelection?.invulnerables) {
                const peopleCollators = await peopleApi.query.collatorSelection.invulnerables();
                if (peopleCollators) {
                  cCount += peopleCollators.length;
                }
              }
            } catch (err) {
              if (import.meta.env.DEV) console.warn('Failed to fetch People Chain collators', err);
            }

            // 3. Count Nominators
            let nCount = 0;
            try {
              const nominators = await api.query.staking?.nominators.entries();
              if (nominators) {
                nCount = nominators.length;
              }
            } catch {
              if (import.meta.env.DEV) console.warn('Staking pallet not available, nominators = 0');
            }

            setValidatorCount(vCount);
            setCollatorCount(cCount);
            setNominatorCount(nCount);
            setPeers(health.peers.toNumber());
          } catch (err) {
            if (import.meta.env.DEV) console.error('Failed to update network stats:', err);
          }
        };

        // Initial update
        await updateNetworkStats();

        // Update every 3 seconds
        intervalId = setInterval(updateNetworkStats, 3000);

      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to subscribe to blocks:', err);
      }
    };

    subscribeToBlocks();

    return () => {
      if (unsubscribeNewHeads) unsubscribeNewHeads();
      if (unsubscribeFinalizedHeads) unsubscribeFinalizedHeads();
      if (intervalId) clearInterval(intervalId);
    };
  }, [api, assetHubApi, peopleApi, isApiReady, isAssetHubReady, isPeopleReady]);

  if (error) {
    return (
      <Card className="bg-red-950/50 border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <WifiOff className="w-5 h-5" />
            {t('networkStats.disconnected')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-300 text-sm">{error}</p>
          <p className="text-red-400 text-xs mt-2">
            {t('networkStats.disconnectedDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isApiReady) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            {t('networkStats.connecting')}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* Connection Status */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-500" />
            {t('networkStats.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
              {t('networkStats.connected')}
            </Badge>
            <span className="text-xs text-gray-500">{peers} {t('networkStats.peers')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Latest Block */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-500" />
            {t('networkStats.latestBlock')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              #{blockNumber.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 font-mono truncate">
              {blockHash.slice(0, 10)}...{blockHash.slice(-8)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Finalized Block */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            {t('networkStats.finalizedBlock')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            #{finalizedBlock.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {blockNumber - finalizedBlock} {t('networkStats.blocksBehind')}
          </div>
        </CardContent>
      </Card>

      {/* Validators */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-yellow-500" />
            {t('networkStats.activeValidators')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {validatorCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('networkStats.validating')}
          </div>
        </CardContent>
      </Card>

      {/* Collators */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-500" />
            {t('networkStats.activeCollators')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {collatorCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('networkStats.producing')}
          </div>
        </CardContent>
      </Card>

      {/* Nominators */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-500" />
            {t('networkStats.activeNominators')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {nominatorCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('networkStats.staking')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
