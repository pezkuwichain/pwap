import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';

// Media channel types
interface MediaChannel {
  id: string;
  name: string;
  nameKu: string;
  icon: string;
  description: string;
  descriptionKu: string;
  color: string;
}

// Social platform types
interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  url: string;
  color: string;
}

// Kurdish Media Channels (DKS - Digital Kurdistan State)
const MEDIA_CHANNELS: MediaChannel[] = [
  {
    id: 'dkstv',
    name: 'DKS TV',
    nameKu: 'DKS TV',
    icon: '📺',
    description: 'Digital Kurdistan State Television',
    descriptionKu: 'Televizyona Dewleta Dijîtal a Kurdistanê',
    color: '#E53935',
  },
  {
    id: 'dksgzt',
    name: 'DKS Gazette',
    nameKu: 'DKS Rojname',
    icon: '📰',
    description: 'Official News & Announcements',
    descriptionKu: 'Nûçe û Daxuyaniyên Fermî',
    color: '#1E88E5',
  },
  {
    id: 'dksradio',
    name: 'DKS Radio',
    nameKu: 'DKS Radyo',
    icon: '📻',
    description: 'Digital Kurdistan State Radio',
    descriptionKu: 'Radyoya Dewleta Dijîtal a Kurdistanê',
    color: '#7B1FA2',
  },
  {
    id: 'dksmusic',
    name: 'DKS Music',
    nameKu: 'DKS Muzîk',
    icon: '🎵',
    description: 'Kurdish Music Streaming',
    descriptionKu: 'Weşana Muzîka Kurdî',
    color: '#00897B',
  },
  {
    id: 'dkspodcast',
    name: 'DKS Podcast',
    nameKu: 'DKS Podcast',
    icon: '🎙️',
    description: 'Kurdish Podcasts & Talks',
    descriptionKu: 'Podcast û Gotûbêjên Kurdî',
    color: '#F4511E',
  },
  {
    id: 'dksdocs',
    name: 'DKS Docs',
    nameKu: 'DKS Belgefîlm',
    icon: '🎬',
    description: 'Documentaries & Films',
    descriptionKu: 'Belgefîlm û Fîlim',
    color: '#6D4C41',
  },
];

// PezkuwiChain Social Platforms
const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    url: 'https://t.me/pezkuwichain',
    color: '#0088CC',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '💬',
    url: 'https://discord.gg/Y3VyEC6h8W',
    color: '#5865F2',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    url: 'https://twitter.com/pezkuwichain',
    color: '#1DA1F2',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    url: 'https://www.facebook.com/profile.php?id=61582484611719',
    color: '#1877F2',
  },
  {
    id: 'medium',
    name: 'Medium',
    icon: '📝',
    url: 'https://medium.com/@pezkuwichain',
    color: '#000000',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '💻',
    url: 'https://github.com/pezkuwichain',
    color: '#333333',
  },
];

const KurdMediaScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleMediaPress = (channel: MediaChannel) => {
    Alert.alert(
      `${channel.nameKu} - Tê de ye / Coming Soon`,
      `${channel.descriptionKu}\n\n${channel.description}\n\nEv taybetmendî di pêşveçûnê de ye.\nThis feature is under development.`,
      [{ text: 'Temam / OK' }]
    );
  };

  const handleSocialPress = async (platform: SocialPlatform) => {
    try {
      const canOpen = await Linking.canOpenURL(platform.url);
      if (canOpen) {
        await Linking.openURL(platform.url);
      } else {
        Alert.alert(
          'Xeletî / Error',
          `Nikarim ${platform.name} vebikum.\nCannot open ${platform.name}.`,
          [{ text: 'Temam / OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Xeletî / Error', 'Tiştek xelet çû.\nSomething went wrong.');
    }
  };

  const renderMediaChannel = (channel: MediaChannel) => (
    <TouchableOpacity
      key={channel.id}
      style={styles.mediaCard}
      onPress={() => handleMediaPress(channel)}
      activeOpacity={0.7}
    >
      <View style={[styles.mediaIconContainer, { backgroundColor: channel.color }]}>
        <Text style={styles.mediaIcon}>{channel.icon}</Text>
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName}>{channel.nameKu}</Text>
        <Text style={styles.mediaDescription} numberOfLines={1}>
          {channel.descriptionKu}
        </Text>
      </View>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonText}>Soon</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSocialPlatform = (platform: SocialPlatform) => (
    <TouchableOpacity
      key={platform.id}
      style={styles.socialButton}
      onPress={() => handleSocialPress(platform)}
      activeOpacity={0.7}
    >
      <View style={[styles.socialIconContainer, { backgroundColor: platform.color }]}>
        <Text style={styles.socialIcon}>{platform.icon}</Text>
      </View>
      <Text style={styles.socialName}>{platform.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />


      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Kurdish Media Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>📡</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Medyaya Kurdî</Text>
              <Text style={styles.sectionSubtitle}>Kurdish Media</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionDescription}>
              Weşanên fermî yên Dewleta Dijîtal a Kurdistanê. TV, radyo, nûçe û bêtir.
            </Text>
            <Text style={styles.sectionDescriptionEn}>
              Official broadcasts of Digital Kurdistan State. TV, radio, news and more.
            </Text>

            <View style={styles.mediaList}>
              {MEDIA_CHANNELS.map(renderMediaChannel)}
            </View>
          </View>
        </View>

        {/* Support PezkuwiChain Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: KurdistanColors.kesk }]}>
              <Text style={styles.sectionIcon}>🤝</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Piştgirî PezkuwiChain</Text>
              <Text style={styles.sectionSubtitle}>Support PezkuwiChain</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionDescription}>
              Bi me re têkildar bin li ser platformên civakî. Pirsan bipirsin, nûçeyan bişopînin û bên beşdarî civata me.
            </Text>
            <Text style={styles.sectionDescriptionEn}>
              Connect with us on social platforms. Ask questions, follow news and join our community.
            </Text>

            <View style={styles.socialGrid}>
              {SOCIAL_PLATFORMS.map(renderSocialPlatform)}
            </View>

            {/* Community Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>40M+</Text>
                <Text style={styles.statLabel}>Kurd li cîhanê</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>5B</Text>
                <Text style={styles.statLabel}>PEZ Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>∞</Text>
                <Text style={styles.statLabel}>Hêvî / Hope</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>💡</Text>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerText}>
              PezkuwiChain - Blockchain'a yekem a netewî ya Kurdan
            </Text>
            <Text style={styles.infoBannerTextEn}>
              PezkuwiChain - The first national blockchain of the Kurds
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    color: KurdistanColors.spi,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  headerSubtitle: {
    fontSize: 14,
    color: KurdistanColors.spi,
    opacity: 0.9,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: KurdistanColors.sor,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionIcon: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  sectionCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 4,
  },
  sectionDescriptionEn: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginBottom: 16,
  },
  mediaList: {
    gap: 12,
  },
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  mediaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIcon: {
    fontSize: 24,
  },
  mediaInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mediaName: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 2,
  },
  mediaDescription: {
    fontSize: 12,
    color: '#666',
  },
  comingSoonBadge: {
    backgroundColor: KurdistanColors.zer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  socialButton: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
  },
  socialIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
    elevation: 3,
  },
  socialIcon: {
    fontSize: 28,
  },
  socialName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#444',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.sor,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#DDD',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: KurdistanColors.kesk,
  },
  infoBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
    lineHeight: 20,
  },
  infoBannerTextEn: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    lineHeight: 18,
  },
});

export default KurdMediaScreen;
