import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all language translations
import enTranslations from './locales/en';
import trTranslations from './locales/tr';
import kmrTranslations from './locales/kmr';
import ckbTranslations from './locales/ckb';
import arTranslations from './locales/ar';
import faTranslations from './locales/fa';

export const languages = {
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr' },
  tr: { name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  kmr: { name: 'Kurdî (Kurmancî)', flag: '☀️', dir: 'ltr' },
  ckb: { name: 'کوردی (سۆرانی)', flag: '☀️', dir: 'rtl' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  fa: { name: 'فارسی', flag: '🇮🇷', dir: 'rtl' }
};

const resources = {
  en: { translation: enTranslations },
  tr: { translation: trTranslations },
  kmr: { translation: kmrTranslations },
  ckb: { translation: ckbTranslations },
  ar: { translation: arTranslations },
  fa: { translation: faTranslations }
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