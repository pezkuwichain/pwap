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

interface ResearchPaper {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  authors: string;
  abstract: string;
  category: string;
  date: string;
  citations: number;
  status: 'published' | 'peer-review' | 'draft';
}

const PAPERS: ResearchPaper[] = [
  {
    id: '1',
    emoji: '🔗',
    titleKu: 'Blockchain ji bo Aboriya Dijîtal a Kurdistanê',
    title: 'Blockchain for Kurdistan Digital Economy',
    authors: 'Dr. A. Kurdo, M. Ehmed',
    abstract: 'This paper explores the potential of blockchain technology in building a decentralized digital economy for Kurdistan. We propose the Pezkuwi consensus mechanism and analyze its throughput, security, and decentralization trade-offs.',
    category: 'Blockchain',
    date: '2026-02-15',
    citations: 42,
    status: 'published',
  },
  {
    id: '2',
    emoji: '💱',
    titleKu: 'Tokenomiya HEZ: Modela Aborî ya Nenavendî',
    title: 'HEZ Tokenomics: A Decentralized Economic Model',
    authors: 'Prof. R. Xan, S. Demirtash',
    abstract: 'An analysis of the HEZ token economic model including supply dynamics, staking incentives, governance utility, and long-term sustainability. We model inflation, deflation, and equilibrium scenarios.',
    category: 'Economics',
    date: '2026-01-20',
    citations: 31,
    status: 'published',
  },
  {
    id: '3',
    emoji: '🏘️',
    titleKu: 'Bereketli: Aboriya Taxê ya Dijîtal',
    title: 'Bereketli: Digital Neighborhood Economy',
    authors: 'K. Zana, B. Shêx',
    abstract: 'We present Bereketli, a peer-to-peer neighborhood economy platform built on blockchain. The system enables local trade, micro-lending, and community resource sharing with minimal trust assumptions.',
    category: 'DeFi / Social',
    date: '2025-11-30',
    citations: 18,
    status: 'published',
  },
  {
    id: '4',
    emoji: '🗣️',
    titleKu: 'NLP ji bo Zimanê Kurdî: Rewş û Derfet',
    title: 'NLP for Kurdish Language: Status and Opportunities',
    authors: 'Dr. J. Bakir, D. Ehmed',
    abstract: 'A comprehensive survey of Natural Language Processing research for the Kurdish language. We identify key gaps in tokenization, machine translation, and sentiment analysis, and propose a community-driven dataset initiative.',
    category: 'AI / Language',
    date: '2026-03-05',
    citations: 8,
    status: 'peer-review',
  },
  {
    id: '5',
    emoji: '🔐',
    titleKu: 'Nasnameya Dijîtal a Nenavendî li ser Pezkuwi',
    title: 'Decentralized Digital Identity on Pezkuwi',
    authors: 'M. Baran, A. Kurdo',
    abstract: 'We design a self-sovereign identity (SSI) framework for the Pezkuwi network. Citizens control their own credentials using zero-knowledge proofs while maintaining compliance with governance requirements.',
    category: 'Identity / Privacy',
    date: '2026-03-20',
    citations: 3,
    status: 'peer-review',
  },
];

const ResearchScreen: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getStatusStyle = (status: ResearchPaper['status']) => {
    switch (status) {
      case 'published': return { bg: KurdistanColors.kesk + '15', color: KurdistanColors.kesk, label: 'Weşandî / Published' };
      case 'peer-review': return { bg: KurdistanColors.zer + '30', color: '#B8860B', label: 'Peer Review' };
      case 'draft': return { bg: '#E0E0E0', color: '#888', label: 'Draft' };
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🔬</Text>
        <Text style={styles.headerTitle}>Navenda Lêkolînê</Text>
        <Text style={styles.headerSubtitle}>Research Center</Text>
        <Text style={styles.headerCount}>{PAPERS.length} lêkolîn / papers</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Der barê Navenda Lêkolînê / About</Text>
        <Text style={styles.infoText}>
          Navenda Lêkolînê gotarên zanistî yên li ser aboriya dijîtal a Kurdistanê, teknolojiya blockchain, û mijarên pêwendîdar berhev dike.
        </Text>
        <Text style={styles.infoTextEn}>
          The Research Center curates academic papers on Kurdistan's digital economy, blockchain technology, and related topics.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lêkolîn / Papers</Text>
        {PAPERS.map((paper) => {
          const statusInfo = getStatusStyle(paper.status);
          const isExpanded = expandedId === paper.id;

          return (
            <TouchableOpacity
              key={paper.id}
              style={styles.paperCard}
              onPress={() => setExpandedId(isExpanded ? null : paper.id)}
              activeOpacity={0.7}
            >
              <View style={styles.paperHeader}>
                <Text style={styles.paperEmoji}>{paper.emoji}</Text>
                <View style={styles.paperHeaderRight}>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                  <Text style={styles.paperCitations}>📖 {paper.citations}</Text>
                </View>
              </View>

              <Text style={styles.paperTitleKu}>{paper.titleKu}</Text>
              <Text style={styles.paperTitle}>{paper.title}</Text>
              <Text style={styles.paperAuthors}>{paper.authors}</Text>

              <View style={styles.paperMeta}>
                <Text style={styles.paperCategory}>📁 {paper.category}</Text>
                <Text style={styles.paperDate}>📅 {paper.date}</Text>
              </View>

              {isExpanded && (
                <View style={styles.abstractContainer}>
                  <Text style={styles.abstractLabel}>Abstract</Text>
                  <Text style={styles.abstractText}>{paper.abstract}</Text>
                </View>
              )}

              <Text style={styles.expandHint}>
                {isExpanded ? '▲ Kêmtir / Less' : '▼ Bêtir / More'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Lêkolîna xwe bişînin / Submit your research</Text>
        <Text style={styles.ctaText}>
          Hûn dikarin gotarên xwe yên zanistî ji bo vekolînê bişînin.{'\n'}
          Submit your academic papers for peer review.
        </Text>
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>📝 Bişîne / Submit</Text>
        </TouchableOpacity>
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
  headerCount: { fontSize: 12, color: KurdistanColors.zer, marginTop: 8, fontWeight: '600' },
  infoCard: {
    margin: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 8 },
  infoText: { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 6 },
  infoTextEn: { fontSize: 12, color: '#999', lineHeight: 18 },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  paperCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  paperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paperEmoji: { fontSize: 28 },
  paperHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  paperCitations: { fontSize: 12, color: '#AAA' },
  paperTitleKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 2 },
  paperTitle: { fontSize: 13, color: '#666', marginBottom: 4 },
  paperAuthors: { fontSize: 12, color: KurdistanColors.şîn, marginBottom: 8 },
  paperMeta: { flexDirection: 'row', gap: 16 },
  paperCategory: { fontSize: 12, color: '#AAA' },
  paperDate: { fontSize: 12, color: '#AAA' },
  abstractContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  abstractLabel: { fontSize: 13, fontWeight: 'bold', color: KurdistanColors.kesk, marginBottom: 6 },
  abstractText: { fontSize: 13, color: '#555', lineHeight: 20 },
  expandHint: { fontSize: 12, color: KurdistanColors.kesk, textAlign: 'center', marginTop: 10 },
  ctaCard: {
    margin: 16,
    backgroundColor: KurdistanColors.kesk + '10',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  ctaTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.kesk, marginBottom: 8, textAlign: 'center' },
  ctaText: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  ctaButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  ctaButtonText: { color: KurdistanColors.spi, fontSize: 14, fontWeight: '600' },
});

export default ResearchScreen;
