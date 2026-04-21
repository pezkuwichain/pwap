import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  title: string;
  titleKu: string;
  description: string;
  status: 'active' | 'ended';
  totalVotes: number;
  endsAt: string;
  options: PollOption[];
  userVoted: string | null;
}

const INITIAL_POLLS: Poll[] = [
  {
    id: '1',
    titleKu: 'Taybetmendiya nû ya paşîn çi be?',
    title: 'What should the next new feature be?',
    description: 'Vote for the feature you want to see next in PWAP.',
    status: 'active',
    totalVotes: 342,
    endsAt: '2026-04-20',
    options: [
      { id: '1a', text: 'NFT Marketplace', votes: 128 },
      { id: '1b', text: 'DeFi Lending', votes: 97 },
      { id: '1c', text: 'DAO Voting System', votes: 72 },
      { id: '1d', text: 'Cross-chain Bridge', votes: 45 },
    ],
    userVoted: null,
  },
  {
    id: '2',
    titleKu: 'Karmasiyonên torê kêm bibin?',
    title: 'Should network fees be reduced?',
    description: 'Proposal to reduce transaction fees by 50% for the next quarter.',
    status: 'active',
    totalVotes: 521,
    endsAt: '2026-04-15',
    options: [
      { id: '2a', text: 'Ere / Yes', votes: 389 },
      { id: '2b', text: 'Na / No', votes: 87 },
      { id: '2c', text: 'Bêalî / Abstain', votes: 45 },
    ],
    userVoted: null,
  },
  {
    id: '3',
    titleKu: 'Bernameya bursê ji bo perwerdehiyê?',
    title: 'Scholarship program for education?',
    description: 'Allocate 5% of treasury funds for a community education scholarship.',
    status: 'active',
    totalVotes: 198,
    endsAt: '2026-04-25',
    options: [
      { id: '3a', text: 'Ere, 5% / Yes, 5%', votes: 112 },
      { id: '3b', text: 'Ere, 3% / Yes, 3%', votes: 48 },
      { id: '3c', text: 'Na / No', votes: 23 },
      { id: '3d', text: 'Bêalî / Abstain', votes: 15 },
    ],
    userVoted: null,
  },
  {
    id: '4',
    titleKu: 'Logoya nû ya PWAP?',
    title: 'New PWAP logo design?',
    description: 'Community voted on the new logo. Results are final.',
    status: 'ended',
    totalVotes: 876,
    endsAt: '2026-03-30',
    options: [
      { id: '4a', text: 'Design A - Modern', votes: 412 },
      { id: '4b', text: 'Design B - Classic', votes: 298 },
      { id: '4c', text: 'Design C - Minimal', votes: 166 },
    ],
    userVoted: '4a',
  },
];

const PollsScreen: React.FC = () => {
  const [polls, setPolls] = useState<Poll[]>(INITIAL_POLLS);
  const [refreshing, setRefreshing] = useState(false);

  const handleVote = (pollId: string, optionId: string) => {
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId || poll.userVoted) return poll;
        return {
          ...poll,
          totalVotes: poll.totalVotes + 1,
          userVoted: optionId,
          options: poll.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          ),
        };
      })
    );
    Alert.alert('Deng hat tomarkirin!', 'Your vote has been recorded.');
  };

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const renderPoll = (poll: Poll) => {
    const showResults = poll.userVoted !== null || poll.status === 'ended';
    const currentTotal = poll.totalVotes;

    return (
      <View key={poll.id} style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <View
            style={[
              styles.statusBadge,
              poll.status === 'active' ? styles.statusActive : styles.statusEnded,
            ]}
          >
            <Text style={styles.statusText}>
              {poll.status === 'active' ? 'Çalak / Active' : 'Qediya / Ended'}
            </Text>
          </View>
          <Text style={styles.pollVoteCount}>{currentTotal} deng</Text>
        </View>

        <Text style={styles.pollTitleKu}>{poll.titleKu}</Text>
        <Text style={styles.pollTitle}>{poll.title}</Text>
        <Text style={styles.pollDescription}>{poll.description}</Text>

        <View style={styles.optionsContainer}>
          {poll.options.map((option) => {
            const pct = getPercentage(option.votes, currentTotal);
            const isSelected = poll.userVoted === option.id;
            const isWinner =
              poll.status === 'ended' &&
              option.votes === Math.max(...poll.options.map((o) => o.votes));

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionSelected,
                  isWinner && styles.optionWinner,
                ]}
                onPress={() => {
                  if (!showResults && poll.status === 'active') {
                    handleVote(poll.id, option.id);
                  }
                }}
                disabled={showResults}
                activeOpacity={0.7}
              >
                {showResults && (
                  <View
                    style={[
                      styles.optionBar,
                      {
                        width: `${pct}%`,
                        backgroundColor: isSelected
                          ? KurdistanColors.kesk + '30'
                          : isWinner
                          ? KurdistanColors.zer + '30'
                          : '#E8E8E8',
                      },
                    ]}
                  />
                )}
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {isSelected ? '✓ ' : ''}
                    {option.text}
                  </Text>
                  {showResults && (
                    <Text style={styles.optionPercent}>{pct}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.pollDeadline}>
          {poll.status === 'active'
            ? `Dawî: ${poll.endsAt}`
            : `Qediya: ${poll.endsAt}`}
        </Text>
      </View>
    );
  };

  const activePolls = polls.filter((p) => p.status === 'active');
  const endedPolls = polls.filter((p) => p.status === 'ended');

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📊</Text>
        <Text style={styles.headerTitle}>Rapirsî</Text>
        <Text style={styles.headerSubtitle}>Community Polls</Text>
        <Text style={styles.headerStat}>
          {activePolls.length} çalak / active
        </Text>
      </View>

      {activePolls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rapirsiyên Çalak / Active Polls</Text>
          {activePolls.map(renderPoll)}
        </View>
      )}

      {endedPolls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rapirsiyên Qediyayî / Ended Polls</Text>
          {endedPolls.map(renderPoll)}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: KurdistanColors.kesk,
  },
  headerIcon: { fontSize: 48, marginBottom: 8 },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerStat: {
    fontSize: 13,
    color: KurdistanColors.zer,
    marginTop: 8,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  pollCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: KurdistanColors.kesk + '20',
  },
  statusEnded: {
    backgroundColor: '#E0E0E0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  pollVoteCount: {
    fontSize: 12,
    color: '#888',
  },
  pollTitleKu: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 2,
  },
  pollTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  pollDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 14,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  optionSelected: {
    borderColor: KurdistanColors.kesk,
    borderWidth: 2,
  },
  optionWinner: {
    borderColor: KurdistanColors.zer,
    borderWidth: 2,
  },
  optionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 9,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 14,
    color: KurdistanColors.reş,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  optionPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginLeft: 8,
  },
  pollDeadline: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 10,
    textAlign: 'right',
  },
});

export default PollsScreen;
