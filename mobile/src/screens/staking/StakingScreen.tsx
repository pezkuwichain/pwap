import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { AppColors, KurdistanColors } from '../../theme/colors';
import {
  Card,
  Button,
  Input,
  BottomSheet,
  Badge,
  ValidatorSelectionSheet,
  CardSkeleton,
} from '../../components';
import { getStakingInfo } from '../../../shared/lib/staking';
import { getAllScores } from '../../../shared/lib/scores';
import { formatBalance } from '../../../shared/lib/wallet';
import { logger } from '../../utils/logger';

// Nomination Pool types
interface NominationPool {
  id: number;
  name: string;
  state: 'Open' | 'Blocked' | 'Destroying';
  memberCount: number;
  points: string;
  roles: {
    depositor: string;
    root?: string;
    nominator?: string;
    bouncer?: string;
  };
}

interface PoolMembership {
  poolId: number;
  points: string;
  pendingRewards: string;
  unbondingEras: Array<{ era: number; amount: string }>;
}

// Helper types derived from shared lib
interface StakingScreenData {
  stakedAmount: string;
  unbondingAmount: string;
  monthlyReward: string;
  tikiScore: number;
  stakingScore: number;
  weightedScore: number;
  estimatedAPY: string;
  unlocking: { amount: string; era: number; blocksRemaining: number }[];
  currentEra: number;
}

const SCORE_WEIGHTS = {
  tiki: 40,
  citizenship: 30,
  staking: 30,
};

type StakingTab = 'direct' | 'pools';

