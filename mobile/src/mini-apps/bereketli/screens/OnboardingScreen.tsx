import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  Switch,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
// TODO: Replace with expo-notifications in Faz 4
const messaging = Object.assign(
  () => ({ requestPermission: async () => 1, getToken: async () => '' }),
  { AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, NOT_DETERMINED: -1, DENIED: 0 } }
);
import {useTranslation} from 'react-i18next';
import {colors} from '../theme';
import {useLocationStore} from '../store/locationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {width} = Dimensions.get('window');
const BASE_URL = 'https://bereketli.pezkiwi.app';

const ONBOARDING_KEY = '@bereketli_onboarding_done';

interface OnboardingScreenProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    titleKey: 'onboarding.slide1Title',
    descKey: 'onboarding.slide1Desc',
    image: `${BASE_URL}/bereketli_paket.png`,
    bg: '#1B4332',
  },
  {
    titleKey: 'onboarding.slide2Title',
    descKey: 'onboarding.slide2Desc',
    image: `${BASE_URL}/store-owner.png`,
    bg: '#92400E',
  },
  {
    titleKey: 'onboarding.slide3Title',
    descKey: 'onboarding.slide3Desc',
    image: `${BASE_URL}/logo.png`,
    bg: '#2D6A4F',
  },
];

export default function OnboardingScreen({onFinish}: OnboardingScreenProps) {
  const {t} = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const {updateLocation} = useLocationStore();

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({index: currentIndex + 1});
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last slide — request selected permissions then finish
      if (locationEnabled) {
        await updateLocation();
      }
      if (notifEnabled) {
        try {
          const authStatus = await messaging().requestPermission();
          if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
              authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
            await AsyncStorage.setItem('@bereketli_notif_enabled', 'true');
          }
        } catch {}
      }
      if (Platform.OS === 'android') {
        if (micEnabled) {
          try { await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO); } catch {}
        }
        if (cameraEnabled) {
          try { await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA); } catch {}
        }
      }
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      onFinish();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onFinish();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        renderItem={({item, index}) => (
          <View style={[styles.slide, {width, backgroundColor: item.bg}]}>
            <View style={[styles.slideContent, {paddingTop: insets.top + 60}]}>
              <Image
                source={{uri: item.image}}
                style={styles.slideImage}
                resizeMode="contain"
              />
              <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
              <Text style={styles.slideDesc}>{t(item.descKey)}</Text>

              {index === SLIDES.length - 1 && (
                <View style={styles.permissionsBox}>
                  <View style={styles.permRow}>
                    <View style={styles.permInfo}>
                      <Text style={styles.permIcon}>📍</Text>
                      <View>
                        <Text style={styles.permLabel}>{t('onboarding.locationLabel')}</Text>
                        <Text style={styles.permDesc}>{t('onboarding.locationDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={locationEnabled}
                      onValueChange={setLocationEnabled}
                      trackColor={{false: '#666666', true: '#FBBF24'}}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>
                  <View style={styles.permDivider} />
                  <View style={styles.permRow}>
                    <View style={styles.permInfo}>
                      <Text style={styles.permIcon}>🔔</Text>
                      <View>
                        <Text style={styles.permLabel}>{t('onboarding.notificationLabel')}</Text>
                        <Text style={styles.permDesc}>{t('onboarding.notificationDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={notifEnabled}
                      onValueChange={setNotifEnabled}
                      trackColor={{false: '#666666', true: '#FBBF24'}}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>
                  <View style={styles.permDivider} />
                  <View style={styles.permRow}>
                    <View style={styles.permInfo}>
                      <Text style={styles.permIcon}>🎤</Text>
                      <View>
                        <Text style={styles.permLabel}>{t('onboarding.micLabel')}</Text>
                        <Text style={styles.permDesc}>{t('onboarding.micDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={micEnabled}
                      onValueChange={setMicEnabled}
                      trackColor={{false: '#666666', true: '#FBBF24'}}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>
                  <View style={styles.permDivider} />
                  <View style={styles.permRow}>
                    <View style={styles.permInfo}>
                      <Text style={styles.permIcon}>📷</Text>
                      <View>
                        <Text style={styles.permLabel}>{t('onboarding.cameraLabel')}</Text>
                        <Text style={styles.permDesc}>{t('onboarding.cameraDesc')}</Text>
                      </View>
                    </View>
                    <Switch
                      value={cameraEnabled}
                      onValueChange={setCameraEnabled}
                      trackColor={{false: '#666666', true: '#FBBF24'}}
                      thumbColor={'#FFFFFF'}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, {paddingBottom: Math.max(insets.bottom, 30)}]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {currentIndex < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity onPress={handleSkip}>
                <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                <Text style={styles.nextBtnText}>{t('onboarding.next')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, styles.startBtn]} onPress={handleNext}>
              <Text style={styles.nextBtnText}>{t('onboarding.start')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export {ONBOARDING_KEY};

const styles = StyleSheet.create({
  container: {flex: 1},
  slide: {flex: 1, justifyContent: 'center'},
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  slideImage: {
    width: 180,
    height: 180,
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  nextBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  startBtn: {
    flex: 1,
  },
  permissionsBox: {
    marginTop: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  permInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  permIcon: {fontSize: 22},
  permLabel: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
  permDesc: {fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1},
  permDivider: {height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8},
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
});
