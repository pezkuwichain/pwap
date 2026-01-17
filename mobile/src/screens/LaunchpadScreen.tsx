import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Linking,
  FlatList,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';

// Types from pezpallet-presale
type PresaleStatus = 'Pending' | 'Active' | 'Paused' | 'Successful' | 'Failed' | 'Cancelled' | 'Finalized';

interface ContributionLimits {
  minContribution: string;
  maxContribution: string;
  softCap: string;
  hardCap: string;
}

interface VestingSchedule {
  immediateReleasePercent: number;
  vestingDurationBlocks: number;
  cliffBlocks: number;
}

interface PresaleConfig {
  id: number;
  owner: string;
  paymentAsset: number;
  rewardAsset: number;
  tokensForSale: string;
  startBlock: number;
  duration: number;
  status: PresaleStatus;
  accessControl: 'Public' | 'Whitelist';
  limits: ContributionLimits;
  vesting: VestingSchedule | null;
  gracePeriodBlocks: number;
  refundFeePercent: number;
  graceRefundFeePercent: number;
  // Computed fields
  totalRaised: string;
  contributorCount: number;
  endBlock: number;
  progress: number;
  timeRemaining: { days: number; hours: number; minutes: number };
}

interface ContributionInfo {
  amount: string;
  contributedAt: number;
  refunded: boolean;
}

const BLOCK_TIME_SECONDS = 6;
const PLATFORM_FEE_PERCENT = 2;

const LaunchpadScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api, selectedAccount, isApiReady, getKeyPair } = usePezkuwi();

  const [presales, setPresales] = useState<PresaleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [selectedPresale, setSelectedPresale] = useState<PresaleConfig | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [userContributions, setUserContributions] = useState<Record<number, ContributionInfo>>({});
  const [assetBalances, setAssetBalances] = useState<Record<number, string>>({});
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);

  // Fetch all presales from chain
  const fetchPresales = useCallback(async () => {
    if (!api || !isApiReady) {
      setLoading(false);
      return;
    }

    try {
      // Get current block
      const header = await api.rpc.chain.getHeader();
      const blockNum = header.number.toNumber();
      setCurrentBlock(blockNum);

      // Get next presale ID to know how many presales exist
      const nextId = await api.query.presale?.nextPresaleId?.();
      const maxPresaleId = nextId ? parseInt(nextId.toString()) : 0;

      if (maxPresaleId === 0) {
        setPresales([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const presaleList: PresaleConfig[] = [];

      // Fetch each presale
      for (let id = 0; id < maxPresaleId; id++) {
        const presaleData = await api.query.presale?.presales?.(id);
        if (!presaleData || presaleData.isNone) continue;

        const config = presaleData.toJSON() as any;
        if (!config) continue;

        // Get total raised and contributors
        const totalRaised = await api.query.presale?.totalRaised?.(id);
        const contributors = await api.query.presale?.contributors?.(id);

        const startBlock = config.startBlock || 0;
        const duration = config.duration || 0;
        const endBlock = startBlock + duration;
        const totalRaisedStr = totalRaised?.toString() || '0';
        const hardCap = config.limits?.hardCap || '0';

        // Calculate progress
        const progress = hardCap !== '0'
          ? Math.min(100, (parseFloat(totalRaisedStr) / parseFloat(hardCap)) * 100)
          : 0;

        // Calculate time remaining
        const blocksRemaining = Math.max(0, endBlock - blockNum);
        const secondsRemaining = blocksRemaining * BLOCK_TIME_SECONDS;
        const timeRemaining = {
          days: Math.floor(secondsRemaining / 86400),
          hours: Math.floor((secondsRemaining % 86400) / 3600),
          minutes: Math.floor((secondsRemaining % 3600) / 60),
        };

        presaleList.push({
          id,
          owner: config.owner || '',
          paymentAsset: config.paymentAsset || 0,
          rewardAsset: config.rewardAsset || 0,
          tokensForSale: config.tokensForSale?.toString() || '0',
          startBlock,
          duration,
          status: config.status || 'Pending',
          accessControl: config.accessControl || 'Public',
          limits: {
            minContribution: config.limits?.minContribution?.toString() || '0',
            maxContribution: config.limits?.maxContribution?.toString() || '0',
            softCap: config.limits?.softCap?.toString() || '0',
            hardCap: hardCap.toString(),
          },
          vesting: config.vesting || null,
          gracePeriodBlocks: config.gracePeriodBlocks || 0,
          refundFeePercent: config.refundFeePercent || 0,
          graceRefundFeePercent: config.graceRefundFeePercent || 0,
          totalRaised: totalRaisedStr,
          contributorCount: (contributors?.toHuman() as string[])?.length || 0,
          endBlock,
          progress,
          timeRemaining,
        });
      }

      // Fetch user contributions if wallet connected
      if (selectedAccount?.address) {
        const userContribs: Record<number, ContributionInfo> = {};
        const balances: Record<number, string> = {};

        for (const presale of presaleList) {
          // Get user's contribution for this presale
          const contribution = await api.query.presale?.contributions?.(presale.id, selectedAccount.address);
          if (contribution && !contribution.isNone) {
            const contribData = contribution.toJSON() as any;
            userContribs[presale.id] = {
              amount: contribData?.amount?.toString() || '0',
              contributedAt: contribData?.contributedAt || 0,
              refunded: contribData?.refunded || false,
            };
          }

          // Get payment asset balance
          if (!balances[presale.paymentAsset]) {
            const assetAccount = await api.query.assets?.account?.(presale.paymentAsset, selectedAccount.address);
            balances[presale.paymentAsset] = assetAccount?.balance?.toString() || '0';
          }
        }

        setUserContributions(userContribs);
        setAssetBalances(balances);
      }

      // Sort by status: Active first, then by ID desc
      presaleList.sort((a, b) => {
        const statusOrder: Record<PresaleStatus, number> = {
          Active: 0, Pending: 1, Paused: 2, Successful: 3, Failed: 4, Finalized: 5, Cancelled: 6
        };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return b.id - a.id;
      });

      setPresales(presaleList);
    } catch (error) {
      if (__DEV__) console.error('Error fetching presales:', error);
      // Demo data for offline/testing
      setPresales([
        {
          id: 0,
          owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          paymentAsset: 1000, // wUSDT
          rewardAsset: 1, // PEZ
          tokensForSale: '10000000000000000000', // 10M PEZ
          startBlock: 100000,
          duration: 648000,
          status: 'Active',
          accessControl: 'Public',
          limits: {
            minContribution: '1000000', // 1 wUSDT
            maxContribution: '100000000000', // 100K wUSDT
            softCap: '50000000000', // 50K wUSDT
            hardCap: '500000000000', // 500K wUSDT
          },
          vesting: null,
          gracePeriodBlocks: 14400,
          refundFeePercent: 5,
          graceRefundFeePercent: 1,
          totalRaised: '125000000000',
          contributorCount: 847,
          endBlock: 748000,
          progress: 25,
          timeRemaining: { days: 32, hours: 14, minutes: 22 },
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isApiReady, selectedAccount?.address]);

  useEffect(() => {
    fetchPresales();
  }, [fetchPresales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPresales();
  }, [fetchPresales]);

  // Format asset amount with decimals
  const formatAmount = (amount: string, decimals: number = 6): string => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  // Get status color
  const getStatusColor = (status: PresaleStatus): string => {
    switch (status) {
      case 'Active': return KurdistanColors.kesk;
      case 'Pending': return '#FFA000';
      case 'Paused': return '#FF9800';
      case 'Successful': return '#4CAF50';
      case 'Finalized': return '#2196F3';
      case 'Failed': return '#F44336';
      case 'Cancelled': return '#9E9E9E';
      default: return '#999';
    }
  };

  // Handle contribute
  const handleContribute = async () => {
    if (!api || !selectedAccount || !selectedPresale) {
      Alert.alert('Wallet Pêwîst e', 'Please connect your wallet first.');
      return;
    }

    const amount = parseFloat(contributionAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Mîqdar Çewt', 'Please enter a valid amount.');
      return;
    }

    // Assume payment asset has 6 decimals (wUSDT)
    const amountInUnits = BigInt(Math.floor(amount * 1000000));
    const balance = BigInt(assetBalances[selectedPresale.paymentAsset] || '0');

    if (amountInUnits > balance) {
      Alert.alert('Têrê Nake', `Insufficient balance. You have ${formatAmount(balance.toString())} wUSDT.`);
      return;
    }

    const minContrib = BigInt(selectedPresale.limits.minContribution);
    const maxContrib = BigInt(selectedPresale.limits.maxContribution);
    const existingContrib = BigInt(userContributions[selectedPresale.id]?.amount || '0');
    const newTotal = existingContrib + amountInUnits;

    if (newTotal < minContrib) {
      Alert.alert('Minimum Nake', `Minimum contribution: ${formatAmount(minContrib.toString())} wUSDT`);
      return;
    }

    if (newTotal > maxContrib) {
      Alert.alert('Maximum Derket', `Maximum contribution: ${formatAmount(maxContrib.toString())} wUSDT`);
      return;
    }

    const keyPair = await getKeyPair(selectedAccount.address);
    if (!keyPair) {
      Alert.alert('Çewtî', 'Could not get keyPair.');
      return;
    }

    // Platform fee info
    const fee = (amount * PLATFORM_FEE_PERCENT) / 100;
    const netAmount = amount - fee;

    Alert.alert(
      'Piştrastî Bike / Confirm',
      `Mîqdar: ${amount} wUSDT\nFee (${PLATFORM_FEE_PERCENT}%): ${fee.toFixed(2)} wUSDT\nNet: ${netAmount.toFixed(2)} wUSDT\n\nPresale #${selectedPresale.id}`,
      [
        { text: 'Betal', style: 'cancel' },
        {
          text: 'Piştrastî',
          onPress: async () => {
            setContributing(true);
            try {
              const kp = await getKeyPair(selectedAccount.address);
              if (!kp) throw new Error('KeyPair not found');

              await new Promise<void>((resolve, reject) => {
                api.tx.presale
                  .contribute(selectedPresale.id, amountInUnits.toString())
                  .signAndSend(kp, { nonce: -1 }, ({ status, dispatchError }) => {
                    if (status.isInBlock || status.isFinalized) {
                      if (dispatchError) {
                        if (dispatchError.isModule) {
                          const decoded = api.registry.findMetaError(dispatchError.asModule);
                          reject(new Error(`${decoded.section}.${decoded.name}`));
                        } else {
                          reject(new Error(dispatchError.toString()));
                        }
                      } else {
                        resolve();
                      }
                    }
                  })
                  .catch(reject);
              });

              Alert.alert('Serketî!', `${amount} wUSDT contributed successfully!`);
              setContributionAmount('');
              setShowDetailModal(false);
              fetchPresales();
            } catch (error: any) {
              Alert.alert('Çewtî', error.message || 'Contribution failed.');
            } finally {
              setContributing(false);
            }
          },
        },
      ]
    );
  };

  // Handle refund
  const handleRefund = async (presaleId: number) => {
    if (!api || !selectedAccount) return;

    const keyPair = await getKeyPair(selectedAccount.address);
    if (!keyPair) {
      Alert.alert('Çewtî', 'Could not get keyPair.');
      return;
    }

    Alert.alert(
      'Refund',
      'Are you sure you want to refund? Fees may apply.',
      [
        { text: 'Betal', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              await new Promise<void>((resolve, reject) => {
                api.tx.presale
                  .refund(presaleId)
                  .signAndSend(keyPair, { nonce: -1 }, ({ status, dispatchError }) => {
                    if (status.isInBlock || status.isFinalized) {
                      if (dispatchError) {
                        if (dispatchError.isModule) {
                          const decoded = api.registry.findMetaError(dispatchError.asModule);
                          reject(new Error(`${decoded.section}.${decoded.name}`));
                        } else {
                          reject(new Error(dispatchError.toString()));
                        }
                      } else {
                        resolve();
                      }
                    }
                  })
                  .catch(reject);
              });

              Alert.alert('Serketî!', 'Refund processed successfully!');
              fetchPresales();
            } catch (error: any) {
              Alert.alert('Çewtî', error.message || 'Refund failed.');
            }
          },
        },
      ]
    );
  };

  // Contact for new project
  const handleNewProject = () => {
    Alert.alert(
      '🚀 Projeya Nû',
      'Ji bo ku projeya xwe li ser Pezkuwi Launchpad zêde bikin:\n\n📧 team@pezkuwichain.io',
      [
        { text: 'Paşê', style: 'cancel' },
        {
          text: 'Email Bişîne',
          onPress: () => Linking.openURL('mailto:team@pezkuwichain.io?subject=Launchpad%20Project%20Submission'),
        },
      ]
    );
  };

  // Render presale card
  const renderPresaleCard = ({ item }: { item: PresaleConfig }) => {
    const userContrib = userContributions[item.id];

    return (
      <TouchableOpacity
        style={styles.presaleCard}
        onPress={() => {
          setSelectedPresale(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
          </View>
          <Text style={styles.presaleId}>#{item.id}</Text>
        </View>

        <Text style={styles.tokenName}>Presale #{item.id}</Text>
        <Text style={styles.tokenInfo}>
          {formatAmount(item.tokensForSale, 12)} tokens for sale
        </Text>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {formatAmount(item.totalRaised)} / {formatAmount(item.limits.hardCap)}
            </Text>
            <Text style={styles.progressPercent}>{item.progress.toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
            {/* Soft cap marker */}
            <View style={[
              styles.softCapMarker,
              { left: `${(parseFloat(item.limits.softCap) / parseFloat(item.limits.hardCap)) * 100}%` }
            ]} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.contributorCount}</Text>
            <Text style={styles.statLabel}>Beşdar</Text>
          </View>
          {item.status === 'Active' && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {item.timeRemaining.days}d {item.timeRemaining.hours}h
              </Text>
              <Text style={styles.statLabel}>Mayî</Text>
            </View>
          )}
          {userContrib && !userContrib.refunded && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: KurdistanColors.kesk }]}>
                {formatAmount(userContrib.amount)}
              </Text>
              <Text style={styles.statLabel}>Your</Text>
            </View>
          )}
        </View>

        {item.accessControl === 'Whitelist' && (
          <View style={styles.whitelistBadge}>
            <Text style={styles.whitelistText}>🔒 Whitelist</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading presales...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      {/* Action Bar */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🚀 Launchpad</Text>
          <Text style={styles.headerSubtitle}>Multi-Presale Platform</Text>
        </View>
        <TouchableOpacity onPress={handleNewProject} style={styles.addButton}>
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Platform Stats */}
      <View style={styles.platformStats}>
        <View style={styles.platformStatItem}>
          <Text style={styles.platformStatValue}>{presales.length}</Text>
          <Text style={styles.platformStatLabel}>Presales</Text>
        </View>
        <View style={styles.platformStatItem}>
          <Text style={styles.platformStatValue}>
            {presales.filter(p => p.status === 'Active').length}
          </Text>
          <Text style={styles.platformStatLabel}>Active</Text>
        </View>
        <View style={styles.platformStatItem}>
          <Text style={styles.platformStatValue}>{PLATFORM_FEE_PERCENT}%</Text>
          <Text style={styles.platformStatLabel}>Fee</Text>
        </View>
      </View>

      {/* Presales List */}
      {presales.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚀</Text>
          <Text style={styles.emptyTitle}>Presale Tune</Text>
          <Text style={styles.emptyText}>
            Hîn presale tune. Ji bo ku projeya xwe zêde bikin bi me re têkilî daynin.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleNewProject}>
            <Text style={styles.emptyButtonText}>Projeya Nû Zêde Bike</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={presales}
          renderItem={renderPresaleCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedPresale && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Presale #{selectedPresale.id}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Status */}
              <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedPresale.status) }]}>
                <Text style={styles.detailStatusText}>{selectedPresale.status}</Text>
              </View>

              {/* Progress */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Progress</Text>
                <View style={styles.detailProgressBar}>
                  <View style={[styles.progressFill, { width: `${selectedPresale.progress}%` }]} />
                </View>
                <View style={styles.detailProgressInfo}>
                  <Text style={styles.detailProgressText}>
                    {formatAmount(selectedPresale.totalRaised)} / {formatAmount(selectedPresale.limits.hardCap)} wUSDT
                  </Text>
                  <Text style={styles.detailProgressPercent}>{selectedPresale.progress.toFixed(1)}%</Text>
                </View>
                <Text style={styles.softCapNote}>
                  Soft Cap: {formatAmount(selectedPresale.limits.softCap)} wUSDT
                </Text>
              </View>

              {/* Time Remaining */}
              {selectedPresale.status === 'Active' && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Time Remaining</Text>
                  <View style={styles.timeGrid}>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeValue}>{selectedPresale.timeRemaining.days}</Text>
                      <Text style={styles.timeUnit}>Days</Text>
                    </View>
                    <Text style={styles.timeSeparator}>:</Text>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeValue}>{selectedPresale.timeRemaining.hours}</Text>
                      <Text style={styles.timeUnit}>Hours</Text>
                    </View>
                    <Text style={styles.timeSeparator}>:</Text>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeValue}>{selectedPresale.timeRemaining.minutes}</Text>
                      <Text style={styles.timeUnit}>Min</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Contribution Limits */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Contribution Limits</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Min:</Text>
                  <Text style={styles.detailValue}>{formatAmount(selectedPresale.limits.minContribution)} wUSDT</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Max:</Text>
                  <Text style={styles.detailValue}>{formatAmount(selectedPresale.limits.maxContribution)} wUSDT</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contributors:</Text>
                  <Text style={styles.detailValue}>{selectedPresale.contributorCount}</Text>
                </View>
              </View>

              {/* Refund Info */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Refund Policy</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Grace Period Fee:</Text>
                  <Text style={styles.detailValue}>{selectedPresale.graceRefundFeePercent}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Normal Fee:</Text>
                  <Text style={styles.detailValue}>{selectedPresale.refundFeePercent}%</Text>
                </View>
              </View>

              {/* Your Contribution */}
              {userContributions[selectedPresale.id] && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Your Contribution</Text>
                  <View style={styles.yourContribution}>
                    <Text style={styles.yourContribAmount}>
                      {formatAmount(userContributions[selectedPresale.id].amount)} wUSDT
                    </Text>
                    {userContributions[selectedPresale.id].refunded ? (
                      <Text style={styles.refundedBadge}>Refunded</Text>
                    ) : selectedPresale.status === 'Active' ? (
                      <TouchableOpacity
                        style={styles.refundButton}
                        onPress={() => handleRefund(selectedPresale.id)}
                      >
                        <Text style={styles.refundButtonText}>Refund</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Contribute Form */}
              {selectedPresale.status === 'Active' && (
                <View style={styles.contributeSection}>
                  <Text style={styles.detailSectionTitle}>Contribute</Text>

                  {selectedAccount && (
                    <Text style={styles.balanceText}>
                      Balance: {formatAmount(assetBalances[selectedPresale.paymentAsset] || '0')} wUSDT
                    </Text>
                  )}

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Amount in wUSDT"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                      value={contributionAmount}
                      onChangeText={setContributionAmount}
                      editable={!contributing}
                    />
                    <Text style={styles.inputSuffix}>wUSDT</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.contributeButton, contributing && styles.buttonDisabled]}
                    onPress={handleContribute}
                    disabled={contributing}
                  >
                    {contributing ? (
                      <ActivityIndicator color={KurdistanColors.spi} />
                    ) : (
                      <Text style={styles.contributeButtonText}>Contribute</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.feeNote}>
                    Platform Fee: {PLATFORM_FEE_PERCENT}% (50% treasury, 25% burn, 25% stakers)
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: KurdistanColors.spi,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: 24,
    color: KurdistanColors.spi,
    fontWeight: 'bold',
  },
  platformStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: KurdistanColors.spi,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  platformStatItem: {
    alignItems: 'center',
  },
  platformStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  platformStatLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  presaleCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presaleId: {
    fontSize: 12,
    color: '#888',
  },
  tokenName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 4,
  },
  tokenInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#666',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 3,
  },
  softCapMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: '#FF9800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
  },
  whitelistBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  whitelistText: {
    fontSize: 10,
    color: '#E65100',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: KurdistanColors.spi,
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: KurdistanColors.spi,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalClose: {
    fontSize: 20,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailStatusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  detailStatusText: {
    color: KurdistanColors.spi,
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  detailProgressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  detailProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailProgressText: {
    fontSize: 12,
    color: '#666',
  },
  detailProgressPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  softCapNote: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 8,
  },
  timeGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  timeUnit: {
    fontSize: 10,
    color: '#888',
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#CCC',
    marginHorizontal: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  yourContribution: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yourContribAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  refundedBadge: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  refundButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refundButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  contributeSection: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  balanceText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 18,
    color: '#333',
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  contributeButton: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  contributeButtonText: {
    color: KurdistanColors.spi,
    fontSize: 16,
    fontWeight: '700',
  },
  feeNote: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
});

export default LaunchpadScreen;
