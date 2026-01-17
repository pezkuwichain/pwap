import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SimpleHeader, GradientHeader } from '../components/navigation/SharedHeader';
import { KurdistanColors } from '../theme/colors';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import WalletScreen from '../screens/WalletScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import SwapScreen from '../screens/SwapScreen';
import P2PScreen from '../screens/P2PScreen';
import B2BScreen from '../screens/B2BScreen';
import TaxZekatScreen from '../screens/TaxZekatScreen';
import LaunchpadScreen from '../screens/LaunchpadScreen';
import PresidentScreen from '../screens/PresidentScreen';
import VoteScreen from '../screens/VoteScreen';
import ValidatorsScreen from '../screens/ValidatorsScreen';
import ProposalsScreen from '../screens/ProposalsScreen';
import IdentityScreen from '../screens/IdentityScreen';
import ForumScreen from '../screens/ForumScreen';
import KurdMediaScreen from '../screens/KurdMediaScreen';
import PerwerdeScreen from '../screens/PerwerdeScreen';
import BankScreen from '../screens/BankScreen';
import AssemblyScreen from '../screens/AssemblyScreen';
import JusticeScreen from '../screens/JusticeScreen';
import PollsScreen from '../screens/PollsScreen';
import WhatsKURDScreen from '../screens/WhatsKURDScreen';
import EventsScreen from '../screens/EventsScreen';
import HelpScreen from '../screens/HelpScreen';
import MusicScreen from '../screens/MusicScreen';
import VPNScreen from '../screens/VPNScreen';
import UniversityScreen from '../screens/UniversityScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import ResearchScreen from '../screens/ResearchScreen';

export type HomeStackParamList = {
  Dashboard: undefined;
  Wallet: undefined;
  WalletSetup: undefined;
  Swap: undefined;
  P2P: undefined;
  B2B: undefined;
  TaxZekat: undefined;
  Launchpad: undefined;
  President: undefined;
  Vote: undefined;
  Validators: undefined;
  Proposals: undefined;
  Identity: undefined;
  Forum: undefined;
  KurdMedia: undefined;
  Perwerde: undefined;
  Bank: undefined;
  Assembly: undefined;
  Justice: undefined;
  Polls: undefined;
  WhatsKURD: undefined;
  Events: undefined;
  Help: undefined;
  Music: undefined;
  VPN: undefined;
  University: undefined;
  Certificates: undefined;
  Research: undefined;
};

const Stack = createStackNavigator<HomeStackParamList>();

const HomeStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        header: (props) => <SimpleHeader {...props} />,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerTitle: 'Cîzdan / Wallet' }} />
      <Stack.Screen name="WalletSetup" component={WalletSetupScreen} options={{ headerTitle: 'Cîzdan Saz Bike' }} />
      <Stack.Screen name="Swap" component={SwapScreen} options={{ headerTitle: 'Swap' }} />
      <Stack.Screen name="P2P" component={P2PScreen} options={{ headerTitle: 'P2P Bazirganî' }} />
      <Stack.Screen name="B2B" component={B2BScreen} options={{ headerTitle: 'B2B Bazirganî' }} />
      <Stack.Screen name="TaxZekat" component={TaxZekatScreen} options={{ headerTitle: 'Bac & Zekat' }} />
      <Stack.Screen name="Launchpad" component={LaunchpadScreen} options={{ headerTitle: '🚀 Launchpad' }} />
      <Stack.Screen name="President" component={PresidentScreen} options={{ headerTitle: 'Serok' }} />
      <Stack.Screen name="Vote" component={VoteScreen} options={{ headerTitle: 'Deng' }} />
      <Stack.Screen name="Validators" component={ValidatorsScreen} options={{ headerTitle: 'Validators' }} />
      <Stack.Screen name="Proposals" component={ProposalsScreen} options={{ headerTitle: 'Pêşniyar' }} />
      <Stack.Screen
        name="Identity"
        component={IdentityScreen}
        options={{
          headerTitle: '🆔 Nasnameya Dîjîtal',
          header: (props) => <GradientHeader {...props} subtitle="Digital Identity" gradientColors={[KurdistanColors.kesk, '#006633']} />
        }}
      />
      <Stack.Screen name="Forum" component={ForumScreen} options={{ headerTitle: 'Forum' }} />
      <Stack.Screen
        name="KurdMedia"
        component={KurdMediaScreen}
        options={{
          headerTitle: 'KurdMedia',
          header: (props) => <GradientHeader {...props} subtitle="Medyaya Kurdî & Piştgirî" gradientColors={[KurdistanColors.sor, '#C62828']} />
        }}
      />
      <Stack.Screen
        name="Perwerde"
        component={PerwerdeScreen}
        options={{
          headerTitle: 'Perwerde',
          header: (props) => <GradientHeader {...props} subtitle="Platforma Perwerdehiya Dijîtal" gradientColors={[KurdistanColors.zer, '#F59E0B']} />
        }}
      />
      <Stack.Screen name="Bank" component={BankScreen} options={{ headerTitle: 'Bank' }} />
      <Stack.Screen name="Assembly" component={AssemblyScreen} options={{ headerTitle: 'Meclîs' }} />
      <Stack.Screen name="Justice" component={JusticeScreen} options={{ headerTitle: 'Dadwerî' }} />
      <Stack.Screen name="Polls" component={PollsScreen} options={{ headerTitle: 'Rapirsî' }} />
      <Stack.Screen name="WhatsKURD" component={WhatsKURDScreen} options={{ headerTitle: 'whatsKURD' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ headerTitle: 'Çalakî' }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ headerTitle: 'Arîkarî' }} />
      <Stack.Screen name="Music" component={MusicScreen} options={{ headerTitle: 'Muzîk' }} />
      <Stack.Screen name="VPN" component={VPNScreen} options={{ headerTitle: 'VPN' }} />
      <Stack.Screen name="University" component={UniversityScreen} options={{ headerTitle: 'Zanîngehî' }} />
      <Stack.Screen name="Certificates" component={CertificatesScreen} options={{ headerTitle: 'Sertîfîka' }} />
      <Stack.Screen name="Research" component={ResearchScreen} options={{ headerTitle: 'Lêkolîn' }} />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
