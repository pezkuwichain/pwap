import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { AppColors, KurdistanColors } from '../theme/colors';
import {
  Card,
  Button,
  Input,
  BottomSheet,
  Badge,
  ValidatorSelectionSheet,
  CardSkeleton,
} from '../components';
import { getStakingInfo } from '../../shared/lib/staking';
import { getAllScores } from '../../shared/lib/scores';
import { formatBalance } from '../../shared/lib/wallet';

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

export default function StakingScreen() {
  const { api, selectedAccount, isApiReady, getKeyPair } = usePezkuwi();
  
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

  const fetchStakingData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      if (!api || !selectedAccount || !isApiReady) return;

      // 1. Get Staking Info
      const stakingInfo = await getStakingInfo(api, selectedAccount.address);
      
      // 2. Get Scores
      const scores = await getAllScores(api, selectedAccount.address);

      // 3. Get Current Era
      const currentEraOpt = await api.query.staking.currentEra() as any;
      const currentEra = currentEraOpt.unwrapOrDefault().toNumber();

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
      if (__DEV__) console.error('Error fetching staking data:', error);
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
      if (__DEV__) console.error('Staking error:', error);
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
      if (__DEV__) console.error('Unstaking error:', error);
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
      if (__DEV__) console.error('Withdraw error:', error);
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
      if (__DEV__) console.error('Nomination error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to nominate validators.');
    } finally {
      setProcessing(false);
    }
  };

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
          ⚠️ Unstaked tokens will be locked for ~28 days (unbonding period)
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