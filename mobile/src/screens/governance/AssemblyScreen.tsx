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

interface Member {
  id: string;
  name: string;
  role: string;
  roleKu: string;
  emoji: string;
  region: string;
  since: string;
}

interface Session {
  id: string;
  titleKu: string;
  title: string;
  date: string;
  status: 'upcoming' | 'completed' | 'in-session';
  agenda: string;
}

const MEMBERS: Member[] = [
  { id: '1', name: 'Azad Kurdo', role: 'Speaker', roleKu: 'Serokê Meclîsê', emoji: '👨‍⚖️', region: 'Amed', since: '2025-06' },
  { id: '2', name: 'Rozerin Xan', role: 'Deputy Speaker', roleKu: 'Cîgirê Serokê Meclîsê', emoji: '👩‍⚖️', region: 'Hewler', since: '2025-06' },
  { id: '3', name: 'Serhat Demirtash', role: 'Finance Committee', roleKu: 'Komîteya Darayî', emoji: '👨‍💼', region: 'Diyarbekir', since: '2025-08' },
  { id: '4', name: 'Jîn Bakir', role: 'Technology Committee', roleKu: 'Komîteya Teknolojiyê', emoji: '👩‍💻', region: 'Silêmanî', since: '2025-07' },
  { id: '5', name: 'Kawa Zana', role: 'Education Committee', roleKu: 'Komîteya Perwerdê', emoji: '👨‍🎓', region: 'Wan', since: '2025-09' },
  { id: '6', name: 'Berfîn Shêx', role: 'Social Affairs', roleKu: 'Karên Civakî', emoji: '👩‍🏫', region: 'Kerkûk', since: '2025-08' },
  { id: '7', name: 'Dilovan Ehmed', role: 'Foreign Relations', roleKu: 'Têkiliyên Derve', emoji: '🧑‍💼', region: 'Qamişlo', since: '2025-10' },
];

const SESSIONS: Session[] = [
  {
    id: 's1',
    titleKu: 'Civîna Budceya Q2 2026',
    title: 'Q2 2026 Budget Session',
    date: '2026-04-15',
    status: 'upcoming',
    agenda: 'Treasury allocation, staking rewards adjustment, education fund.',
  },
  {
    id: 's2',
    titleKu: 'Civîna Yasadanînê #12',
    title: 'Legislative Session #12',
    date: '2026-04-10',
    status: 'upcoming',
    agenda: 'Cross-chain bridge proposal, fee structure revision.',
  },
  {
    id: 's3',
    titleKu: 'Civîna Awarte ya Ewlehiyê',
    title: 'Emergency Security Session',
    date: '2026-03-28',
    status: 'completed',
    agenda: 'Network security audit results, validator requirements update.',
  },
  {
    id: 's4',
    titleKu: 'Civîna Yasadanînê #11',
    title: 'Legislative Session #11',
    date: '2026-03-15',
    status: 'completed',
    agenda: 'Citizenship criteria, NFT standards, community grants.',
  },
];

const AssemblyScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'sessions'>('members');
  const [refreshing, setRefreshing] = useState(false);

  const getStatusStyle = (status: Session['status']) => {
    switch (status) {
      case 'upcoming':
        return { bg: KurdistanColors.şîn + '20', color: KurdistanColors.şîn };
      case 'in-session':
        return { bg: KurdistanColors.kesk + '20', color: KurdistanColors.kesk };
      case 'completed':
        return { bg: '#E0E0E0', color: '#666' };
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'upcoming': return 'Tê / Upcoming';
      case 'in-session': return 'Niha / In Session';
      case 'completed': return 'Qediya / Completed';
    }
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏛️</Text>
        <Text style={styles.headerTitle}>Meclîsa Kurdistanê</Text>
        <Text style={styles.headerSubtitle}>Kurdistan Digital Assembly</Text>
        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{MEMBERS.length}</Text>
            <Text style={styles.statLabel}>Endam / Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>Komîte / Committees</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Civîn / Sessions</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Endam / Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sessions' && styles.tabActive]}
          onPress={() => setActiveTab('sessions')}
        >
          <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
            Civîn / Sessions
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'members' ? (
          <>
            {MEMBERS.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <Text style={styles.memberEmoji}>{member.emoji}</Text>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRoleKu}>{member.roleKu}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberRegion}>📍 {member.region}</Text>
                    <Text style={styles.memberSince}>Ji {member.since}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            {SESSIONS.map((session) => {
              const statusStyle = getStatusStyle(session.status);
              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={[styles.sessionStatus, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.sessionStatusText, { color: statusStyle.color }]}>
                        {getStatusLabel(session.status)}
                      </Text>
                    </View>
                    <Text style={styles.sessionDate}>{session.date}</Text>
                  </View>
                  <Text style={styles.sessionTitleKu}>{session.titleKu}</Text>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionAgenda}>{session.agenda}</Text>
                </View>
              );
            })}
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
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: KurdistanColors.spi },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: KurdistanColors.spi },
  content: { padding: 16 },
  memberCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberEmoji: { fontSize: 40, marginRight: 14 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: 'bold', color: KurdistanColors.reş },
  memberRoleKu: { fontSize: 13, color: KurdistanColors.kesk, fontWeight: '600', marginTop: 2 },
  memberRole: { fontSize: 12, color: '#888', marginTop: 1 },
  memberMeta: { flexDirection: 'row', marginTop: 6, gap: 12 },
  memberRegion: { fontSize: 11, color: '#AAA' },
  memberSince: { fontSize: 11, color: '#AAA' },
  sessionCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sessionStatusText: { fontSize: 11, fontWeight: '600' },
  sessionDate: { fontSize: 12, color: '#888' },
  sessionTitleKu: { fontSize: 15, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 2 },
  sessionTitle: { fontSize: 13, color: '#666', marginBottom: 6 },
  sessionAgenda: { fontSize: 12, color: '#999', lineHeight: 18 },
});

export default AssemblyScreen;
