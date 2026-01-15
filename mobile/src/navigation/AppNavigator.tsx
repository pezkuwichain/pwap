import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { KurdistanColors } from '../theme/colors';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import VerifyHumanScreen, { checkHumanVerification } from '../screens/VerifyHumanScreen';
import AuthScreen from '../screens/AuthScreen';
import BottomTabNavigator from './BottomTabNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import BeCitizenChoiceScreen from '../screens/BeCitizenChoiceScreen';
import BeCitizenApplyScreen from '../screens/BeCitizenApplyScreen';
import BeCitizenClaimScreen from '../screens/BeCitizenClaimScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import WalletScreen from '../screens/WalletScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import SwapScreen from '../screens/SwapScreen';

export type RootStackParamList = {
  Welcome: undefined;
  VerifyHuman: undefined;
  Auth: undefined;
  MainApp: undefined;
  Settings: undefined;
  EditProfile: undefined;
  Wallet: undefined;
  WalletSetup: undefined;
  Swap: undefined;
  BeCitizenChoice: undefined;
  BeCitizenApply: undefined;
  BeCitizenClaim: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  // Language is now hard-coded at build time, no selection needed
  const { user, loading } = useAuth(); // Use real auth state
  const [isHumanVerified, setIsHumanVerified] = React.useState<boolean | null>(null);
  const [privacyConsent, setPrivacyConsent] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Check privacy consent and human verification
    const checkAppState = async () => {
      try {
        const consent = await AsyncStorage.getItem('@pezkuwi/privacy_consent_accepted');
        setPrivacyConsent(consent === 'true');

        const verified = await checkHumanVerification();
        setIsHumanVerified(verified);
      } catch (error) {
        if (__DEV__) console.error('Error checking app state:', error);
        setPrivacyConsent(false);
        setIsHumanVerified(false);
      }
    };
    checkAppState();
  }, []);

  if (loading || isHumanVerified === null || privacyConsent === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={KurdistanColors.kesk} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        {!privacyConsent ? (
          // Step 0: Show Welcome screen if privacy not accepted
          <Stack.Screen name="Welcome" options={{ headerShown: false }}>
            {() => <WelcomeScreen onContinue={() => setPrivacyConsent(true)} />}
          </Stack.Screen>
        ) : !isHumanVerified ? (
          // Step 1: Show verify human screen if not verified
          <Stack.Screen name="VerifyHuman">
            {() => <VerifyHumanScreen onVerified={() => setIsHumanVerified(true)} />}
          </Stack.Screen>
        ) : !user ? (
          // Step 2: Show unified auth screen if not authenticated
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          // Step 3: Show main app (bottom tabs) if authenticated
          <>
            <Stack.Screen name="MainApp" component={BottomTabNavigator} />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BeCitizenChoice"
              component={BeCitizenChoiceScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BeCitizenApply"
              component={BeCitizenApplyScreen}
              options={{
                headerShown: true,
                headerTitle: 'Apply for Citizenship',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="BeCitizenClaim"
              component={BeCitizenClaimScreen}
              options={{
                headerShown: true,
                headerTitle: 'Verify Citizenship',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Wallet"
              component={WalletScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="WalletSetup"
              component={WalletSetupScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Swap"
              component={SwapScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
