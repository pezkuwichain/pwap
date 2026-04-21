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

interface Certificate {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  description: string;
  issuedDate: string;
  issuer: string;
  status: 'earned' | 'in-progress' | 'locked';
  progress?: number;
  tokenId?: string;
}

const CERTIFICATES: Certificate[] = [
  {
    id: '1',
    emoji: '🏛️',
    titleKu: 'Welatiya Dijîtal',
    title: 'Digital Citizenship',
    description: 'Granted upon completing citizen registration and identity verification.',
    issuedDate: '2025-11-15',
    issuer: 'Komara Dijîtal a Kurdistanê',
    status: 'earned',
    tokenId: 'NFT-CIT-00472',
  },
  {
    id: '2',
    emoji: '⛏️',
    titleKu: 'Validator ya Torê',
    title: 'Network Validator',
    description: 'Earned by running a validator node for at least 30 consecutive days.',
    issuedDate: '2026-01-20',
    issuer: 'Pezkuwi Network',
    status: 'earned',
    tokenId: 'NFT-VAL-00089',
  },
  {
    id: '3',
    emoji: '💰',
    titleKu: 'Staker ya Zêrîn',
    title: 'Gold Staker',
    description: 'Awarded for staking more than 10,000 HEZ for 90+ days.',
    issuedDate: '2026-02-10',
    issuer: 'Pezkuwi Staking',
    status: 'earned',
    tokenId: 'NFT-STK-00156',
  },
  {
    id: '4',
    emoji: '🗳️',
    titleKu: 'Dengdera Çalak',
    title: 'Active Voter',
    description: 'Participate in at least 10 governance votes. Progress: 7/10 votes.',
    issuedDate: '',
    issuer: 'Governance DAO',
    status: 'in-progress',
    progress: 70,
  },
  {
    id: '5',
    emoji: '🎓',
    titleKu: 'Fêrbûna Blockchain 101',
    title: 'Blockchain 101 Graduate',
    description: 'Complete the Blockchain 101 course at Kurdistan Digital University.',
    issuedDate: '',
    issuer: 'Zanîngeha Dijîtal',
    status: 'in-progress',
    progress: 45,
  },
  {
    id: '6',
    emoji: '🌍',
    titleKu: 'Balyozê Civakê',
    title: 'Community Ambassador',
    description: 'Invite 50 new citizens to join the digital republic.',
    issuedDate: '',
    issuer: 'Komara Dijîtal',
    status: 'locked',
  },
  {
    id: '7',
    emoji: '🛡️',
    titleKu: 'Parêzvanê Ewlehiyê',
    title: 'Security Guardian',
    description: 'Report and help resolve 3 security vulnerabilities.',
    issuedDate: '',
    issuer: 'Security Council',
    status: 'locked',
  },
];

const CertificatesScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const earned = CERTIFICATES.filter((c) => c.status === 'earned');
  const inProgress = CERTIFICATES.filter((c) => c.status === 'in-progress');
  const locked = CERTIFICATES.filter((c) => c.status === 'locked');

  const renderCertificate = (cert: Certificate) => {
    const isEarned = cert.status === 'earned';
    const isLocked = cert.status === 'locked';

    return (
      <View
        key={cert.id}
        style={[
          styles.certCard,
          isEarned && styles.certCardEarned,
          isLocked && styles.certCardLocked,
        ]}
      >
        <View style={styles.certHeader}>
          <Text style={[styles.certEmoji, isLocked && styles.certEmojiLocked]}>
            {isLocked ? '🔒' : cert.emoji}
          </Text>
          <View style={styles.certInfo}>
            <Text style={[styles.certTitleKu, isLocked && styles.textLocked]}>
              {cert.titleKu}
            </Text>
            <Text style={[styles.certTitle, isLocked && styles.textLocked]}>
              {cert.title}
            </Text>
          </View>
          {isEarned && (
            <View style={styles.earnedBadge}>
              <Text style={styles.earnedText}>✓</Text>
            </View>
          )}
        </View>

        <Text style={[styles.certDescription, isLocked && styles.textLocked]}>
          {cert.description}
        </Text>

        {isEarned && (
          <View style={styles.certMeta}>
            <Text style={styles.certIssuer}>Derketî ji: {cert.issuer}</Text>
            <Text style={styles.certDate}>📅 {cert.issuedDate}</Text>
            {cert.tokenId && (
              <TouchableOpacity style={styles.tokenBadge}>
                <Text style={styles.tokenText}>🔗 {cert.tokenId}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {cert.status === 'in-progress' && cert.progress !== undefined && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${cert.progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{cert.progress}%</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏆</Text>
        <Text style={styles.headerTitle}>Sertîfîkayên Min</Text>
        <Text style={styles.headerSubtitle}>My Certificates</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {earned.length} bidestxistî / earned
          </Text>
        </View>
      </View>

      {earned.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bidestxistî / Earned</Text>
          {earned.map(renderCertificate)}
        </View>
      )}

      {inProgress.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Di Pêvajoyê de / In Progress</Text>
          {inProgress.map(renderCertificate)}
        </View>
      )}

      {locked.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Girtî / Locked</Text>
          {locked.map(renderCertificate)}
        </View>
      )}

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
  headerBadge: {
    marginTop: 10,
    backgroundColor: KurdistanColors.zer,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: { fontSize: 12, fontWeight: 'bold', color: KurdistanColors.reş },
  section: { padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  certCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  certCardEarned: {
    borderLeftWidth: 3,
    borderLeftColor: KurdistanColors.kesk,
  },
  certCardLocked: {
    opacity: 0.6,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  certEmoji: { fontSize: 36, marginRight: 12 },
  certEmojiLocked: { opacity: 0.5 },
  certInfo: { flex: 1 },
  certTitleKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş },
  certTitle: { fontSize: 13, color: '#666', marginTop: 1 },
  textLocked: { color: '#AAA' },
  earnedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnedText: { color: KurdistanColors.spi, fontSize: 14, fontWeight: 'bold' },
  certDescription: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 10 },
  certMeta: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  certIssuer: { fontSize: 12, color: '#888', marginBottom: 4 },
  certDate: { fontSize: 12, color: '#AAA', marginBottom: 6 },
  tokenBadge: {
    backgroundColor: KurdistanColors.şîn + '15',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tokenText: { fontSize: 11, color: KurdistanColors.şîn, fontWeight: '600' },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: KurdistanColors.zer,
    borderRadius: 4,
  },
  progressText: { fontSize: 13, fontWeight: 'bold', color: '#888' },
});

export default CertificatesScreen;
