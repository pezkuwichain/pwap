import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {I18nManager} from 'react-native';
import {getLocales} from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from './locales/tr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import ckb from './locales/ckb.json';
import ku from './locales/ku.json';
import fa from './locales/fa.json';

export const LANGUAGES = [
  {code: 'tr', label: 'Türkçe', rtl: false},
  {code: 'en', label: 'English', rtl: false},
  {code: 'ar', label: 'العربية', rtl: true},
  {code: 'ckb', label: 'سۆرانی', rtl: true},
  {code: 'ku', label: 'Kurmancî', rtl: false},
  {code: 'fa', label: 'فارسی', rtl: true},
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const SUPPORTED_CODES: readonly string[] = LANGUAGES.map(l => l.code);
const RTL_LANGUAGES: readonly string[] = LANGUAGES.filter(l => l.rtl).map(l => l.code);

const LANGUAGE_KEY = '@bereketli_language';

function getDeviceLanguage(): string {
  try {
    const locales = getLocales();
    if (locales.length > 0) {
      const lang = (locales[0].languageCode || 'en').toLowerCase();
      if (SUPPORTED_CODES.includes(lang)) return lang;

      // Check script tag for Sorani (ckb uses Arab script)
      const tag = locales[0].languageTag.toLowerCase();
      if (tag.includes('ckb') || tag.includes('sorani')) return 'ckb';
      if (lang === 'ku' || tag.includes('kurmanj')) return 'ku';
    }
  } catch {
    // react-native-localize not available
  }
  return 'tr';
}

i18n.use(initReactI18next).init({
  resources: {
    tr: {translation: tr},
    en: {translation: en},
    ar: {translation: ar},
    ckb: {translation: ckb},
    ku: {translation: ku},
    fa: {translation: fa},
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'tr',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

/** Load persisted language from AsyncStorage and apply it. Call once on app start. */
export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) {
      const isRTL = RTL_LANGUAGES.includes(saved);
      I18nManager.forceRTL(isRTL);
      I18nManager.allowRTL(isRTL);
      await i18n.changeLanguage(saved);
    }
  } catch {
    // AsyncStorage read failed — keep device language
  }
}

export async function changeLanguage(code: LanguageCode): Promise<void> {
  const isRTL = RTL_LANGUAGES.includes(code);
  I18nManager.forceRTL(isRTL);
  I18nManager.allowRTL(isRTL);
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // AsyncStorage write failed — language still changed in memory
  }
}

export default i18n;
