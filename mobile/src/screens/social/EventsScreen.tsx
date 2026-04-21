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

interface CommunityEvent {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  category: string;
  description: string;
  isVirtual: boolean;
}

const EVENTS: CommunityEvent[] = [
  {
    id: '1',
    emoji: '🎙️',
    titleKu: 'Konferansa Blockchain a Kurdistanê',
    title: 'Kurdistan Blockchain Conference',
    date: '2026-04-20',
    time: '14:00 UTC',
    location: 'Virtual / Online',
    attendees: 234,
    category: 'Konferans',
    description: 'Annual blockchain conference featuring talks on Pezkuwi network updates, DeFi innovations, and the future of the Kurdish digital economy.',
    isVirtual: true,
  },
  {
    id: '2',
    emoji: '🎨',
    titleKu: 'Peshangaya NFT ya Hunerê Kurdî',
    title: 'Kurdish Art NFT Exhibition',
    date: '2026-04-25',
    time: '18:00 UTC',
    location: 'Metaverse Gallery',
    attendees: 89,
    category: 'Huner / Art',
    description: 'Explore digital artworks by Kurdish artists minted as NFTs on the Pezkuwi chain. Live auction and meet-the-artist sessions.',
    isVirtual: true,
  },
  {
    id: '3',
    emoji: '📚',
    titleKu: 'Workshopa Web3 ji bo Destpêkeran',
    title: 'Web3 Workshop for Beginners',
    date: '2026-05-02',
    time: '10:00 UTC',
    location: 'Virtual / Zoom',
    attendees: 156,
    category: 'Perwerde / Education',
    description: 'Hands-on workshop covering wallet setup, token transactions, staking basics, and smart contract interaction for newcomers.',
    isVirtual: true,
  },
  {
    id: '4',
    emoji: '🏆',
    titleKu: 'Hackathona PWAP',
    title: 'PWAP Hackathon',
    date: '2026-05-10',
    time: '09:00 UTC',
    location: 'Virtual / 48 Hours',
    attendees: 67,
    category: 'Hackathon',
    description: 'Build mini-apps for the PWAP ecosystem. Prizes include HEZ tokens and official feature integration. Teams of 1-4.',
    isVirtual: true,
  },
  {
    id: '5',
    emoji: '🎶',
    titleKu: 'Sheva Muzîka Dijîtal',
    title: 'Digital Music Night',
    date: '2026-05-15',
    time: '20:00 UTC',
    location: 'Virtual / Live Stream',
    attendees: 312,
    category: 'Muzîk / Music',
    description: 'Live performances by Kurdish musicians streamed on-chain. Tip artists directly with HEZ tokens.',
    isVirtual: true,
  },
];

const EventsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  const getCategoryColor = (category: string) => {
    if (category.includes('Konferans')) return KurdistanColors.şîn;
    if (category.includes('Art') || category.includes('Huner')) return KurdistanColors.mor;
    if (category.includes('Perwerde') || category.includes('Education')) return KurdistanColors.kesk;
    if (category.includes('Hackathon')) return KurdistanColors.sor;
    if (category.includes('Muzîk') || category.includes('Music')) return KurdistanColors.zer;
    return KurdistanColors.gewr;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      day: date.getDate().toString(),
      month: months[date.getMonth()],
    };
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🎭</Text>
        <Text style={styles.headerTitle}>Bûyer û Çalakî</Text>
        <Text style={styles.headerSubtitle}>Events & Activities</Text>
        <Text style={styles.headerCount}>{EVENTS.length} bûyerên pêşeroj / upcoming</Text>
      </View>

      <View style={styles.content}>
        {EVENTS.map((event) => {
          const dateInfo = formatDate(event.date);
          const catColor = getCategoryColor(event.category);

          return (
            <TouchableOpacity key={event.id} style={styles.eventCard} activeOpacity={0.7}>
              <View style={styles.dateColumn}>
                <Text style={styles.dateDay}>{dateInfo.day}</Text>
                <Text style={styles.dateMonth}>{dateInfo.month}</Text>
              </View>

              <View style={styles.eventContent}>
                <View style={styles.eventTop}>
                  <View style={[styles.categoryBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={[styles.categoryText, { color: catColor }]}>{event.category}</Text>
                  </View>
                  {event.isVirtual && (
                    <Text style={styles.virtualBadge}>🌐 Virtual</Text>
                  )}
                </View>

                <Text style={styles.eventEmoji}>{event.emoji}</Text>
                <Text style={styles.eventTitleKu}>{event.titleKu}</Text>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>

                <View style={styles.eventMeta}>
                  <Text style={styles.metaItem}>🕐 {event.time}</Text>
                  <Text style={styles.metaItem}>📍 {event.location}</Text>
                  <Text style={styles.metaItem}>👥 {event.attendees}</Text>
                </View>

                <TouchableOpacity style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Beşdar bibe / Join</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Hemû bûyer li ser Pezkuwi blockchain têne tomarkirin.{'\n'}
          All events are recorded on the Pezkuwi blockchain.
        </Text>
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
  content: { padding: 16 },
  eventCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dateColumn: {
    width: 56,
    backgroundColor: KurdistanColors.kesk + '10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dateDay: { fontSize: 24, fontWeight: 'bold', color: KurdistanColors.kesk },
  dateMonth: { fontSize: 12, color: KurdistanColors.kesk, fontWeight: '600', textTransform: 'uppercase' },
  eventContent: { flex: 1, padding: 14 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryText: { fontSize: 11, fontWeight: '600' },
  virtualBadge: { fontSize: 11, color: '#888' },
  eventEmoji: { fontSize: 28, marginBottom: 6 },
  eventTitleKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 2 },
  eventTitle: { fontSize: 13, color: '#666', marginBottom: 6 },
  eventDescription: { fontSize: 12, color: '#999', lineHeight: 17, marginBottom: 10 },
  eventMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaItem: { fontSize: 11, color: '#AAA' },
  joinButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  joinButtonText: { color: KurdistanColors.spi, fontSize: 13, fontWeight: '600' },
  footer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: { fontSize: 12, color: '#AAA', textAlign: 'center', lineHeight: 18 },
});

export default EventsScreen;
