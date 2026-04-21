import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MapView, {Marker, Region} from 'react-native-maps';
import {useTranslation} from 'react-i18next';
import {colors} from '../theme';
import {useLocationStore} from '../store/locationStore';

// Default: Istanbul center (for demo)
const DEFAULT_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LocationPickerScreen({navigation}: any) {
  const {t} = useTranslation();
  const {latitude, longitude, setLocation, updateLocation} = useLocationStore();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region>(
    latitude && longitude
      ? {latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01}
      : DEFAULT_REGION,
  );
  const [pin, setPin] = useState({
    latitude: latitude || DEFAULT_REGION.latitude,
    longitude: longitude || DEFAULT_REGION.longitude,
  });

  useEffect(() => {
    // Silently try to get location on mount — no alerts
    updateLocation().then(() => {
      const store = useLocationStore.getState();
      if (store.latitude && store.longitude) {
        setPin({latitude: store.latitude, longitude: store.longitude});
        setRegion({
          latitude: store.latitude,
          longitude: store.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
      // If failed, map shows default region — user can pick manually
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateLocation is a stable zustand store action
  }, []);

  const handleConfirm = () => {
    setLocation(pin.latitude, pin.longitude);
    navigation.goBack();
  };

  const handleUseMyLocation = async () => {
    await updateLocation();
    const store = useLocationStore.getState();
    if (store.latitude && store.longitude) {
      setPin({latitude: store.latitude, longitude: store.longitude});
      setRegion({
        latitude: store.latitude,
        longitude: store.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else if (!store.permissionGranted) {
      Alert.alert(t('locationPicker.permissionRequired'), t('locationPicker.permissionMessage'));
    } else {
      Alert.alert(t('locationPicker.gpsError'), t('locationPicker.gpsErrorMessage'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('locationPicker.title')}</Text>
        <View style={{width: 40}} />
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={e => {
          setPin(e.nativeEvent.coordinate);
        }}>
        <Marker
          coordinate={pin}
          draggable
          onDragEnd={e => setPin(e.nativeEvent.coordinate)}
        />
      </MapView>

      {/* Bottom panel */}
      <View style={[styles.bottomPanel, {paddingBottom: Math.max(insets.bottom, 20)}]}>
        <Text style={styles.coordText}>
          {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
        </Text>

        <TouchableOpacity style={styles.myLocationBtn} onPress={handleUseMyLocation}>
          <Text style={styles.myLocationText}>📍 {t('locationPicker.useMyLocation')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmText}>{t('locationPicker.confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.primary,
    zIndex: 10,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  map: {flex: 1},
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  coordText: {
    fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 12,
  },
  myLocationBtn: {
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.primary,
    alignItems: 'center', marginBottom: 10,
  },
  myLocationText: {fontSize: 15, fontWeight: '600', color: colors.primary},
  confirmBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
});
