import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import ku from './locales/ku.json';
import ckb from './locales/ckb.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';
import fa from './locales/fa.json';

export const LANGUAGES = [
  { code: 'ku', label: 'Kurmancî', rtl: false },
  { code: 'ckb', label: 'سۆرانی', rtl: true },
  { code: 'en', label: 'English', rtl: false },
  { code: 'tr', label: 'Türkçe', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'fa', label: 'فارسی', rtl: true },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const SUPPORTED_CODES = LANGUAGES.map(l => l.code) as readonly string[];
const RTL_LANGUAGES = LANGUAGES.filter(l => l.rtl).map(l => l.code) as readonly string[];
const LANGUAGE_KEY = '@pezkuwi_language';

function getDeviceLanguage(): string {
  try {
    const locales = getLocales();
    if (locales.length > 0) {
      const lang = (locales[0].languageCode || 'en').toLowerCase();
      if (SUPPORTED_CODES.includes(lang)) return lang;
      const tag = locales[0].languageTag.toLowerCase();
      if (tag.includes('ckb') || tag.includes('sorani')) return 'ckb';
      if (lang === 'ku' || tag.includes('kurmanj')) return 'ku';
    }
  } catch { /* fallback */ }
  return 'ku'; // Default to Kurmancî for Kurdistan project
}

i18n.use(initReactI18next).init({
  resources: {
    ku: { translation: ku },
    ckb: { translation: ckb },
    en: { translation: en },
    tr: { translation: tr },
    ar: { translation: ar },
    fa: { translation: fa },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Load saved language preference
AsyncStorage.getItem(LANGUAGE_KEY).then(savedLang => {
  if (savedLang && SUPPORTED_CODES.includes(savedLang)) {
    i18n.changeLanguage(savedLang);
    I18nManager.forceRTL(RTL_LANGUAGES.includes(savedLang));
  }
});

export async function changeLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  const isRTL = RTL_LANGUAGES.includes(code);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
  }
}

export default i18n;
