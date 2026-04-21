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

interface Course {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  instructor: string;
  duration: string;
  level: 'Destpêk' | 'Navîn' | 'Pêşketî';
  levelEn: 'Beginner' | 'Intermediate' | 'Advanced';
  enrolled: number;
  lessons: number;
  description: string;
  reward: string;
}

const COURSES: Course[] = [
  {
    id: '1',
    emoji: '🗣️',
    titleKu: 'Zimanê Kurdî - Kurmancî',
    title: 'Kurdish Language - Kurmanji',
    instructor: 'Prof. Berfîn Shêx',
    duration: '12 hefte / weeks',
    level: 'Destpêk',
    levelEn: 'Beginner',
    enrolled: 456,
    lessons: 48,
    description: 'Learn Kurmanji Kurdish from scratch. Covers alphabet, grammar, conversation, reading, and writing.',
    reward: 'NFT Certificate + 50 HEZ',
  },
  {
    id: '2',
    emoji: '🔗',
    titleKu: 'Blockchain 101',
    title: 'Blockchain 101',
    instructor: 'Dr. Azad Kurdo',
    duration: '8 hefte / weeks',
    level: 'Destpêk',
    levelEn: 'Beginner',
    enrolled: 312,
    lessons: 32,
    description: 'Introduction to blockchain technology. Learn about consensus, cryptography, smart contracts, and decentralized applications.',
    reward: 'NFT Certificate + 30 HEZ',
  },
  {
    id: '3',
    emoji: '💻',
    titleKu: 'Pêşvebirina Smart Contract',
    title: 'Smart Contract Development',
    instructor: 'Jîn Bakir',
    duration: '10 hefte / weeks',
    level: 'Navîn',
    levelEn: 'Intermediate',
    enrolled: 187,
    lessons: 40,
    description: 'Build smart contracts for the Pezkuwi network. Covers Solidity/Ink!, testing, deployment, and security best practices.',
    reward: 'NFT Certificate + 100 HEZ',
  },
  {
    id: '4',
    emoji: '📊',
    titleKu: 'Aboriya Dijîtal û DeFi',
    title: 'Digital Economics & DeFi',
    instructor: 'Prof. Serhat Demirtash',
    duration: '6 hefte / weeks',
    level: 'Navîn',
    levelEn: 'Intermediate',
    enrolled: 234,
    lessons: 24,
    description: 'Understand decentralized finance, tokenomics, yield farming, liquidity pools, and the Bereketli neighborhood economy model.',
    reward: 'NFT Certificate + 40 HEZ',
  },
  {
    id: '5',
    emoji: '🛡️',
    titleKu: 'Ewlehiya Sîber û Blockchain',
    title: 'Cyber Security & Blockchain',
    instructor: 'Kawa Zana',
    duration: '8 hefte / weeks',
    level: 'Pêşketî',
    levelEn: 'Advanced',
    enrolled: 98,
    lessons: 32,
    description: 'Advanced security topics including audit techniques, common vulnerabilities, formal verification, and incident response.',
    reward: 'NFT Certificate + 150 HEZ',
  },
  {
    id: '6',
    emoji: '🏛️',
    titleKu: 'Dîroka Kurdistanê - Dijîtal',
    title: 'History of Kurdistan - Digital',
    instructor: 'Prof. Dilovan Ehmed',
    duration: '10 hefte / weeks',
    level: 'Destpêk',
    levelEn: 'Beginner',
    enrolled: 567,
    lessons: 40,
    description: 'A comprehensive digital course on Kurdish history, culture, and the journey toward digital sovereignty and self-governance.',
    reward: 'NFT Certificate + 25 HEZ',
  },
];

const UniversityScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  const getLevelColor = (level: Course['level']) => {
    switch (level) {
      case 'Destpêk': return KurdistanColors.kesk;
      case 'Navîn': return KurdistanColors.şîn;
      case 'Pêşketî': return KurdistanColors.mor;
    }
  };

  const totalStudents = COURSES.reduce((sum, c) => sum + c.enrolled, 0);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🎓</Text>
        <Text style={styles.headerTitle}>Zanîngeha Dijîtal</Text>
        <Text style={styles.headerSubtitle}>Kurdistan Digital University</Text>
        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{COURSES.length}</Text>
            <Text style={styles.statLabel}>Kurs / Courses</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Xwendekar / Students</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {COURSES.map((course) => {
          const levelColor = getLevelColor(course.level);

          return (
            <View key={course.id} style={styles.courseCard}>
              <View style={styles.courseTop}>
                <Text style={styles.courseEmoji}>{course.emoji}</Text>
                <View style={[styles.levelBadge, { backgroundColor: levelColor + '15' }]}>
                  <Text style={[styles.levelText, { color: levelColor }]}>
                    {course.level} / {course.levelEn}
                  </Text>
                </View>
              </View>

              <Text style={styles.courseTitleKu}>{course.titleKu}</Text>
              <Text style={styles.courseTitle}>{course.title}</Text>
              <Text style={styles.courseInstructor}>👨‍🏫 {course.instructor}</Text>
              <Text style={styles.courseDescription}>{course.description}</Text>

              <View style={styles.courseMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>📚</Text>
                  <Text style={styles.metaText}>{course.lessons} ders</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>⏱️</Text>
                  <Text style={styles.metaText}>{course.duration}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>👥</Text>
                  <Text style={styles.metaText}>{course.enrolled}</Text>
                </View>
              </View>

              <View style={styles.rewardRow}>
                <Text style={styles.rewardLabel}>🎁 Xelat / Reward:</Text>
                <Text style={styles.rewardValue}>{course.reward}</Text>
              </View>

              <TouchableOpacity style={[styles.enrollButton, { backgroundColor: levelColor }]}>
                <Text style={styles.enrollButtonText}>Tomar bibe / Enroll</Text>
              </TouchableOpacity>
            </View>
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
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: KurdistanColors.spi },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },
  content: { padding: 16 },
  courseCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  courseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseEmoji: { fontSize: 32 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  levelText: { fontSize: 11, fontWeight: '600' },
  courseTitleKu: { fontSize: 16, fontWeight: 'bold', color: KurdistanColors.reş, marginBottom: 2 },
  courseTitle: { fontSize: 14, color: '#666', marginBottom: 4 },
  courseInstructor: { fontSize: 13, color: KurdistanColors.şîn, marginBottom: 8 },
  courseDescription: { fontSize: 13, color: '#777', lineHeight: 19, marginBottom: 12 },
  courseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  metaItem: { alignItems: 'center' },
  metaIcon: { fontSize: 16, marginBottom: 2 },
  metaText: { fontSize: 12, color: '#888' },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  rewardLabel: { fontSize: 12, color: '#888' },
  rewardValue: { fontSize: 13, fontWeight: '600', color: KurdistanColors.zer },
  enrollButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  enrollButtonText: { color: KurdistanColors.spi, fontSize: 14, fontWeight: '600' },
});

export default UniversityScreen;
