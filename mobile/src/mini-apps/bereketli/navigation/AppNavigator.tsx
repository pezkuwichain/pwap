import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {useAuthStore} from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen, {ONBOARDING_KEY} from '../screens/OnboardingScreen';
import AiChatScreen from '../screens/chat/AiChatScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {View} from 'react-native';
import {loadSavedLanguage} from '../i18n';

const AI_WELCOME_KEY = '@bereketli_ai_welcomed';

export default function AppNavigator() {
  const {isLoggedIn, isLoading, checkAuth} = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showAiWelcome, setShowAiWelcome] = useState<boolean | null>(null);
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    loadSavedLanguage().finally(() => setLangReady(true));
    checkAuth();
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setShowOnboarding(val !== 'true');
    });
    AsyncStorage.getItem(AI_WELCOME_KEY).then(val => {
      setShowAiWelcome(val !== 'true');
    });
  }, [checkAuth]);

  if (!langReady) {
    return <View style={{flex: 1, backgroundColor: '#2D5016'}} />;
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (showOnboarding === null || showAiWelcome === null || isLoading) {
    return <View style={{flex: 1, backgroundColor: '#F8F8F8'}} />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // First time after login — show AI welcome
  if (showAiWelcome) {
    return (
      <AiChatScreen
        navigation={{
          goBack: async () => {
            await AsyncStorage.setItem(AI_WELCOME_KEY, 'true');
            setShowAiWelcome(false);
          },
        } as never}
        route={{} as never}
      />
    );
  }

  return (
    <NavigationContainer>
      <MainTabNavigator />
    </NavigationContainer>
  );
}