export default function StakingScreen() {
  const { api, selectedAccount, isApiReady, getKeyPair } = usePezkuwi();

  const [activeTab, setActiveTab] = useState<StakingTab>('direct');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stakingData, setStakingData] = useState<StakingScreenData | null>(null);

  // Modal states
  const [stakeSheetVisible, setStakeSheetVisible] = useState(false);
  const [unstakeSheetVisible, setUnstakeSheetVisible] = useState(false);
  const [validatorSheetVisible, setValidatorSheetVisible] = useState(false);

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Nomination Pools state
  const [pools, setPools] = useState<NominationPool[]>([]);
  const [poolMembership, setPoolMembership] = useState<PoolMembership | null>(null);
  const [loadingPools, setLoadingPools] = useState(false);
  const [poolJoinSheetVisible, setPoolJoinSheetVisible] = useState(false);
  const [poolBondMoreSheetVisible, setPoolBondMoreSheetVisible] = useState(false);
  const [poolUnbondSheetVisible, setPoolUnbondSheetVisible] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [poolAmount, setPoolAmount] = useState('');
  const [poolSearchQuery, setPoolSearchQuery] = useState('');

  const fetchStakingData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      if (!api || !selectedAccount || !isApiReady) return;

      // 1. Get Staking Info
      const stakingInfo = await getStakingInfo(api, selectedAccount.address);
      
      // 2. Get Scores
      const scores = await getAllScores(api, selectedAccount.address);

      // 3. Get Current Era
      const currentEraOpt = await api.query.staking.currentEra();
      const currentEra = currentEraOpt.isSome
        ? (currentEraOpt as unknown as { unwrap: () => { toNumber: () => number } }).unwrap().toNumber()
        : 0;

      // Calculations
      const stakedAmount = stakingInfo.bonded;
      const unbondingAmount = stakingInfo.unlocking.reduce(
        (acc, chunk) => acc + parseFloat(formatBalance(chunk.amount, 12)), 
        0
      ).toString(); // Keep as string for now to match UI expectations if needed, or re-format

      // Estimate Monthly Reward (Simplified)
      // 15% APY Base + Score Bonus (up to 5% extra)
      const baseAPY = 0.15;
      const scoreBonus = (scores.totalScore / 1000) * 0.05; // Example logic
      const totalAPY = baseAPY + scoreBonus;
      
      const stakedNum = parseFloat(stakedAmount);
      const monthlyReward = stakedNum > 0 
        ? ((stakedNum * totalAPY) / 12).toFixed(2)
        : '0.00';
      
      const estimatedAPY = (totalAPY * 100).toFixed(2);

      // Unlocking Chunks
      const unlocking = stakingInfo.unlocking.map(u => ({
        amount: u.amount,
        era: u.era,
        blocksRemaining: u.blocksRemaining
      }));

      setStakingData({
        stakedAmount: stakedAmount,
        unbondingAmount: unbondingAmount, // This might need formatting depending on formatBalance output
        monthlyReward,
        tikiScore: scores.tikiScore,
        stakingScore: scores.stakingScore,
        weightedScore: scores.totalScore, // Using total score as weighted score
        estimatedAPY,
        unlocking,
        currentEra
      });

    } catch (error) {
      logger.error('Error fetching staking data:', error);
      Alert.alert('Error', 'Failed to load staking data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, selectedAccount, isApiReady, refreshing]);

  useEffect(() => {
    if (isApiReady && selectedAccount) {
      fetchStakingData();
    }
  }, [isApiReady, selectedAccount, fetchStakingData]);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;

      // Get keypair for signing
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve wallet keypair for signing');
        return;
      }

      // Convert amount to planck
      const amountPlanck = BigInt(Math.floor(parseFloat(stakeAmount) * 1e12));

      // Bond tokens (or bond_extra if already bonding)
      const tx = api.tx.staking.bondExtra(amountPlanck);

      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', `Successfully staked ${stakeAmount} HEZ!`);
          setStakeSheetVisible(false);
          setStakeAmount('');
          fetchStakingData();
        }
      });
    } catch (error: unknown) {
      logger.error('Staking error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to stake tokens');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;

      // Get keypair for signing
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve wallet keypair for signing');
        return;
      }

      const amountPlanck = BigInt(Math.floor(parseFloat(unstakeAmount) * 1e12));

      const tx = api.tx.staking.unbond(amountPlanck);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert(
            'Success',
            `Successfully initiated unstaking of ${unstakeAmount} HEZ!\n\nTokens will be available after unbonding period.`
          );
          setUnstakeSheetVisible(false);
          setUnstakeAmount('');
          fetchStakingData();
        }
      });
    } catch (error: unknown) {
      logger.error('Unstaking error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to unstake tokens');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleWithdrawUnbonded = async () => {
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;

      // Get keypair for signing
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve wallet keypair for signing');
        return;
      }

      // Withdraw all available unbonded funds
      // num_slashing_spans is usually 0 for simple stakers
      const tx = api.tx.staking.withdrawUnbonded(0);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', 'Successfully withdrawn unbonded tokens!');
          fetchStakingData();
        }
      });
    } catch (error: unknown) {
      logger.error('Withdraw error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to withdraw tokens');
    } finally {
      setProcessing(false);
    }
  };

  const handleNominateValidators = async (validators: string[]) => {
    if (!validators || validators.length === 0) {
      Alert.alert('Error', 'Please select at least one validator.');
      return;
    }
    if (!api || !selectedAccount) return;

    setProcessing(true);
    try {
      // Get keypair for signing
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve wallet keypair for signing');
        setProcessing(false);
        return;
      }

      const tx = api.tx.staking.nominate(validators);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', 'Nomination transaction sent!');
          setValidatorSheetVisible(false);
          fetchStakingData();
        }
      });
    } catch (error: unknown) {
      logger.error('Nomination error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to nominate validators.');
    } finally {
      setProcessing(false);
    }
  };

  // === Nomination Pools Logic ===
  const fetchNominationPools = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;
    setLoadingPools(true);

    try {
      // Fetch all pools
      const poolEntries = await api.query.nominationPools.bondedPools.entries();
      const poolList: NominationPool[] = [];

      for (const [key, value] of poolEntries) {
        const poolId = (key.args[0] as unknown as { toNumber(): number }).toNumber();
        const poolData = value.toJSON() as unknown as {
          memberCounter?: number;
          points?: string | number;
          state?: string;
          roles?: { depositor?: string; root?: string; nominator?: string; bouncer?: string };
        };

        if (!poolData) continue;

        // Fetch pool name from metadata
        let poolName = `Pool #${poolId}`;
        try {
          const meta = await api.query.nominationPools.metadata(poolId);
          const metaStr = meta.toHuman() as string;
          if (metaStr) poolName = metaStr;
        } catch { /* use default name */ }

        const stateStr = typeof poolData.state === 'string' ? poolData.state : 'Open';

        poolList.push({
          id: poolId,
          name: poolName,
          state: stateStr as NominationPool['state'],
          memberCount: poolData.memberCounter || 0,
          points: String(poolData.points || '0'),
          roles: {
            depositor: poolData.roles?.depositor || '',
            root: poolData.roles?.root,
            nominator: poolData.roles?.nominator,
            bouncer: poolData.roles?.bouncer,
          },
        });
      }

      setPools(poolList);

      // Check if user is in a pool
      try {
        const memberData = await api.query.nominationPools.poolMembers(selectedAccount.address);
        const member = memberData.toJSON() as unknown as {
          poolId?: number;
          points?: string | number;
          unbondingEras?: Record<string, string | number>;
        };

        if (member && member.poolId) {
          // Fetch pending rewards
          let pendingRewards = '0';
          try {
            const rewardResult = await (api.call as unknown as {
              nominationPoolsApi?: { pendingRewards(addr: string): Promise<{ toString(): string }> };
            }).nominationPoolsApi?.pendingRewards(selectedAccount.address);
            if (rewardResult) pendingRewards = rewardResult.toString();
          } catch {
            // Runtime API may not be available
          }

          const unbondingEras: Array<{ era: number; amount: string }> = [];
          if (member.unbondingEras) {
            for (const [era, amount] of Object.entries(member.unbondingEras)) {
              unbondingEras.push({ era: Number(era), amount: String(amount) });
            }
          }

          setPoolMembership({
            poolId: member.poolId,
            points: String(member.points || '0'),
            pendingRewards,
            unbondingEras,
          });
        } else {
          setPoolMembership(null);
        }
      } catch {
        setPoolMembership(null);
      }
    } catch (error) {
      logger.error('Error fetching nomination pools:', error);
    } finally {
      setLoadingPools(false);
    }
  }, [api, isApiReady, selectedAccount]);

  useEffect(() => {
    if (activeTab === 'pools' && isApiReady && selectedAccount) {
      fetchNominationPools();
    }
  }, [activeTab, isApiReady, selectedAccount, fetchNominationPools]);

  const handleJoinPool = async () => {
    if (!poolAmount || parseFloat(poolAmount) <= 0 || selectedPoolId === null) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) { Alert.alert('Error', 'Could not retrieve keypair'); return; }

      const amountPlanck = BigInt(Math.floor(parseFloat(poolAmount) * 1e12));
      const tx = api.tx.nominationPools.join(amountPlanck, selectedPoolId);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', `Joined pool #${selectedPoolId} with ${poolAmount} HEZ!`);
          setPoolJoinSheetVisible(false);
          setPoolAmount('');
          fetchNominationPools();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join pool');
    } finally {
      setProcessing(false);
    }
  };

  const handlePoolBondMore = async () => {
    if (!poolAmount || parseFloat(poolAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) { Alert.alert('Error', 'Could not retrieve keypair'); return; }

      const amountPlanck = BigInt(Math.floor(parseFloat(poolAmount) * 1e12));
      const tx = api.tx.nominationPools.bondExtra({ FreeBalance: amountPlanck });
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', `Added ${poolAmount} HEZ to pool!`);
          setPoolBondMoreSheetVisible(false);
          setPoolAmount('');
          fetchNominationPools();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to bond more');
    } finally {
      setProcessing(false);
    }
  };

  const handlePoolUnbond = async () => {
    if (!poolAmount || parseFloat(poolAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) { Alert.alert('Error', 'Could not retrieve keypair'); return; }

      const amountPlanck = BigInt(Math.floor(parseFloat(poolAmount) * 1e12));
      const tx = api.tx.nominationPools.unbond(selectedAccount.address, amountPlanck);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', `Unbonding ${poolAmount} HEZ from pool`);
          setPoolUnbondSheetVisible(false);
          setPoolAmount('');
          fetchNominationPools();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to unbond');
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimPoolRewards = async () => {
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) { Alert.alert('Error', 'Could not retrieve keypair'); return; }

      const tx = api.tx.nominationPools.claimPayout();
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', 'Pool rewards claimed!');
          fetchNominationPools();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to claim rewards');
    } finally {
      setProcessing(false);
    }
  };

  const handlePoolWithdrawUnbonded = async () => {
    try {
      setProcessing(true);
      if (!api || !selectedAccount) return;
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) { Alert.alert('Error', 'Could not retrieve keypair'); return; }

      const tx = api.tx.nominationPools.withdrawUnbonded(selectedAccount.address, 0);
      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert('Success', 'Withdrawn unbonded tokens from pool!');
          fetchNominationPools();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to withdraw');
    } finally {
      setProcessing(false);
    }
  };

  const filteredPools = pools.filter(p => {
    if (!poolSearchQuery) return p.state === 'Open';
    const q = poolSearchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || String(p.id).includes(q);
  });

  // === Render ===

  if (loading && !stakingData) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (!stakingData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No staking data available</Text>
          <Button title="Retry" onPress={fetchStakingData} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'direct' && styles.tabActive]}
          onPress={() => setActiveTab('direct')}
          accessibilityRole="button"
          accessibilityLabel="Direct staking tab"
        >
          <Text style={[styles.tabText, activeTab === 'direct' && styles.tabTextActive]}>Direct Staking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pools' && styles.tabActive]}
          onPress={() => setActiveTab('pools')}
          accessibilityRole="button"
          accessibilityLabel="Nomination pools tab"
        >
          <Text style={[styles.tabText, activeTab === 'pools' && styles.tabTextActive]}>Nomination Pools</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pools' ? (
        /* === Nomination Pools Tab === */
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              fetchNominationPools().then(() => setRefreshing(false));
            }} />
          }
        >
          {/* Current Pool Membership */}
          {poolMembership && (
            <Card style={styles.poolMembershipCard}>
              <Text style={styles.poolMembershipTitle}>Your Pool</Text>
              <Text style={styles.poolMembershipPool}>
                Pool #{poolMembership.poolId} — {pools.find(p => p.id === poolMembership.poolId)?.name || ''}
              </Text>
              <View style={styles.poolMemberStats}>
                <View style={styles.poolMemberStat}>
                  <Text style={styles.poolStatLabel}>Bonded</Text>
                  <Text style={styles.poolStatValue}>
                    {formatBalance(poolMembership.points, 12)} HEZ
                  </Text>
                </View>
                <View style={styles.poolMemberStat}>
                  <Text style={styles.poolStatLabel}>Rewards</Text>
                  <Text style={[styles.poolStatValue, { color: KurdistanColors.kesk }]}>
                    {formatBalance(poolMembership.pendingRewards, 12)} HEZ
                  </Text>
                </View>
              </View>

              {/* Pool Member Actions */}
              <View style={styles.poolMemberActions}>
                <Button
                  title="Bond More"
                  onPress={() => setPoolBondMoreSheetVisible(true)}
                  variant="primary"
                  size="small"
                />
                <Button
                  title="Unbond"
                  onPress={() => setPoolUnbondSheetVisible(true)}
                  variant="outline"
                  size="small"
                />
                {parseFloat(poolMembership.pendingRewards) > 0 && (
                  <Button
                    title="Claim"
                    onPress={handleClaimPoolRewards}
                    loading={processing}
                    variant="primary"
                    size="small"
                  />
                )}
              </View>

              {/* Unbonding chunks */}
              {poolMembership.unbondingEras.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.poolStatLabel}>Unbonding:</Text>
                  {poolMembership.unbondingEras.map((chunk, i) => (
                    <Text key={i} style={styles.poolUnbondingText}>
                      {formatBalance(chunk.amount, 12)} HEZ — Era {chunk.era}
                    </Text>
                  ))}
                  <Button
                    title="Withdraw Available"
                    onPress={handlePoolWithdrawUnbonded}
                    loading={processing}
                    variant="outline"
                    size="small"
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}
            </Card>
          )}

          {/* Pool Search */}
          <View style={styles.poolSearchContainer}>
            <TextInput
              style={styles.poolSearchInput}
              placeholder="Search pools..."
              placeholderTextColor="#999"
              value={poolSearchQuery}
              onChangeText={setPoolSearchQuery}
              accessibilityLabel="Search nomination pools"
            />
          </View>

          {/* Pool List */}
          {loadingPools ? (
            <View style={styles.poolLoadingContainer}>
              <ActivityIndicator size="large" color={KurdistanColors.kesk} />
              <Text style={styles.poolLoadingText}>Loading pools...</Text>
            </View>
          ) : filteredPools.length === 0 ? (
            <View style={styles.poolEmptyContainer}>
              <Text style={styles.poolEmptyText}>No open pools found</Text>
            </View>
          ) : (
            filteredPools.map((pool) => (
              <Card key={pool.id} style={styles.poolCard}>
                <View style={styles.poolCardHeader}>
                  <View>
                    <Text style={styles.poolCardName}>{pool.name}</Text>
                    <Text style={styles.poolCardId}>Pool #{pool.id}</Text>
                  </View>
                  <Badge
                    label={pool.state}
                    variant={pool.state === 'Open' ? 'success' : 'secondary'}
                    size="small"
                  />
                </View>
                <View style={styles.poolCardStats}>
                  <View style={styles.poolCardStat}>
                    <Text style={styles.poolCardStatLabel}>Members</Text>
                    <Text style={styles.poolCardStatValue}>{pool.memberCount}</Text>
                  </View>
                  <View style={styles.poolCardStat}>
                    <Text style={styles.poolCardStatLabel}>Total Staked</Text>
                    <Text style={styles.poolCardStatValue}>
                      {formatBalance(pool.points, 12)} HEZ
                    </Text>
                  </View>
                </View>
                {pool.state === 'Open' && !poolMembership && (
                  <Button
                    title="Join Pool"
                    onPress={() => {
                      setSelectedPoolId(pool.id);
                      setPoolJoinSheetVisible(true);
                    }}
                    variant="primary"
                    size="small"
                    fullWidth
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>
            ))
          )}

          {/* Info */}
          <Card variant="outlined" style={styles.infoCard}>
            <Text style={styles.infoTitle}>About Nomination Pools</Text>
            <Text style={styles.infoText}>
              Nomination pools allow you to stake with as little as 1 HEZ by pooling funds with other stakers. The pool operator manages validator selection.
            </Text>
          </Card>
        </ScrollView>
      ) : (

      /* === Direct Staking Tab === */
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchStakingData();
          }} />
        }
      >
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Text style={styles.headerTitle}>Total Staked</Text>
          <Text style={styles.headerAmount}>
            {stakingData.stakedAmount} HEZ
          </Text>
          <Text style={styles.headerSubtitle}>
            ≈ ${(parseFloat(stakingData.stakedAmount) * 0.15).toFixed(2)} USD
          </Text>
        </Card>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Monthly Reward</Text>
            <Text style={styles.statValue}>{stakingData.monthlyReward} PEZ</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Est. APY</Text>
            <Text style={styles.statValue}>{stakingData.estimatedAPY}%</Text>
          </Card>
        </View>

        {/* Score Card */}
        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTitle}>Your Total Score</Text>
            <Badge label={`${stakingData.weightedScore} pts`} variant="primary" />
          </View>
          <View style={styles.scoreBreakdown}>
            <ScoreItem
              label="Tiki Score"
              value={stakingData.tikiScore}
              weight={SCORE_WEIGHTS.tiki}
            />
            <ScoreItem
              label="Staking Score"
              value={stakingData.stakingScore}
              weight={SCORE_WEIGHTS.staking}
            />
          </View>
          <Text style={styles.scoreNote}>
            Higher score = Higher rewards & voting power
          </Text>
        </Card>

        {/* Unbonding Card */}
        {(parseFloat(stakingData.unbondingAmount) > 0 || stakingData.unlocking.length > 0) && (
          <Card style={styles.unbondingCard}>
            <View style={styles.unbondingHeader}>
              <Text style={styles.unbondingTitle}>Unbonding</Text>
              <Text style={styles.unbondingTotal}>
                {stakingData.unbondingAmount} HEZ
              </Text>
            </View>
            
            <View style={styles.chunksList}>
              {stakingData.unlocking.map((chunk, index) => {
                const remainingEras = Math.max(0, chunk.era - stakingData.currentEra);
                const isReady = remainingEras === 0;
                
                return (
                  <View key={index} style={styles.chunkItem}>
                    <View>
                      <Text style={styles.chunkAmount}>
                        {formatBalance(chunk.amount, 12)} HEZ
                      </Text>
                      <Text style={styles.chunkRemaining}>
                        {isReady ? 'Ready to withdraw' : `Available in ~${remainingEras} eras`}
                      </Text>
                    </View>
                    {isReady && (
                      <Badge label="Ready" variant="success" size="small" />
                    )}
                  </View>
                );
              })}
            </View>

            {stakingData.unlocking.some(chunk => chunk.era <= stakingData.currentEra) && (
              <Button
                title="Withdraw Available"
                onPress={handleWithdrawUnbonded}
                loading={processing}
                variant="primary"
                size="small"
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Stake HEZ"
            onPress={() => setStakeSheetVisible(true)}
            variant="primary"
            fullWidth
          />
          <Button
            title="Unstake"
            onPress={() => setUnstakeSheetVisible(true)}
            variant="outline"
            fullWidth
          />
          <Button
            title="Select Validators"
            onPress={() => setValidatorSheetVisible(true)}
            variant="secondary"
            fullWidth
          />
        </View>

        {/* Info Card */}
        <Card variant="outlined" style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 About Staking</Text>
          <Text style={styles.infoText}>
            Stake HEZ tokens to earn monthly PEZ rewards. Your reward amount is based on your staking score, which includes your Tiki roles and citizenship status.
          </Text>
        </Card>
      </ScrollView>
      )}

      {/* Stake Bottom Sheet */}
      <BottomSheet
        visible={stakeSheetVisible}
        onClose={() => setStakeSheetVisible(false)}
        title="Stake HEZ"
      >
        <Input
          label="Amount (HEZ)"
          value={stakeAmount}
          onChangeText={setStakeAmount}
          keyboardType="numeric"
          placeholder="0.00"
        />
        <Button
          title="Stake"
          onPress={handleStake}
          loading={processing}
          disabled={processing}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </BottomSheet>

      {/* Unstake Bottom Sheet */}
      <BottomSheet
        visible={unstakeSheetVisible}
        onClose={() => setUnstakeSheetVisible(false)}
        title="Unstake HEZ"
      >
        <Input
          label="Amount (HEZ)"
          value={unstakeAmount}
          onChangeText={setUnstakeAmount}
          keyboardType="numeric"
          placeholder="0.00"
        />
        <Text style={styles.warningText}>
          Unstaked tokens will be locked for ~28 days (unbonding period)
        </Text>
        <Button
          title="Unstake"
          onPress={handleUnstake}
          loading={processing}
          disabled={processing}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </BottomSheet>

      {/* Validator Selection Bottom Sheet */}
      <ValidatorSelectionSheet
        visible={validatorSheetVisible}
        onClose={() => setValidatorSheetVisible(false)}
        onConfirmNominations={handleNominateValidators}
      />

      {/* Pool Join Bottom Sheet */}
      <BottomSheet
        visible={poolJoinSheetVisible}
        onClose={() => setPoolJoinSheetVisible(false)}
        title={`Join Pool #${selectedPoolId}`}
      >
        <Input
          label="Amount (HEZ)"
          value={poolAmount}
          onChangeText={setPoolAmount}
          keyboardType="numeric"
          placeholder="0.00"
        />
        <Button
          title="Join Pool"
          onPress={handleJoinPool}
          loading={processing}
          disabled={processing}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </BottomSheet>

      {/* Pool Bond More Bottom Sheet */}
      <BottomSheet
        visible={poolBondMoreSheetVisible}
        onClose={() => setPoolBondMoreSheetVisible(false)}
        title="Bond More to Pool"
      >
        <Input
          label="Amount (HEZ)"
          value={poolAmount}
          onChangeText={setPoolAmount}
          keyboardType="numeric"
          placeholder="0.00"
        />
        <Button
          title="Bond More"
          onPress={handlePoolBondMore}
          loading={processing}
          disabled={processing}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </BottomSheet>

      {/* Pool Unbond Bottom Sheet */}
      <BottomSheet
        visible={poolUnbondSheetVisible}
        onClose={() => setPoolUnbondSheetVisible(false)}
        title="Unbond from Pool"
      >
        <Input
          label="Amount (HEZ)"
          value={poolAmount}
          onChangeText={setPoolAmount}
          keyboardType="numeric"
          placeholder="0.00"
        />
        <Text style={styles.warningText}>
          Unbonded tokens will be locked for ~28 days
        </Text>
        <Button
          title="Unbond"
          onPress={handlePoolUnbond}
          loading={processing}
          disabled={processing}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </BottomSheet>
    </View>
  );
}

