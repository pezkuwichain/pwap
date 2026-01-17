import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors } from '../theme/colors';

// Types
interface Course {
  id: number;
  owner: string;
  name: string;
  description: string;
  content_link: string;
  status: 'Active' | 'Archived';
  created_at: number;
}

interface Enrollment {
  student: string;
  course_id: number;
  enrolled_at: number;
  completed_at: number | null;
  points_earned: number;
}

type TabType = 'courses' | 'enrolled' | 'completed';

const PerwerdeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { selectedAccount, api, isApiReady } = usePezkuwi();
  const isConnected = !!selectedAccount;

  // State
  const [activeTab, setActiveTab] = useState<TabType>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [perwerdeScore, setPerwerdeScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // Fetch all courses from blockchain
  const fetchCourses = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      const entries = await api.query.perwerde.courses.entries();
      const courseList: Course[] = [];

      for (const [key, value] of entries) {
        if (!value.isEmpty) {
          const data = value.toJSON() as any;
          courseList.push({
            id: data.id,
            owner: data.owner,
            name: decodeText(data.name),
            description: decodeText(data.description),
            content_link: decodeText(data.contentLink),
            status: data.status,
            created_at: data.createdAt,
          });
        }
      }

      // Sort by id descending (newest first)
      courseList.sort((a, b) => b.id - a.id);
      setCourses(courseList);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  }, [api, isApiReady]);

  // Fetch user's enrollments
  const fetchMyEnrollments = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    try {
      const studentCourses = await api.query.perwerde.studentCourses(selectedAccount.address);
      const courseIds = studentCourses.toJSON() as number[];

      const enrollmentList: Enrollment[] = [];
      let totalPoints = 0;

      for (const courseId of courseIds) {
        const enrollment = await api.query.perwerde.enrollments([selectedAccount.address, courseId]);
        if (!enrollment.isEmpty) {
          const data = enrollment.toJSON() as any;
          enrollmentList.push({
            student: data.student,
            course_id: data.courseId,
            enrolled_at: data.enrolledAt,
            completed_at: data.completedAt,
            points_earned: data.pointsEarned,
          });

          if (data.completedAt) {
            totalPoints += data.pointsEarned;
          }
        }
      }

      setMyEnrollments(enrollmentList);
      setPerwerdeScore(totalPoints);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    }
  }, [api, isApiReady, selectedAccount]);

  // Helper to decode bounded vec to string
  const decodeText = (data: number[] | string): string => {
    if (typeof data === 'string') return data;
    try {
      return new TextDecoder().decode(new Uint8Array(data));
    } catch {
      return '';
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCourses(), fetchMyEnrollments()]);
    setLoading(false);
  }, [fetchCourses, fetchMyEnrollments]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (isConnected && api && isApiReady) {
      loadData();
    }
  }, [isConnected, api, isApiReady, loadData]);

  // Check if user is enrolled in a course
  const isEnrolled = (courseId: number): boolean => {
    return myEnrollments.some(e => e.course_id === courseId);
  };

  // Check if course is completed
  const isCompleted = (courseId: number): boolean => {
    const enrollment = myEnrollments.find(e => e.course_id === courseId);
    return enrollment?.completed_at !== null && enrollment?.completed_at !== undefined;
  };

  // Get enrollment for a course
  const getEnrollment = (courseId: number): Enrollment | undefined => {
    return myEnrollments.find(e => e.course_id === courseId);
  };

  // Enroll in course
  const handleEnroll = async (courseId: number) => {
    if (!api || !selectedAccount) {
      Alert.alert('Xeletî / Error', 'Ji kerema xwe berî têketinê wallet ve girêbidin.');
      return;
    }

    setEnrolling(true);

    try {
      const extrinsic = api.tx.perwerde.enroll(courseId);

      await new Promise<void>((resolve, reject) => {
        extrinsic.signAndSend(
          selectedAccount.address,
          { signer: selectedAccount.signer },
          ({ status, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
              return;
            }

            if (status.isInBlock || status.isFinalized) {
              resolve();
            }
          }
        );
      });

      Alert.alert(
        'Serkeftî! / Success!',
        'Tu bi serkeftî tev li kursê bûyî!\n\nYou have successfully enrolled in the course!',
        [{ text: 'Temam / OK' }]
      );

      // Refresh data
      await loadData();
      setShowCourseModal(false);
    } catch (error) {
      console.error('Enrollment error:', error);
      Alert.alert(
        'Xeletî / Error',
        `Têketin têk çû: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'Temam / OK' }]
      );
    } finally {
      setEnrolling(false);
    }
  };

  // Open IPFS content
  const openContent = async (ipfsHash: string) => {
    const url = ipfsHash.startsWith('http')
      ? ipfsHash
      : `https://ipfs.io/ipfs/${ipfsHash}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Xeletî / Error', 'Nikarim linkê vebikum.');
      }
    } catch (error) {
      Alert.alert('Xeletî / Error', 'Tiştek xelet çû.');
    }
  };

  // Filter courses based on active tab
  const getFilteredCourses = (): Course[] => {
    switch (activeTab) {
      case 'courses':
        return courses.filter(c => c.status === 'Active');
      case 'enrolled':
        return courses.filter(c => isEnrolled(c.id) && !isCompleted(c.id));
      case 'completed':
        return courses.filter(c => isCompleted(c.id));
      default:
        return [];
    }
  };

  // Render tab button
  const renderTab = (tab: TabType, label: string, labelKu: string, count: number) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {labelKu}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
          <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render course card
  const renderCourseCard = (course: Course) => {
    const enrolled = isEnrolled(course.id);
    const completed = isCompleted(course.id);
    const enrollment = getEnrollment(course.id);

    return (
      <TouchableOpacity
        key={course.id}
        style={styles.courseCard}
        onPress={() => {
          setSelectedCourse(course);
          setShowCourseModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.courseHeader}>
          <View style={[
            styles.courseIcon,
            completed && styles.courseIconCompleted,
            enrolled && !completed && styles.courseIconEnrolled,
          ]}>
            <Text style={styles.courseIconText}>
              {completed ? '✅' : enrolled ? '📖' : '📚'}
            </Text>
          </View>
          <View style={styles.courseInfo}>
            <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
            <Text style={styles.courseId}>Kurs #{course.id}</Text>
          </View>
          {completed && enrollment && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+{enrollment.points_earned}</Text>
            </View>
          )}
        </View>
        <Text style={styles.courseDescription} numberOfLines={2}>
          {course.description}
        </Text>
        <View style={styles.courseFooter}>
          {completed ? (
            <Text style={styles.statusCompleted}>Qediya / Completed</Text>
          ) : enrolled ? (
            <Text style={styles.statusEnrolled}>Tev li / Enrolled</Text>
          ) : (
            <Text style={styles.statusAvailable}>Amade / Available</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Not connected view
  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.zer, '#F59E0B']}
          style={styles.notConnectedGradient}
        >
          <View style={styles.notConnectedContent}>
            <Text style={styles.notConnectedIcon}>📚</Text>
            <Text style={styles.notConnectedTitle}>Perwerde</Text>
            <Text style={styles.notConnectedSubtitle}>
              Platforma Perwerdehiya Dijîtal{'\n'}Digital Education Platform
            </Text>
            <Text style={styles.notConnectedText}>
              Ji kerema xwe wallet ve girêbidin da ku bikaribin kursan bibînin û tev li wan bibin.
            </Text>
            <Text style={styles.notConnectedTextEn}>
              Please connect your wallet to view and enroll in courses.
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const filteredCourses = getFilteredCourses();
  const enrolledCount = myEnrollments.filter(e => !e.completed_at).length;
  const completedCount = myEnrollments.filter(e => e.completed_at).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[KurdistanColors.zer, '#F59E0B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Perwerde</Text>
          <Text style={styles.headerSubtitle}>Platforma Perwerdehiya Dijîtal</Text>
        </View>
      </LinearGradient>

      {/* Score Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{perwerdeScore}</Text>
          <Text style={styles.scoreLabel}>Puan / Points</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{completedCount}</Text>
          <Text style={styles.scoreLabel}>Qediyayî / Done</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{enrolledCount}</Text>
          <Text style={styles.scoreLabel}>Aktîv / Active</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('courses', 'Courses', 'Kurs', courses.filter(c => c.status === 'Active').length)}
        {renderTab('enrolled', 'Enrolled', 'Tev li', enrolledCount)}
        {renderTab('completed', 'Completed', 'Qediya', completedCount)}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={KurdistanColors.zer} />
            <Text style={styles.loadingText}>Tê barkirin... / Loading...</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'courses' ? '📭' : activeTab === 'enrolled' ? '📋' : '🎓'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'courses'
                ? 'Kursek tune / No courses available'
                : activeTab === 'enrolled'
                ? 'Tu tev li kursekê nebûyî / Not enrolled in any course'
                : 'Kursek neqediyaye / No completed courses'}
            </Text>
          </View>
        ) : (
          <View style={styles.courseList}>
            {filteredCourses.map(renderCourseCard)}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Course Detail Modal */}
      <Modal
        visible={showCourseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCourseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedCourse && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedCourse.name}</Text>
                  <TouchableOpacity onPress={() => setShowCourseModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Danasîn / Description</Text>
                    <Text style={styles.modalDescription}>{selectedCourse.description}</Text>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Agahdarî / Info</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Kurs ID:</Text>
                      <Text style={styles.infoValue}>#{selectedCourse.id}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Rewş / Status:</Text>
                      <Text style={[
                        styles.infoValue,
                        { color: selectedCourse.status === 'Active' ? KurdistanColors.kesk : '#999' }
                      ]}>
                        {selectedCourse.status === 'Active' ? 'Aktîv' : 'Arşîv'}
                      </Text>
                    </View>
                    {isEnrolled(selectedCourse.id) && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Têketin / Enrolled:</Text>
                        <Text style={[styles.infoValue, { color: KurdistanColors.kesk }]}>
                          {isCompleted(selectedCourse.id) ? 'Qediya ✅' : 'Aktîv 📖'}
                        </Text>
                      </View>
                    )}
                    {isCompleted(selectedCourse.id) && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Puan / Points:</Text>
                        <Text style={[styles.infoValue, { color: KurdistanColors.sor, fontWeight: 'bold' }]}>
                          +{getEnrollment(selectedCourse.id)?.points_earned || 0}
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedCourse.content_link && (
                    <TouchableOpacity
                      style={styles.contentButton}
                      onPress={() => openContent(selectedCourse.content_link)}
                    >
                      <Text style={styles.contentButtonIcon}>📄</Text>
                      <Text style={styles.contentButtonText}>
                        Naveroka Kursê Veke / Open Course Content
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                <View style={styles.modalFooter}>
                  {!isEnrolled(selectedCourse.id) && selectedCourse.status === 'Active' ? (
                    <TouchableOpacity
                      style={styles.enrollButton}
                      onPress={() => handleEnroll(selectedCourse.id)}
                      disabled={enrolling}
                    >
                      {enrolling ? (
                        <ActivityIndicator color={KurdistanColors.spi} />
                      ) : (
                        <>
                          <Text style={styles.enrollButtonIcon}>📝</Text>
                          <Text style={styles.enrollButtonText}>Tev li Kursê / Enroll</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : isCompleted(selectedCourse.id) ? (
                    <View style={styles.completedBanner}>
                      <Text style={styles.completedBannerIcon}>🎓</Text>
                      <Text style={styles.completedBannerText}>
                        Te ev kurs qedand! / You completed this course!
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.enrolledBanner}>
                      <Text style={styles.enrolledBannerIcon}>📖</Text>
                      <Text style={styles.enrolledBannerText}>
                        Tu tev li vê kursê yî / You are enrolled
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    color: KurdistanColors.reş,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  headerSubtitle: {
    fontSize: 14,
    color: KurdistanColors.reş,
    opacity: 0.8,
    marginTop: 2,
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 6,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.zer,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  scoreDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    gap: 6,
  },
  tabActive: {
    backgroundColor: KurdistanColors.zer,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: KurdistanColors.reş,
  },
  tabBadge: {
    backgroundColor: '#999',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: KurdistanColors.reş,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  tabBadgeTextActive: {
    color: KurdistanColors.zer,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  courseList: {
    gap: 12,
  },
  courseCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseIconEnrolled: {
    backgroundColor: '#E3F2FD',
  },
  courseIconCompleted: {
    backgroundColor: '#E8F5E9',
  },
  courseIconText: {
    fontSize: 24,
  },
  courseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  courseId: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  courseDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusAvailable: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.yer,
  },
  statusEnrolled: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  statusCompleted: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: KurdistanColors.spi,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    flex: 1,
    marginRight: 12,
  },
  modalClose: {
    fontSize: 24,
    color: '#999',
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalDescription: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: KurdistanColors.reş,
    fontWeight: '500',
  },
  contentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  contentButtonIcon: {
    fontSize: 20,
  },
  contentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KurdistanColors.kesk,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  enrollButtonIcon: {
    fontSize: 20,
  },
  enrollButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  completedBannerIcon: {
    fontSize: 20,
  },
  completedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  enrolledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  enrolledBannerIcon: {
    fontSize: 20,
  },
  enrolledBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  // Not connected styles
  notConnectedGradient: {
    flex: 1,
  },
  notConnectedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notConnectedIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  notConnectedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  notConnectedSubtitle: {
    fontSize: 16,
    color: KurdistanColors.reş,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 24,
  },
  notConnectedText: {
    fontSize: 14,
    color: KurdistanColors.reş,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  notConnectedTextEn: {
    fontSize: 12,
    color: KurdistanColors.reş,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 18,
  },
});

export default PerwerdeScreen;
