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

interface DisputeCase {
  id: string;
  caseNumber: string;
  titleKu: string;
  title: string;
  description: string;
  status: 'open' | 'in-review' | 'resolved';
  category: string;
  filedDate: string;
  resolvedDate?: string;
  resolution?: string;
}

const CASES: DisputeCase[] = [
  {
    id: '1',
    caseNumber: 'DKR-2026-001',
    titleKu: 'Nakokiya Dravdana Token',
    title: 'Token Transaction Dispute',
    description: 'Dispute over a failed transaction of 500 HEZ between two parties. Sender claims tokens were deducted but receiver did not receive them.',
    status: 'open',
    category: 'Transaction',
    filedDate: '2026-04-02',
  },
  {
    id: '2',
    caseNumber: 'DKR-2026-002',
    titleKu: 'Binpêkirina Peymana Zîrek',
    title: 'Smart Contract Violation',
    description: 'A DeFi protocol allegedly failed to distribute staking rewards as specified in its smart contract terms.',
    status: 'in-review',
    category: 'Smart Contract',
    filedDate: '2026-03-28',
  },
  {
    id: '3',
    caseNumber: 'DKR-2025-047',
    titleKu: 'Destavêtina Nasnameya Dijîtal',
    title: 'Digital Identity Fraud',
    description: 'A citizen reported unauthorized use of their digital identity credentials to access governance voting.',
    status: 'resolved',
    category: 'Identity',
    filedDate: '2026-02-15',
    resolvedDate: '2026-03-10',
    resolution: 'Identity credentials were revoked and reissued. Fraudulent votes were invalidated. Perpetrator account suspended.',
  },
  {
    id: '4',
    caseNumber: 'DKR-2025-039',
    titleKu: 'Nakokiya NFT ya Milkiyetê',
    title: 'NFT Ownership Dispute',
    description: 'Two parties claim ownership of the same NFT certificate. Investigation revealed a minting error in the original smart contract.',
    status: 'resolved',
    category: 'NFT / Ownership',
    filedDate: '2026-01-20',
    resolvedDate: '2026-02-28',
    resolution: 'Both parties received compensatory NFTs. Smart contract was patched to prevent duplicate minting.',
  },
];

const JusticeScreen: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getStatusStyle = (status: DisputeCase['status']) => {
    switch (status) {
      case 'open': return { bg: KurdistanColors.sor + '15', color: KurdistanColors.sor, label: 'Vekirî / Open' };
      case 'in-review': return { bg: KurdistanColors.zer + '30', color: '#B8860B', label: 'Di lêkolînê de / In Review' };
      case 'resolved': return { bg: KurdistanColors.kesk + '15', color: KurdistanColors.kesk, label: 'Çareserkirî / Resolved' };
    }
  };

  const openCount = CASES.filter((c) => c.status === 'open').length;
  const reviewCount = CASES.filter((c) => c.status === 'in-review').length;
  const resolvedCount = CASES.filter((c) => c.status === 'resolved').length;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>⚖️</Text>
        <Text style={styles.headerTitle}>Dadwerî</Text>
        <Text style={styles.headerSubtitle}>Justice & Dispute Resolution</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftColor: KurdistanColors.sor }]}>
          <Text style={styles.statNumber}>{openCount}</Text>
          <Text style={styles.statLabel}>Vekirî{'\n'}Open</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: KurdistanColors.zer }]}>
          <Text style={styles.statNumber}>{reviewCount}</Text>
          <Text style={styles.statLabel}>Lêkolîn{'\n'}In Review</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: KurdistanColors.kesk }]}>
          <Text style={styles.statNumber}>{resolvedCount}</Text>
          <Text style={styles.statLabel}>Çareser{'\n'}Resolved</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Çareserkirina Nakokiyan / Dispute Resolution</Text>
        <Text style={styles.infoText}>
          Sîstema dadweriya dijîtal a Kurdistanê nakokiyên di navbera welatiyên dijîtal de bi awayekî adil û zelal çareser dike. Hemû biryar li ser blockchain tên tomarkirin.
        </Text>
        <Text style={styles.infoTextEn}>
          Kurdistan's digital justice system resolves disputes between digital citizens fairly and transparently. All decisions are recorded on the blockchain.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dozên Dawî / Recent Cases</Text>
        {CASES.map((caseItem) => {
          const statusInfo = getStatusStyle(caseItem.status);
          const isExpanded = selectedCase === caseItem.id;

          return (
            <TouchableOpacity
              key={caseItem.id}
              style={styles.caseCard}
              onPress={() => setSelectedCase(isExpanded ? null : caseItem.id)}
              activeOpacity={0.7}
            >
              <View style={styles.caseHeader}>
                <Text style={styles.caseNumber}>{caseItem.caseNumber}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.caseTitleKu}>{caseItem.titleKu}</Text>
              <Text style={styles.caseTitle}>{caseItem.title}</Text>

              <View style={styles.caseMeta}>
                <Text style={styles.caseCategory}>📁 {caseItem.category}</Text>
                <Text style={styles.caseDate}>📅 {caseItem.filedDate}</Text>
              </View>

              {isExpanded && (
                <View style={styles.caseDetails}>
                  <Text style={styles.caseDescription}>{caseItem.description}</Text>
                  {caseItem.resolution && (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionLabel}>Biryar / Resolution:</Text>
                      <Text style={styles.resolutionText}>{caseItem.resolution}</Text>
                      <Text style={styles.resolutionDate}>
                        Dîroka çareseriyê: {caseItem.resolvedDate}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.expandHint}>
                {isExpanded ? '▲ Kêmtir' : '▼ Bêtir'}
              </Text>
            </TouchableOpacity>
          );
        })}
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: KurdistanColors.reş },
  statLabel: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4 },
  infoCard: {
    margin: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 8 },
  infoText: { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 8 },
  infoTextEn: { fontSize: 12, color: '#999', lineHeight: 18 },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  caseCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseNumber: { fontSize: 12, fontWeight: '600', color: KurdistanColors.şîn },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  caseTitleKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 2 },
  caseTitle: { fontSize: 13, color: '#666', marginBottom: 8 },
  caseMeta: { flexDirection: 'row', gap: 16 },
  caseCategory: { fontSize: 12, color: '#AAA' },
  caseDate: { fontSize: 12, color: '#AAA' },
  caseDetails: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
  caseDescription: { fontSize: 13, color: '#555', lineHeight: 20 },
  resolutionBox: {
    marginTop: 12,
    backgroundColor: KurdistanColors.kesk + '10',
    borderRadius: 8,
    padding: 12,
  },
  resolutionLabel: { fontSize: 13, fontWeight: 'bold', color: KurdistanColors.kesk, marginBottom: 4 },
  resolutionText: { fontSize: 13, color: '#555', lineHeight: 20 },
  resolutionDate: { fontSize: 11, color: '#AAA', marginTop: 8 },
  expandHint: { fontSize: 12, color: KurdistanColors.kesk, textAlign: 'center', marginTop: 8 },
});

export default JusticeScreen;