const ScoreItem: React.FC<{ label: string; value: number; weight: number }> = ({
  label,
  value,
  weight,
}) => (
  <View style={styles.scoreItem}>
    <Text style={styles.scoreItemLabel}>{label}</Text>
    <View style={styles.scoreItemRight}>
      <Text style={styles.scoreItemValue}>{value} pts</Text>
      <Text style={styles.scoreItemWeight}>×{weight}%</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 16,
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  // Pool Membership Card
  poolMembershipCard: {
    marginBottom: 16,
    backgroundColor: `${KurdistanColors.kesk}08`,
    borderWidth: 1,
    borderColor: `${KurdistanColors.kesk}30`,
  },
  poolMembershipTitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  poolMembershipPool: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 12,
  },
  poolMemberStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  poolMemberStat: {
    flex: 1,
  },
  poolStatLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  poolStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  poolMemberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  poolUnbondingText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: 4,
  },
  // Pool Search
  poolSearchContainer: {
    marginBottom: 16,
  },
  poolSearchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  poolLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  poolLoadingText: {
    marginTop: 12,
    color: AppColors.textSecondary,
  },
  poolEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  poolEmptyText: {
    color: AppColors.textSecondary,
    fontSize: 15,
  },
  // Pool Card
  poolCard: {
    marginBottom: 12,
  },
  poolCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  poolCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  poolCardId: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  poolCardStats: {
    flexDirection: 'row',
    gap: 16,
  },
  poolCardStat: {
    flex: 1,
  },
  poolCardStatLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 2,
  },
  poolCardStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginBottom: 16,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 8,
  },
  headerAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: KurdistanColors.kesk,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  scoreCard: {
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
  },
  scoreBreakdown: {
    gap: 12,
    marginBottom: 16,
  },
  scoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  scoreItemLabel: {
    fontSize: 14,
    color: AppColors.text,
  },
  scoreItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  scoreItemWeight: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  scoreNote: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontStyle: 'italic',
  },
  unbondingCard: {
    marginBottom: 16,
    backgroundColor: `${KurdistanColors.zer}10`,
  },
  unbondingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  unbondingTitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  unbondingTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  chunksList: {
    gap: 8,
  },
  chunkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
  },
  chunkAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
  },
  chunkRemaining: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 12,
    color: KurdistanColors.sor,
    marginVertical: 12,
    padding: 12,
    backgroundColor: `${KurdistanColors.sor}10`,
    borderRadius: 8,
  },
});