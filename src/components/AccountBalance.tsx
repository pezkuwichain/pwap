import React, { useEffect, useState } from 'react';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AccountBalance: React.FC = () => {
  const { api, isApiReady, selectedAccount } = usePolkadot();
  const [balance, setBalance] = useState<{
    free: string;
    reserved: string;
    total: string;
  }>({
    free: '0',
    reserved: '0',
    total: '0',
  });
  const [pezBalance, setPezBalance] = useState<string>('0');
  const [trustScore, setTrustScore] = useState<string>('-');
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setIsLoading(true);
    try {
      // Fetch HEZ balance
      const { data: balanceData } = await api.query.system.account(selectedAccount.address);
      
      const free = balanceData.free.toString();
      const reserved = balanceData.reserved.toString();
      
      // Convert from plancks to tokens (12 decimals)
      const decimals = 12;
      const divisor = Math.pow(10, decimals);
      
      const freeTokens = (parseInt(free) / divisor).toFixed(4);
      const reservedTokens = (parseInt(reserved) / divisor).toFixed(4);
      const totalTokens = ((parseInt(free) + parseInt(reserved)) / divisor).toFixed(4);

      setBalance({
        free: freeTokens,
        reserved: reservedTokens,
        total: totalTokens,
      });

      // Fetch PEZ balance (Asset ID: 1)
      try {
        const pezAssetBalance = await api.query.assets.account(1, selectedAccount.address);
        
        if (pezAssetBalance.isSome) {
          const assetData = pezAssetBalance.unwrap();
          const pezAmount = assetData.balance.toString();
          const pezTokens = (parseInt(pezAmount) / divisor).toFixed(4);
          setPezBalance(pezTokens);
        } else {
          setPezBalance('0');
        }
      } catch (error) {
        console.error('Failed to fetch PEZ balance:', error);
        setPezBalance('0');
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();

    // Fetch Trust Score
    const fetchTrustScore = async () => {
      if (!api || !isApiReady || !selectedAccount?.address) {
        setTrustScore('-');
        return;
      }

      try {
        const score = await api.query.trust.trustScores(selectedAccount.address);
        setTrustScore(score.toString());
      } catch (err) {
        console.error('Failed to fetch trust score:', err);
        setTrustScore('-');
      }
    };

    fetchTrustScore();

    // Subscribe to HEZ balance updates
    let unsubscribeHez: () => void;
    let unsubscribePez: () => void;

    const subscribeBalance = async () => {
      if (!api || !isApiReady || !selectedAccount) return;

      // Subscribe to HEZ balance
      unsubscribeHez = await api.query.system.account(
        selectedAccount.address,
        ({ data: balanceData }) => {
          const free = balanceData.free.toString();
          const reserved = balanceData.reserved.toString();
          
          const decimals = 12;
          const divisor = Math.pow(10, decimals);
          
          const freeTokens = (parseInt(free) / divisor).toFixed(4);
          const reservedTokens = (parseInt(reserved) / divisor).toFixed(4);
          const totalTokens = ((parseInt(free) + parseInt(reserved)) / divisor).toFixed(4);

          setBalance({
            free: freeTokens,
            reserved: reservedTokens,
            total: totalTokens,
          });
        }
      );

      // Subscribe to PEZ balance (Asset ID: 1)
      try {
        unsubscribePez = await api.query.assets.account(
          1,
          selectedAccount.address,
          (assetBalance) => {
            if (assetBalance.isSome) {
              const assetData = assetBalance.unwrap();
              const pezAmount = assetData.balance.toString();
              const decimals = 12;
              const divisor = Math.pow(10, decimals);
              const pezTokens = (parseInt(pezAmount) / divisor).toFixed(4);
              setPezBalance(pezTokens);
            } else {
              setPezBalance('0');
            }
          }
        );
      } catch (error) {
        console.error('Failed to subscribe to PEZ balance:', error);
      }
    };

    subscribeBalance();

    return () => {
      if (unsubscribeHez) unsubscribeHez();
      if (unsubscribePez) unsubscribePez();
    };
  }, [api, isApiReady, selectedAccount]);

  if (!selectedAccount) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="text-center text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Connect your wallet to view balance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEZ Balance Card */}
      <Card className="bg-gradient-to-br from-green-900/30 to-yellow-900/30 border-green-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-gray-300">
              HEZ Balance
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchBalance}
              disabled={isLoading}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold text-white mb-1">
                {isLoading ? '...' : balance.total}
                <span className="text-2xl text-gray-400 ml-2">HEZ</span>
              </div>
              <div className="text-sm text-gray-400">
                ≈ ${(parseFloat(balance.total) * 0.5).toFixed(2)} USD
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Transferable</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {balance.free} HEZ
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-gray-400">Reserved</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {balance.reserved} HEZ
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PEZ Balance Card */}
      <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-gray-300">
            PEZ Token Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-4xl font-bold text-white mb-1">
              {isLoading ? '...' : pezBalance}
              <span className="text-2xl text-gray-400 ml-2">PEZ</span>
            </div>
            <div className="text-sm text-gray-400">
              Governance & Rewards Token
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Account</span>
              <span className="text-white font-mono">
                {selectedAccount.meta.name || 'Unnamed'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Address</span>
              <span className="text-white font-mono text-xs">
                {selectedAccount.address.slice(0, 8)}...{selectedAccount.address.slice(-8)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Award className="w-3 h-3 text-purple-400" />
                Trust Score
              </span>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {trustScore}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
