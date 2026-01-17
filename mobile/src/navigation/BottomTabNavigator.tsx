import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { GradientHeader, SimpleHeader } from '../components/navigation/SharedHeader';

// Screens
import AppsScreen from '../screens/AppsScreen';
import ReferralScreen from '../screens/ReferralScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Nested Stack Navigator for Home tab
import HomeStackNavigator from './HomeStackNavigator';

// Removed screens from tabs (accessible via Dashboard/Apps):
// WalletScreen, SwapScreen, P2PScreen, EducationScreen, ForumScreen

export type BottomTabParamList = {
  Home: undefined;
  Apps: undefined;
  Citizen: undefined; // Dummy tab, never navigates to a screen
  Referral: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

// Custom Tab Bar Button for Center Button (Citizen) - navigates to BeCitizenChoice
const CustomTabBarButton: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  return (
    <TouchableOpacity
      style={styles.customButtonContainer}
      onPress={() => navigation.navigate('BeCitizenChoice')}
      activeOpacity={0.8}
    >
      <View style={styles.customButton}>{children}</View>
    </TouchableOpacity>
  );
};

const BottomTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        header: (props) => <SimpleHeader {...props} />,
        tabBarActiveTintColor: KurdistanColors.kesk,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          ...styles.tabBar,
          height: (Platform.OS === 'ios' ? 85 : 65) + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 8),
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.icon, { color }]}>
              {focused ? '🏠' : '🏚️'}
            </Text>
          ),
        }}
      />

      <Tab.Screen
        name="Apps"
        component={AppsScreen}
        options={{
          tabBarLabel: 'Apps',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.icon, { color }]}>
              {focused ? '📱' : '📲'}
            </Text>
          ),
        }}
      />

      <Tab.Screen
        name="Citizen"
        component={View} // Dummy component, never rendered
        options={{
          headerShown: false, // Dummy tab, no header needed
          tabBarLabel: 'Citizen',
          tabBarIcon: ({ focused: _focused }) => (
            <Text style={[styles.centerIcon]}>
              🏛️
            </Text>
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />

      <Tab.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          tabBarLabel: 'Referral',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.icon, { color }]}>
              {focused ? '🤝' : '👥'}
            </Text>
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          header: (props) => <GradientHeader {...props} />,
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.icon, { color }]}>
              {focused ? '👤' : '👨'}
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: KurdistanColors.spi,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  icon: {
    fontSize: 22,
  },
  customButtonContainer: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: KurdistanColors.kesk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#f5f5f5', // Matches background color usually
  },
  centerIcon: {
    fontSize: 30,
  },
});

export default BottomTabNavigator;
