import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

interface SavingsAccount {
  id: string;
  nameKu: string;
  name: string;
  apy: string;
  minDeposit: string;
  lockPeriod: string;
  totalDeposited: string;
  emoji: string;
}

interface LendingPool {
  id: string;
  nameKu: string;
  name: string;
  borrowRate: string;
  collateralRatio: string;
  available: string;
  emoji: string;
}

const SAVINGS: SavingsAccount[] = [
  { id: 's1', emoji: '🌱', nameKu: 'Teserûfa Destpêk', name: 'Starter Savings', apy: '4.5%', minDeposit: '100 HEZ', lockPeriod: 'Tune / None', totalDeposited: '125,430 HEZ' },
  { id: 's2', emoji: '🌿', nameKu: 'Teserûfa Navîn', name: 'Growth Savings', apy: '8.2%', minDeposit: '1,000 HEZ', lockPeriod: '90 roj / days', totalDeposited: '892,100 HEZ' },
  { id: 's3', emoji: '🌳', nameKu: 'Teserûfa Zêrîn', name: 'Gold Savings', apy: '12.0%', minDeposit: '10,000 HEZ', lockPeriod: '365 roj / days', totalDeposited: '2,340,000 HEZ' },
];

const LENDING: LendingPool[] = [
  { id: 'l1', emoji: '💳', nameKu: 'Deyna Bilez', name: 'Flash Loan', borrowRate: '0.1%', collateralRatio: 'Tune / None', available: '50,000 HEZ' },
  { id: 'l2', emoji: '🏠', nameKu: 'Deyna Kesane', name: 'Personal Loan', borrowRate: '5.5%', collateralRatio: '150%', available: '200,000 HEZ' },
  { id: 'l3', emoji: '🏢', nameKu: 'Deyna Karsaziyê', name: 'Business Loan', borrowRate: '3.8%', collateralRatio: '200%', available: '500,000 HEZ' },
];

const BankScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'savings' | 'lending' | 'treasury'>('savings');
  const [refreshing, setRefreshing] = useState(false);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏦</Text>
        <Text style={styles.headerTitle}>Banka Dijîtal</Text>
        <Text style={styles.headerSubtitle}>Digital Bank of Kurdistan</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Bihaya Giştî / Total Value</Text>
          <Text style={styles.balanceAmount}>24,580.00 HEZ</Text>
          <Text style={styles.balanceUsd}>~ $1,229.00</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {(['savings', 'lending', 'treasury'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'savings' ? 'Teserûf' : tab === 'lending' ? 'Deyn' : 'Xezîne'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'savings' && (
          <>
            <Text style={styles.sectionTitle}>Hesabên Teserûfê / Savings Accounts</Text>
            <Text style={styles.sectionDesc}>
              Tokenên xwe stake bikin û xelatên salane bistînin.{'\n'}
              Stake your tokens and earn annual rewards.
            </Text>
            {SAVINGS.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <Text style={styles.accountEmoji}>{account.emoji}</Text>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountNameKu}>{account.nameKu}</Text>
                    <Text style={styles.accountName}>{account.name}</Text>
                  </View>
                  <View style={styles.apyBadge}>
                    <Text style={styles.apyText}>{account.apy} APY</Text>
                  </View>
                </View>
                <View style={styles.accountDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Kêmtirîn / Min</Text>
                    <Text style={styles.detailValue}>{account.minDeposit}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Kilîtkirin / Lock</Text>
                    <Text style={styles.detailValue}>{account.lockPeriod}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Giştî / Total</Text>
                    <Text style={styles.detailValue}>{account.totalDeposited}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.depositButton}>
                  <Text style={styles.depositButtonText}>Depo bike / Deposit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {activeTab === 'lending' && (
          <>
            <Text style={styles.sectionTitle}>Hovzên Deyndanê / Lending Pools</Text>
            <Text style={styles.sectionDesc}>
              Bi rêya peymana zîrek deyn bistînin.{'\n'}
              Borrow through smart contracts with collateral.
            </Text>
            {LENDING.map((pool) => (
              <View key={pool.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <Text style={styles.accountEmoji}>{pool.emoji}</Text>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountNameKu}>{pool.nameKu}</Text>
                    <Text style={styles.accountName}>{pool.name}</Text>
                  </View>
                  <View style={[styles.apyBadge, styles.borrowBadge]}>
                    <Text style={styles.borrowRateText}>{pool.borrowRate}</Text>
                  </View>
                </View>
                <View style={styles.accountDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Rêje / Rate</Text>
                    <Text style={styles.detailValue}>{pool.borrowRate}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Garantî / Collateral</Text>
                    <Text style={styles.detailValue}>{pool.collateralRatio}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Peyda / Available</Text>
                    <Text style={styles.detailValue}>{pool.available}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.depositButton, styles.borrowButton]}>
                  <Text style={styles.depositButtonText}>Deyn bistîne / Borrow</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {activeTab === 'treasury' && (
          <>
            <Text style={styles.sectionTitle}>Xezîneya Civakê / Community Treasury</Text>
            <Text style={styles.sectionDesc}>
              Xezîneya giştî ya Komara Dijîtal a Kurdistanê.{'\n'}
              The public treasury of the Digital Kurdistan Republic.
            </Text>
            <View style={styles.treasuryCard}>
              <Text style={styles.treasuryLabel}>Bihaya Xezîneyê / Treasury Balance</Text>
              <Text style={styles.treasuryAmount}>12,450,000 HEZ</Text>
              <Text style={styles.treasuryUsd}>~ $622,500</Text>
            </View>
            <View style={styles.allocationCard}>
              <Text style={styles.allocationTitle}>Dabeşkirin / Allocation</Text>
              {[
                { label: 'Perwerde / Education', pct: '25%', color: KurdistanColors.kesk },
                { label: 'Teknolojî / Technology', pct: '30%', color: KurdistanColors.şîn },
                { label: 'Ewlehî / Security', pct: '15%', color: KurdistanColors.sor },
                { label: 'Civak / Community', pct: '20%', color: KurdistanColors.mor },
                { label: 'Pareztî / Reserve', pct: '10%', color: KurdistanColors.zer },
              ].map((item, i) => (
                <View key={i} style={styles.allocationRow}>
                  <View style={[styles.allocationDot, { backgroundColor: item.color }]} />
                  <Text style={styles.allocationLabel}>{item.label}</Text>
                  <Text style={styles.allocationPct}>{item.pct}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: KurdistanColors.kesk,
  },
  headerIcon: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: KurdistanColors.spi },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  balanceCard: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', color: KurdistanColors.spi, marginTop: 4 },
  balanceUsd: { fontSize: 14, color: KurdistanColors.zer, marginTop: 2 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: KurdistanColors.kesk },
  tabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTextActive: { color: KurdistanColors.spi },
  content: { padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#888', lineHeight: 19, marginBottom: 14 },
  accountCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  accountEmoji: { fontSize: 32, marginRight: 12 },
  accountInfo: { flex: 1 },
  accountNameKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş },
  accountName: { fontSize: 12, color: '#888', marginTop: 1 },
  apyBadge: {
    backgroundColor: KurdistanColors.kesk + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  apyText: { fontSize: 13, fontWeight: 'bold', color: KurdistanColors.kesk },
  borrowBadge: { backgroundColor: KurdistanColors.şîn + '15' },
  borrowRateText: { fontSize: 13, fontWeight: 'bold', color: KurdistanColors.şîn },
  accountDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  detailItem: { alignItems: 'center', flex: 1 },
  detailLabel: { fontSize: 10, color: '#AAA', marginBottom: 4 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#555' },
  depositButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  borrowButton: { backgroundColor: KurdistanColors.şîn },
  depositButtonText: { color: KurdistanColors.spi, fontSize: 14, fontWeight: '600' },
  treasuryCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  treasuryLabel: { fontSize: 13, color: '#888' },
  treasuryAmount: { fontSize: 28, fontWeight: 'bold', color: KurdistanColors.kesk, marginTop: 6 },
  treasuryUsd: { fontSize: 14, color: '#AAA', marginTop: 2 },
  allocationCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
  },
  allocationTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  allocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  allocationDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  allocationLabel: { flex: 1, fontSize: 14, color: '#555' },
  allocationPct: { fontSize: 14, fontWeight: 'bold', color: KurdistanColors.reş },
});

export default BankScreen;
