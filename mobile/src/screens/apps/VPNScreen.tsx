import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

const VPNScreen: React.FC = () => {
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🛡️</Text>
        <Text style={styles.headerTitle}>VPN ya Nenavendî</Text>
        <Text style={styles.headerSubtitle}>Decentralized VPN</Text>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroIconCircle}>
          <Text style={styles.heroIcon}>🔒</Text>
        </View>
        <Text style={styles.heroTitle}>Zû Tê / Coming Soon</Text>
        <Text style={styles.heroDescription}>
          VPNa nenavendî ya Pezkuwi dê parastina temam a nepenîtiyê peyda bike.
          Tora relay ji hêla civakê ve tê birêvebirin û bi tokenên HEZ tê fînansekirîn.
        </Text>
        <Text style={styles.heroDescriptionEn}>
          Pezkuwi's decentralized VPN will provide complete privacy protection.
          The relay network is community-operated and funded through HEZ tokens.
        </Text>
      </View>

      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Taybetmendî / Features</Text>
        {[
          { emoji: '🌐', titleKu: 'Tora relay nenavendî', title: 'Decentralized Relay Network', desc: 'No single point of failure. Nodes operated by the community.' },
          { emoji: '🔐', titleKu: 'Şîfrekirina asta leşkerî', title: 'Military-grade Encryption', desc: 'AES-256 encryption with perfect forward secrecy.' },
          { emoji: '📝', titleKu: 'Siyaseta bê-log', title: 'Zero-Log Policy', desc: 'Verified on-chain. No activity logs are ever stored.' },
          { emoji: '💰', titleKu: 'Dravdana bi HEZ', title: 'Pay with HEZ Tokens', desc: 'Use HEZ to pay for VPN service. Earn HEZ by running a relay node.' },
          { emoji: '🚫', titleKu: 'Derbazkirina sansûrê', title: 'Censorship Bypass', desc: 'Access the open internet from anywhere in the world.' },
          { emoji: '⚡', titleKu: 'Leza bilind', title: 'High Speed', desc: 'Optimized routing for minimal latency and maximum throughput.' },
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

      <View style={styles.notifySection}>
        <View style={styles.notifyContent}>
          <View style={styles.notifyTextContainer}>
            <Text style={styles.notifyTitle}>Agahdar bike / Notify Me</Text>
            <Text style={styles.notifyDesc}>
              Dema ku VPN amade be, agahdariya min bike.{'\n'}
              Notify me when the VPN is ready.
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
            <Text style={styles.timelineDate}>Q1 2026</Text>
            <Text style={styles.timelineLabel}>Lêkolîn / Research</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, styles.timelineDotActive]} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q2 2026</Text>
            <Text style={styles.timelineLabel}>Prototîp / Prototype</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q3 2026</Text>
            <Text style={styles.timelineLabel}>Alpha Test</Text>
          </View>
        </View>
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineDate}>Q4 2026</Text>
            <Text style={styles.timelineLabel}>Destpêkirin / Launch</Text>
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
    backgroundColor: KurdistanColors.şîn,
  },
  headerIcon: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: KurdistanColors.spi },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
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
    backgroundColor: KurdistanColors.şîn + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIcon: { fontSize: 40 },
  heroTitle: { fontSize: 20, fontWeight: 'bold', color: KurdistanColors.şîn, marginBottom: 12 },
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
  timelineDotActive: { borderColor: KurdistanColors.şîn, backgroundColor: KurdistanColors.şîn + '40' },
  timelineText: {},
  timelineDate: { fontSize: 13, fontWeight: '600', color: KurdistanColors.reş },
  timelineLabel: { fontSize: 12, color: '#888', marginTop: 2 },
});

export default VPNScreen;
