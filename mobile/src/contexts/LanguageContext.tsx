import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { isRTL, languages } from '../i18n';
import i18n from '../i18n';

// Language is set at build time via environment variable
const BUILD_LANGUAGE = process.env.EXPO_PUBLIC_DEFAULT_LANGUAGE || 'en';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

interface LanguageContextType {
  currentLanguage: string;
  isRTL: boolean;
  hasSelectedLanguage: boolean;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Language is fixed at build time - no runtime switching
  const [currentLanguage] = useState(BUILD_LANGUAGE);
  const [currentIsRTL] = useState(isRTL(BUILD_LANGUAGE));

  useEffect(() => {
    // Initialize i18n with build-time language
    i18n.changeLanguage(BUILD_LANGUAGE);

    // Set RTL if needed
    const isRTLLanguage = ['ar', 'ckb', 'fa'].includes(BUILD_LANGUAGE);
    I18nManager.allowRTL(isRTLLanguage);
    I18nManager.forceRTL(isRTLLanguage);

    if (__DEV__) {
      console.log(`[LanguageContext] Build language: ${BUILD_LANGUAGE}, RTL: ${isRTLLanguage}`);
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        isRTL: currentIsRTL,
        hasSelectedLanguage: true, // Always true - language pre-selected at build time
        availableLanguages: languages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
