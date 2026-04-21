import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

const WhatsKURDScreen: React.FC = () => {
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💬</Text>
        <Text style={styles.headerTitle}>whatsKURD</Text>
        <Text style={styles.headerSubtitle}>Peyamgera Nenavendî / Decentralized Messenger</Text>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroIconCircle}>
          <Text style={styles.heroIcon}>🔐</Text>
        </View>
        <Text style={styles.heroTitle}>Zû Tê / Coming Soon</Text>
        <Text style={styles.heroDescription}>
          whatsKURD peyamgera nenavendî ya yekem e ku bi teknolojiya blockchain
          hatiye avakirin. Hemû peyam bi şîfrekirina end-to-end têne parastin û
          tu daneyên we li server nabin.
        </Text>
        <Text style={styles.heroDescriptionEn}>
          whatsKURD is the first decentralized messenger built on blockchain
          technology. All messages are protected with end-to-end encryption and
          no data is stored on any server.
        </Text>
      </View>

      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Taybetmendî / Features</Text>
        {[
          { emoji: '🔒', titleKu: 'Şîfrekirina end-to-end', title: 'End-to-End Encryption', desc: 'Messages are encrypted on your device. Only the recipient can read them.' },
          { emoji: '📞', titleKu: 'Bangên deng û vîdyo', title: 'Voice & Video Calls', desc: 'Crystal clear encrypted calls powered by the Pezkuwi network.' },
          { emoji: '👥', titleKu: 'Komên civakê', title: 'Community Groups', desc: 'Create groups for neighborhoods, DAOs, and interest-based communities.' },
          { emoji: '📁', titleKu: 'Parvekirina pelan', title: 'File Sharing', desc: 'Share files securely with IPFS-backed decentralized storage.' },
          { emoji: '💸', titleKu: 'Dravdana di peyamê de', title: 'In-Chat Payments', desc: 'Send HEZ tokens directly within conversations.' },
          { emoji: '🤖', titleKu: 'Botên civakê', title: 'Community Bots', desc: 'Automate tasks with community-built bots for governance, alerts, and more.' },
        ].map((feature, i) => (
          <View key={i} style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitleKu}>{feature.titleKu}</Text>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.comparisonCard}>
        <Text style={styles.comparisonTitle}>Çima whatsKURD? / Why whatsKURD?</Text>
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonHeader}>Taybetmendî</Text>
          <Text style={styles.comparisonHeader}>whatsKURD</Text>
          <Text style={styles.comparisonHeader}>Yên din</Text>
        </View>
        {[
          ['Nenavendî', '✓', '✗'],
          ['Bê server', '✓', '✗'],
          ['Dravdan', '✓', '~'],
          ['Kodê vekirî', '✓', '~'],
          ['Bê reklam', '✓', '✗'],
        ].map((row, i) => (
          <View key={i} style={styles.comparisonRow}>
            <Text style={styles.comparisonCell}>{row[0]}</Text>
            <Text style={[styles.comparisonCell, styles.comparisonGreen]}>{row[1]}</Text>
            <Text style={[styles.comparisonCell, styles.comparisonRed]}>{row[2]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.notifySection}>
        <View style={styles.notifyContent}>
          <View style={styles.notifyTextContainer}>
            <Text style={styles.notifyTitle}>Agahdar bike / Notify Me</Text>
            <Text style={styles.notifyDesc}>
              Dema ku whatsKURD amade be, agahdariya min bike.{'\n'}
              Notify me when whatsKURD is ready.
            </Text>
          </View>
          <Switch
            value={notifyEnabled}
            onValueChange={setNotifyEnabled}
            trackColor={{ false: '#E0E0E0', true: KurdistanColors.kesk + '60' }}
            thumbColor={notifyEnabled ? KurdistanColors.kesk : '#CCC'}
          />
        </View>
        {notifyEnabled && (
          <Text style={styles.notifyConfirm}>
            ✓ Hûn ê agahdar bibin! / You will be notified!
          </Text>
        )}
      </View>

      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>Demjimêr / Timeline</Text>
        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, styles.timelineDotDone]} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q4 2025</Text>
            <Text style={styles.timelineLabel}>Lêkolîn û Sêwiran / Research & Design</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, styles.timelineDotDone]} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q1 2026</Text>
            <Text style={styles.timelineLabel}>Protokol / Protocol Development</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, styles.timelineDotActive]} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q2-Q3 2026</Text>
            <Text style={styles.timelineLabel}>Pêşvebirin / App Development</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q4 2026</Text>
            <Text style={styles.timelineLabel}>Beta + Destpêkirin / Beta + Launch</Text>
          </View>
        </View>
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
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: KurdistanColors.spi },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' },
  heroSection: {
    margin: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: KurdistanColors.kesk + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIcon: { fontSize: 40 },
  heroTitle: { fontSize: 20, fontWeight: 'bold', color: KurdistanColors.kesk, marginBottom: 12 },
  heroDescription: { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: 10 },
  heroDescriptionEn: { fontSize: 13, color: '#999', lineHeight: 20, textAlign: 'center' },
  featuresSection: { paddingHorizontal: 16, marginBottom: 8 },
  featuresTitle: { fontSize: 17, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  featureEmoji: { fontSize: 28, marginRight: 12 },
  featureText: { flex: 1 },
  featureTitleKu: { fontSize: 14, fontWeight: '600', color: KurdistanColors.reş },
  featureTitle: { fontSize: 12, color: '#888', marginTop: 1 },
  featureDesc: { fontSize: 12, color: '#AAA', marginTop: 4, lineHeight: 16 },
  comparisonCard: {
    marginHorizontal: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  comparisonTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 12 },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  comparisonHeader: { flex: 1, fontSize: 12, fontWeight: 'bold', color: '#666', textAlign: 'center' },
  comparisonCell: { flex: 1, fontSize: 13, color: '#555', textAlign: 'center' },
  comparisonGreen: { color: KurdistanColors.kesk, fontWeight: 'bold' },
  comparisonRed: { color: KurdistanColors.sor },
  notifySection: {
    marginHorizontal: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  notifyContent: { flexDirection: 'row', alignItems: 'center' },
  notifyTextContainer: { flex: 1, marginRight: 12 },
  notifyTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 4 },
  notifyDesc: { fontSize: 12, color: '#888', lineHeight: 18 },
  notifyConfirm: { fontSize: 13, color: KurdistanColors.kesk, fontWeight: '600', marginTop: 10 },
  timelineSection: {
    marginHorizontal: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
  },
  timelineTitle: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: KurdistanColors.spi,
    marginRight: 14,
  },
  timelineDotDone: { backgroundColor: KurdistanColors.kesk, borderColor: KurdistanColors.kesk },
  timelineDotActive: { borderColor: KurdistanColors.kesk, backgroundColor: KurdistanColors.kesk + '40' },
  timelineText: {},
  timelineDate: { fontSize: 13, fontWeight: '600', color: KurdistanColors.reş },
  timelineLabel: { fontSize: 12, color: '#888', marginTop: 2 },
});

export default WhatsKURDScreen;
