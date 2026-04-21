import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {View, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {colors} from '../theme';

// Yemek screens
import YemekMapScreen from '../screens/yemek/YemekMapScreen';
import PackageDetailScreen from '../screens/yemek/PackageDetailScreen';
// Komsu screens
import KomsuListScreen from '../screens/komsu/KomsuListScreen';
import MealDetailScreen from '../screens/komsu/MealDetailScreen';
// Orders screens
import OrdersScreen from '../screens/yemek/OrdersScreen';
import OrderDetailScreen from '../screens/yemek/OrderDetailScreen';
import QrScanScreen from '../screens/yemek/QrScanScreen';
import MealOrderDetailScreen from '../screens/yemek/MealOrderDetailScreen';
import SearchScreen from '../screens/yemek/SearchScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
// Esnaf screens
import EsnafMapScreen from '../screens/esnaf/EsnafMapScreen';
import MerchantDetailScreen from '../screens/esnaf/MerchantDetailScreen';
// Profil screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import FaqScreen from '../screens/profile/FaqScreen';
import AppointmentsScreen from '../screens/profile/AppointmentsScreen';
import LoyaltyCardsScreen from '../screens/profile/LoyaltyCardsScreen';
import ReferralScreen from '../screens/profile/ReferralScreen';
import AiChatScreen from '../screens/chat/AiChatScreen';

// ── Stack Param Lists ────────────────────────────
export type YemekStackParamList = {
  YemekMap: undefined;
  PackageDetail: {packageId: string; storeName?: string; storeAddress?: string};
  OrderDetail: {orderId: string};
  LocationPicker: undefined;
  Search: undefined;
  Referral: undefined;
  AiChat: undefined;
};

export type KomsuStackParamList = {
  KomsuList: undefined;
  MealDetail: {mealId: string; cookName?: string};
  AiChat: undefined;
};

export type OrdersStackParamList = {
  OrdersMain: undefined;
  OrderDetail: {orderId: string};
  MealOrderDetail: {order: any};
  QrScan: undefined;
};

export type EsnafStackParamList = {
  EsnafMap: undefined;
  MerchantDetail: {merchantId: string};
  AiChat: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ChangePassword: undefined;
  Orders: undefined;
  OrderDetail: {orderId: string};
  YemekMap: undefined;
  EsnafMap: undefined;
  Faq: undefined;
  Appointments: undefined;
  LoyaltyCards: undefined;
  Referral: undefined;
  AiChat: undefined;
};

// ── Stack Navigators ────────────────────────────

const YemekStack = createNativeStackNavigator<YemekStackParamList>();
function YemekNavigator() {
  return (
    <YemekStack.Navigator screenOptions={{headerShown: false}}>
      <YemekStack.Screen name="YemekMap" component={YemekMapScreen} />
      <YemekStack.Screen name="PackageDetail" component={PackageDetailScreen} />
      <YemekStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <YemekStack.Screen name="LocationPicker" component={LocationPickerScreen} />
      <YemekStack.Screen name="Search" component={SearchScreen} />
      <YemekStack.Screen name="Referral" component={ReferralScreen} />
      <YemekStack.Screen name="AiChat" component={AiChatScreen} />
    </YemekStack.Navigator>
  );
}

const KomsuStack = createNativeStackNavigator<KomsuStackParamList>();
function KomsuNavigator() {
  return (
    <KomsuStack.Navigator screenOptions={{headerShown: false}}>
      <KomsuStack.Screen name="KomsuList" component={KomsuListScreen} />
      <KomsuStack.Screen name="MealDetail" component={MealDetailScreen} />
      <KomsuStack.Screen name="AiChat" component={AiChatScreen} />
    </KomsuStack.Navigator>
  );
}

const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{headerShown: false}}>
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <OrdersStack.Screen name="MealOrderDetail" component={MealOrderDetailScreen} />
      <OrdersStack.Screen name="QrScan" component={QrScanScreen} />
    </OrdersStack.Navigator>
  );
}

const EsnafStack = createNativeStackNavigator<EsnafStackParamList>();
function EsnafNavigator() {
  return (
    <EsnafStack.Navigator screenOptions={{headerShown: false}}>
      <EsnafStack.Screen name="EsnafMap" component={EsnafMapScreen} />
      <EsnafStack.Screen name="MerchantDetail" component={MerchantDetailScreen} />
      <EsnafStack.Screen name="AiChat" component={AiChatScreen} />
    </EsnafStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{headerShown: false}}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Orders" component={OrdersScreen} />
      <ProfileStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <ProfileStack.Screen name="YemekMap" component={YemekMapScreen} />
      <ProfileStack.Screen name="EsnafMap" component={EsnafMapScreen} />
      <ProfileStack.Screen name="Faq" component={FaqScreen} />
      <ProfileStack.Screen name="Appointments" component={AppointmentsScreen} />
      <ProfileStack.Screen name="LoyaltyCards" component={LoyaltyCardsScreen} />
      <ProfileStack.Screen name="Referral" component={ReferralScreen} />
      <ProfileStack.Screen name="AiChat" component={AiChatScreen} />
    </ProfileStack.Navigator>
  );
}

// ── Tab Icon Component (vector icons like YS) ──

// ── Raised Center Button (YS style cart) ────────

function CenterTabIcon({focused}: {focused: boolean}) {
  return (
    <View style={centerStyles.outer}>
      <View style={[centerStyles.circle, focused && centerStyles.circleFocused]}>
        <Icon name="shopping-outline" size={28} color="#FFFFFF" />
      </View>
    </View>
  );
}

const centerStyles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  circleFocused: {
    backgroundColor: colors.primaryDark,
  },
});

// ── Tab Navigator ───────────────────────────────

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 34);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 24,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -6},
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}>
      <Tab.Screen
        name="Paketler"
        component={YemekNavigator}
        options={{
          tabBarLabel: t('tabs.paketler'),
          tabBarIcon: ({color}) => (
            <Icon name="shopping" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Komsu"
        component={KomsuNavigator}
        options={{
          tabBarLabel: t('tabs.komsu'),
          tabBarIcon: ({color}) => (
            <Icon name="home-group" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Siparis"
        component={OrdersNavigator}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({focused}) => <CenterTabIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Esnaf"
        component={EsnafNavigator}
        options={{
          tabBarLabel: t('tabs.esnaf'),
          tabBarIcon: ({color}) => (
            <Icon name="store" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileNavigator}
        options={{
          tabBarLabel: t('tabs.hesabim'),
          tabBarIcon: ({color}) => (
            <Icon name="account" size={26} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
