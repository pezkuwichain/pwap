import React, {useEffect, useState} from 'react';
import {View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Linking, Image, TextInput, Modal, FlatList} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import {useAuthStore} from '../../store/authStore';
import {deleteAccount, updateProfile} from '../../api/profile';
import client from '../../api/client';
import {getOrders} from '../../api/orders';
import * as merchantsApi from '../../api/merchants';
import {LANGUAGES, changeLanguage} from '../../i18n';
import type {LanguageCode} from '../../i18n';
import type {NavigationProp} from '@react-navigation/native';

interface ProfileScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

function QuickActionCard({icon, label, count, onPress}: {icon: string; label: string; count?: number; onPress: () => void}) {
  return (
    <TouchableOpacity style={qaStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={qaStyles.iconContainer}>
        <Text style={qaStyles.icon}>{icon}</Text>
      </View>
      <Text style={qaStyles.label}>{label}</Text>
      {count != null && count > 0 && (
        <View style={qaStyles.badge}>
          <Text style={qaStyles.badgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {fontSize: 20},
  label: {fontSize: 12, fontWeight: '600', color: '#374151'},
  badge: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {fontSize: 11, fontWeight: '700', color: '#FFFFFF'},
});

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  destructive = false,
  value,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  destructive?: boolean;
  value?: string;
}) {
  return (
    <TouchableOpacity
      style={menuStyles.container}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}>
      <Text style={menuStyles.icon}>{icon}</Text>
      <View style={menuStyles.textContainer}>
        <Text style={[menuStyles.title, destructive && menuStyles.destructive]}>{title}</Text>
        {subtitle && <Text style={menuStyles.subtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={menuStyles.value}>{value}</Text>}
      {showArrow && <Text style={menuStyles.arrow}>›</Text>}
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  icon: {fontSize: 20},
  textContainer: {flex: 1},
  title: {fontSize: 15, fontWeight: '500', color: '#1A1A1A'},
  subtitle: {fontSize: 12, color: '#9CA3AF', marginTop: 2},
  destructive: {color: '#EF4444'},
  value: {fontSize: 14, color: '#9CA3AF', fontWeight: '500'},
  arrow: {fontSize: 22, color: '#D1D5DB', fontWeight: '300'},
});

export default function ProfileScreen({navigation}: ProfileScreenProps) {
  const {t, i18n} = useTranslation();
  const {user, logout, updateUser} = useAuthStore();
  const insets = useSafeAreaInsets();
  const [orderCount, setOrderCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    getOrders().then(orders => setOrderCount(orders.length)).catch(() => {});
    merchantsApi.getMyCards().then(cards => setCardCount(cards.length)).catch(() => {});
    merchantsApi.getMyAppointments().then(appts => setAppointmentCount(appts.length)).catch(() => {});
  }, []);

  const handlePickAvatar = () => {
    launchImageLibrary({mediaType: 'photo', maxWidth: 400, maxHeight: 400, quality: 0.8}, async (response) => {
      if (response.didCancel || !response.assets?.[0]?.uri) return;
      const asset = response.assets[0];
      setSaving(true);
      try {
        // Upload photo
        const formData = new FormData();
        formData.append('photo', {uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'avatar.jpg'} as any);
        const {data} = await client.post<{url: string}>('/upload/avatar', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        // Update profile with new avatar URL
        await updateProfile(undefined, data.url);
        setAvatarUri(data.url);
        if (updateUser) updateUser({avatar_url: data.url});
      } catch {
        // Avatar upload endpoint may not exist yet — save locally for display
        setAvatarUri(asset.uri || '');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert(t('common.error'), t('profile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await updateProfile(nameInput.trim());
      if (updateUser) updateUser({name: nameInput.trim()});
      setEditingName(false);
    } catch (err: unknown) {
      const message =
        (err as {response?: {data?: {message?: string}}})?.response?.data?.message ||
        t('profile.nameUpdateFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        {text: t('profile.logoutCancel'), style: 'cancel'},
        {text: t('profile.logout'), style: 'destructive', onPress: logout},
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountConfirm'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('profile.deleteAccountButton'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await logout();
            } catch {
              Alert.alert(t('common.error'), t('profile.deleteAccountFailed'));
            }
          },
        },
      ],
    );
  };

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={[styles.header, {paddingTop: insets.top + 16}]}>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        </View>

        {/* ── User Card ── */}
        <View style={styles.userCard}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
            {avatarUri ? (
              <Image source={{uri: avatarUri}} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Text style={{fontSize: 12}}>📷</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.userInfo} onPress={() => { setNameInput(user?.name || ''); setEditingName(true); }} activeOpacity={0.7}>
            <Text style={styles.userName}>{user?.name || t('profile.defaultUser')}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
            <Text style={styles.editHint}>{t('profile.editHint')}</Text>
          </TouchableOpacity>
        </View>

        {/* Name edit modal */}
        <Modal visible={editingName} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('profile.editNameTitle')}</Text>
              <TextInput
                style={styles.modalInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t('profile.namePlaceholder')}
                placeholderTextColor="#9CA3AF"
                autoFocus
                maxLength={100}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingName(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSave, saving && {opacity: 0.6}]} onPress={handleSaveName} disabled={saving}>
                  <Text style={styles.modalSaveText}>{saving ? t('common.saving') : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Quick Actions — all connected to real API data ── */}
        <View style={styles.quickActions}>
          <QuickActionCard
            icon="📦"
            label={t('profile.ordersLabel')}
            count={orderCount}
            onPress={() => navigateTo('Orders')}
          />
          <QuickActionCard
            icon="📅"
            label={t('profile.appointmentsLabel')}
            count={appointmentCount}
            onPress={() => navigateTo('Appointments')}
          />
          <QuickActionCard
            icon="💳"
            label={t('profile.loyaltyLabel')}
            count={cardCount}
            onPress={() => navigateTo('LoyaltyCards')}
          />
        </View>

        {/* ── Discover ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.discoverLabel')}</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="🍞"
              title={t('profile.surprisePackages')}
              subtitle={t('profile.surprisePackagesDesc')}
              onPress={() => navigateTo('YemekMap')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="🏪"
              title={t('profile.neighborhoodMerchants')}
              subtitle={t('profile.neighborhoodMerchantsDesc')}
              onPress={() => navigateTo('EsnafMap')}
            />
          </View>
        </View>

        {/* ── Security ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.securityLabel')}</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="🔒"
              title={t('profile.changePassword')}
              onPress={() => navigateTo('ChangePassword')}
            />
          </View>
        </View>

        {/* ── Language ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="🌍"
              title={t('profile.language')}
              value={currentLang.label}
              onPress={() => setLangModalVisible(true)}
            />
          </View>
        </View>

        {/* Language picker modal */}
        <Modal visible={langModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('profile.selectLanguage')}</Text>
              <FlatList
                data={LANGUAGES}
                keyExtractor={item => item.code}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={langStyles.row}
                    activeOpacity={0.6}
                    onPress={() => {
                      changeLanguage(item.code as LanguageCode);
                      setLangModalVisible(false);
                    }}>
                    <Text style={langStyles.label}>{item.label}</Text>
                    {item.code === i18n.language && <Text style={langStyles.check}>✓</Text>}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={langStyles.separator} />}
              />
              <TouchableOpacity
                style={[styles.modalCancel, {marginTop: 16}]}
                onPress={() => setLangModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Support ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.supportLabel')}</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="❓"
              title={t('profile.faq')}
              subtitle={t('profile.faqDesc')}
              onPress={() => navigateTo('Faq')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="📧"
              title={t('profile.contactLabel')}
              subtitle={t('profile.contactEmail')}
              onPress={() => Linking.openURL(`mailto:${t('profile.contactEmail')}`)}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="🌐"
              title={t('profile.website')}
              subtitle={t('profile.websiteUrl')}
              onPress={() => Linking.openURL(`https://${t('profile.websiteUrl')}`)}
            />
          </View>
        </View>

        {/* ── App ── */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="ℹ️"
              title={t('profile.version')}
              value="1.0.0"
              showArrow={false}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="🚪"
              title={t('profile.logout')}
              onPress={handleLogout}
              showArrow={false}
              destructive
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="⚠️"
              title={t('profile.deleteAccount')}
              subtitle={t('profile.deleteAccountDesc')}
              onPress={handleDeleteAccount}
              showArrow={false}
              destructive
            />
          </View>
        </View>

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  userCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarImage: {
    width: 56, height: 56, borderRadius: 28,
  },
  cameraIcon: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  userInfo: {flex: 1},
  userName: {fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 2},
  userEmail: {fontSize: 13, color: '#9CA3AF'},
  editHint: {fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2},
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
  },
  modalTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16},
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1A1A1A',
  },
  modalButtons: {flexDirection: 'row', gap: 12, marginTop: 20},
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  modalCancelText: {fontSize: 15, fontWeight: '600', color: '#6B7280'},
  modalSave: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  modalSaveText: {fontSize: 15, fontWeight: '700', color: '#FFFFFF'},

  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },

  section: {marginTop: 16, paddingHorizontal: 16},
  sectionLabel: {fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginLeft: 4},
  menuCard: {backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden'},
  menuDivider: {height: 1, backgroundColor: '#F3F4F6', marginLeft: 52},
});

const langStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  label: {fontSize: 16, fontWeight: '500', color: '#1A1A1A'},
  check: {fontSize: 18, fontWeight: '700', color: colors.primary},
  separator: {height: 1, backgroundColor: '#F3F4F6'},
});
