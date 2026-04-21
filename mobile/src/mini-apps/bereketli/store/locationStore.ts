import {create} from 'zustand';
import {Platform, PermissionsAndroid} from 'react-native';
import * as Location from 'expo-location';
// Compat shim for Geolocation API
const Geolocation = {
  getCurrentPosition: (success: (pos: { coords: { latitude: number; longitude: number } }) => void, error: (err: { message: string }) => void, _options?: unknown) => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(loc => success({ coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } }))
      .catch((e: Error) => error({ message: e.message }));
  },
};
import {GOOGLE_MAPS_KEY} from '../config';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  permissionGranted: boolean;
  isLoading: boolean;
  error: string | null;

  requestPermission: () => Promise<boolean>;
  updateLocation: () => Promise<void>;
  setLocation: (lat: number, lon: number) => void;
  reverseGeocode: (lat: number, lon: number) => Promise<void>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  latitude: null,
  longitude: null,
  address: null,
  permissionGranted: false,
  isLoading: false,
  error: null,

  requestPermission: async () => {
    if (Platform.OS === 'android') {
      try {
        const already = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (already) {
          set({permissionGranted: true});
          return true;
        }
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Konum Izni',
            message: 'Yakininizdaki paketleri gosterebilmemiz icin konum izni gerekli.',
            buttonPositive: 'Izin Ver',
            buttonNegative: 'Reddet',
          },
        );
        const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
        set({permissionGranted: ok});
        return ok;
      } catch {
        set({permissionGranted: false});
        return false;
      }
    }
    set({permissionGranted: true});
    return true;
  },

  updateLocation: async () => {
    set({isLoading: true, error: null});

    let hasPermission = get().permissionGranted;
    if (!hasPermission) {
      hasPermission = await get().requestPermission();
    }
    if (!hasPermission) {
      set({isLoading: false, error: 'Konum izni verilmedi'});
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            set({latitude: lat, longitude: lon, isLoading: false, error: null});
            get().reverseGeocode(lat, lon);
            resolve();
          },
          (err) => {
            set({isLoading: false, error: err.message});
            resolve();
          },
          {enableHighAccuracy: false, timeout: 30000, maximumAge: 300000},
        );
      });
    } catch {
      set({isLoading: false});
    }
  },

  reverseGeocode: async (lat, lon) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_KEY}&language=tr`,
      );
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const components = data.results[0].address_components;
        const neighborhood = components?.find((c: any) =>
          c.types.includes('neighborhood') || c.types.includes('sublocality'),
        )?.long_name;
        const route = components?.find((c: any) =>
          c.types.includes('route'),
        )?.long_name;
        const district = components?.find((c: any) =>
          c.types.includes('administrative_area_level_2') || c.types.includes('locality'),
        )?.long_name;
        const parts = [neighborhood || route, district].filter(Boolean);
        const address = parts.length > 0 ? parts.join(', ') : data.results[0].formatted_address;
        set({address});
      }
    } catch {
      // Silent — coordinates shown as fallback
    }
  },

  setLocation: (lat, lon) => {
    set({latitude: lat, longitude: lon, address: null});
    get().reverseGeocode(lat, lon);
  },
}));
