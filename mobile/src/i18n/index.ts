import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import shared translations and language configurations
import {
  comprehensiveTranslations as translations,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  isRTL as checkIsRTL,
} from '../../../shared/i18n';

// Language is set at build time via environment variable
const BUILD_LANGUAGE = (process.env.EXPO_PUBLIC_DEFAULT_LANGUAGE || DEFAULT_LANGUAGE) as string;

// Available languages (re-export for compatibility)
export const languages = LANGUAGES;

// Initialize i18n with build-time language only
const initializeI18n = () => {
  if (__DEV__) {
    console.log(`[i18n] Initializing with build language: ${BUILD_LANGUAGE}`);
  }

  i18n
    .use(initReactI18next)
    .init({
      resources: {
        // Only load the build-time language (reduces APK size)
        [BUILD_LANGUAGE]: { translation: translations[BUILD_LANGUAGE as keyof typeof translations] },
      },
      lng: BUILD_LANGUAGE,
      fallbackLng: BUILD_LANGUAGE,
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
    });

  return BUILD_LANGUAGE;
};

// Get current language (always returns BUILD_LANGUAGE)
export const getCurrentLanguage = () => BUILD_LANGUAGE;

// Check if language is RTL
export const isRTL = (languageCode?: string) => {
  const code = languageCode || BUILD_LANGUAGE;
  return checkIsRTL(code);
};

// Initialize i18n automatically
initializeI18n();

export { initializeI18n, BUILD_LANGUAGE };
export default i18n;
