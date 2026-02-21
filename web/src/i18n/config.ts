import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import LOCAL .ts translations
import en from './locales/en';
import tr from './locales/tr';
import kmr from './locales/kmr';
import ar from './locales/ar';
import fa from './locales/fa';
import ckb from './locales/ckb';

export const languages = {
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr' },
  tr: { name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  'ku-kurmanji': { name: 'Kurdî (Kurmancî)', flag: '☀️', dir: 'ltr' },
  'ku-sorani': { name: 'کوردی (سۆرانی)', flag: '☀️', dir: 'rtl' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  fa: { name: 'فارسی', flag: '🇮🇷', dir: 'rtl' }
};

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  'ku-kurmanji': { translation: kmr },
  'ku-sorani': { translation: ckb },
  ar: { translation: ar },
  fa: { translation: fa }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

export default i18n;
