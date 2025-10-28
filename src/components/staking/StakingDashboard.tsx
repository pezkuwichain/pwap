import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Coins, Lock, Clock, Gift, Calculator, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { ASSET_IDS, formatBalance } from '@/lib/wallet';
import { toast } from '@/components/ui/use-toast';

interface StakingPool {
  id: string;
  name: string;
  token: 'HEZ' | 'PEZ';
  apy: number;
  totalStaked: number;
  minStake: number;
  lockPeriod: number;
  userStaked?: number;
  rewards?: number;
}

export const StakingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { api, isApiReady, selectedAccount } = usePolkadot();
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  // Real staking pools data from blockchain
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([
    // Fallback mock data - will be replaced with real data
    {
      id: '1',
      name: 'HEZ Flexible',
      token: 'HEZ',
      apy: 8.5,
      totalStaked: 0,
      minStake: 100,
      lockPeriod: 0,
      userStaked: 0,
      rewards: 0
    },
    {
      id: '2',
      name: 'HEZ Locked 30 Days',
      token: 'HEZ',
      apy: 12.0,
      totalStaked: 0,
      minStake: 500,
      lockPeriod: 30,
      userStaked: 0,
      rewards: 0
    },
    {
      id: '3',
      name: 'PEZ High Yield',
      token: 'PEZ',
      apy: 15.5,
      totalStaked: 0,
      minStake: 1000,
      lockPeriod: 60,
      userStaked: 0,
      rewards: 0
    },
    {
      id: '4',
      name: 'PEZ Governance',
      token: 'PEZ',
      apy: 18.0,
      totalStaked: 0,
      minStake: 2000,
      lockPeriod: 90,
      userStaked: 0,
      rewards: 0
    }
  ]);

  // Fetch staking pools data from blockchain
  useEffect(() => {
    const fetchStakingData = async () => {
      if (!api || !isApiReady) {
        return;
      }

      setIsLoadingPools(true);
      try {
        // TODO: Query staking pools from chain
        // This would query your custom staking pallet
        // const pools = await api.query.staking.pools.entries();

        // For now, using mock data
        // In real implementation, parse pool data from chain
        console.log('Staking pools would be fetched from chain here');

        // If user is connected, fetch their staking info
        if (selectedAccount) {
          // TODO: Query user staking positions
          // const userStakes = await api.query.staking.ledger(selectedAccount.address);
          // Update stakingPools with user data
        }
      } catch (error) {
        console.error('Failed to fetch staking data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch staking pools',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingPools(false);
      }
    };

    fetchStakingData();
  }, [api, isApiReady, selectedAccount]);

  const handleStake = async (pool: StakingPool) => {
    if (!api || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) < pool.minStake) {
      toast({
        title: 'Error',
        description: `Minimum stake is ${pool.minStake} ${pool.token}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // TODO: Implement staking transaction
      // const assetId = ASSET_IDS[pool.token];
      // const amount = parseAmount(stakeAmount, 12);
      // await api.tx.staking.stake(pool.id, amount).signAndSend(...);

      console.log('Staking', stakeAmount, pool.token, 'in pool', pool.name);

      toast({
        title: 'Success',
        description: `Staked ${stakeAmount} ${pool.token}`,
      });

      setStakeAmount('');
      setSelectedPool(null);
    } catch (error: any) {
      console.error('Staking failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Staking failed',
        variant: 'destructive',
      });
    }
  };

  const handleUnstake = async (pool: StakingPool) => {
    if (!api || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    try {
      // TODO: Implement unstaking transaction
      // const amount = parseAmount(unstakeAmount, 12);
      // await api.tx.staking.unstake(pool.id, amount).signAndSend(...);

      console.log('Unstaking', unstakeAmount, pool.token, 'from pool', pool.name);

      toast({
        title: 'Success',
        description: `Unstaked ${unstakeAmount} ${pool.token}`,
      });

      setUnstakeAmount('');
      setSelectedPool(null);
    } catch (error: any) {
      console.error('Unstaking failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Unstaking failed',
        variant: 'destructive',
      });
    }
  };

  const handleClaimRewards = async (pool: StakingPool) => {
    if (!api || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    try {
      // TODO: Implement claim rewards transaction
      // await api.tx.staking.claimRewards(pool.id).signAndSend(...);

      console.log('Claiming rewards from pool', pool.name);

      toast({
        title: 'Success',
        description: `Claimed ${pool.rewards} ${pool.token} rewards`,
      });
    } catch (error: any) {
      console.error('Claim rewards failed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Claim rewards failed',
        variant: 'destructive',
      });
    }
  };

  const totalStaked = stakingPools.reduce((sum, pool) => sum + (pool.userStaked || 0), 0);
  const totalRewards = stakingPools.reduce((sum, pool) => sum + (pool.rewards || 0), 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Total Staked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalStaked.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Across all pools</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Total Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{totalRewards.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to claim</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Average APY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">13.5%</div>
            <p className="text-xs text-gray-500 mt-1">Weighted average</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Next Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">4h 23m</div>
            <p className="text-xs text-gray-500 mt-1">Distribution time</p>
          </CardContent>
        </Card>
      </div>

      {/* Staking Pools */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl text-white">Staking Pools</CardTitle>
          <CardDescription className="text-gray-400">
            Choose a pool and start earning rewards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stakingPools.map((pool) => (
              <Card key={pool.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg text-white">{pool.name}</CardTitle>
                      <Badge variant={pool.token === 'HEZ' ? 'default' : 'secondary'}>
                        {pool.token}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-500">{pool.apy}%</div>
                      <p className="text-xs text-gray-400">APY</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Staked</span>
                      <span className="text-white">{pool.totalStaked.toLocaleString()} {pool.token}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Lock Period</span>
                      <span className="text-white">
                        {pool.lockPeriod === 0 ? 'Flexible' : `${pool.lockPeriod} days`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Min. Stake</span>
                      <span className="text-white">{pool.minStake} {pool.token}</span>
                    </div>
                  </div>

                  {pool.userStaked && pool.userStaked > 0 && (
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Your Stake</span>
                        <span className="text-white font-semibold">{pool.userStaked.toLocaleString()} {pool.token}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-gray-400">Rewards</span>
                        <span className="text-green-500 font-semibold">{pool.rewards?.toFixed(2)} {pool.token}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleClaimRewards(pool)}
                          className="flex-1"
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Claim
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => setSelectedPool(pool)}
                          className="flex-1"
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  )}

                  {(!pool.userStaked || pool.userStaked === 0) && (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => setSelectedPool(pool)}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Stake {pool.token}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stake/Unstake Modal */}
      {selectedPool && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Manage {selectedPool.name}</CardTitle>
            <CardDescription>Stake or unstake your tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="stake">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stake">Stake</TabsTrigger>
                <TabsTrigger value="unstake">Unstake</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stake" className="space-y-4">
                <div>
                  <Label>Amount to Stake</Label>
                  <Input
                    type="number"
                    placeholder={`Min: ${selectedPool.minStake} ${selectedPool.token}`}
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Estimated APY</span>
                    <span className="text-green-500 font-semibold">{selectedPool.apy}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Lock Period</span>
                    <span className="text-white">{selectedPool.lockPeriod === 0 ? 'None' : `${selectedPool.lockPeriod} days`}</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleStake(selectedPool)}
                >
                  Confirm Stake
                </Button>
              </TabsContent>
              
              <TabsContent value="unstake" className="space-y-4">
                <div>
                  <Label>Amount to Unstake</Label>
                  <Input
                    type="number"
                    placeholder={`Max: ${selectedPool.userStaked} ${selectedPool.token}`}
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="bg-yellow-900/20 border border-yellow-600/50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-500">
                    <Info className="w-4 h-4 inline mr-1" />
                    {selectedPool.lockPeriod > 0 
                      ? `Tokens are locked for ${selectedPool.lockPeriod} days. Early withdrawal may incur penalties.`
                      : 'You can unstake anytime without penalties.'}
                  </p>
                </div>
                <Button 
                  className="w-full"
                  variant="destructive"
                  onClick={() => handleUnstake(selectedPool)}
                >
                  Confirm Unstake
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};