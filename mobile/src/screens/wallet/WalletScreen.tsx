import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi, NETWORKS } from '../../contexts/PezkuwiContext';
import { QRScannerModal } from '../../components/wallet/QRScannerModal';

// Extracted hooks
import { useWalletBalances } from '../../hooks/useWalletBalances';
import { useTokenList } from '../../hooks/useTokenList';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';

// Extracted components
import { TokenList } from '../../components/wallet/TokenList';
import { WalletSelector } from '../../components/wallet/WalletSelector';
import { NetworkSelector } from '../../components/wallet/NetworkSelector';
import { TransactionHistorySection } from '../../components/wallet/TransactionHistorySection';

// Token logos
import hezLogo from '../../../../shared/images/hez_token_512.png';
import pezLogo from '../../../../shared/images/pez_token_512.png';

type WalletNavProp = NativeStackNavigationProp<{
  Send: { tokenSymbol: string; tokenName: string; tokenBalance: string; tokenAssetId?: number; tokenLogo?: unknown };
  Receive: undefined;
  Swap: undefined;
  WalletSetup: undefined;
  [key: string]: undefined | Record<string, unknown>;
}>;

const WalletScreen: React.FC = () => {
  const navigation = useNavigation<WalletNavProp>();
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    deleteWallet,
    renameWallet,
    currentNetwork,
    switchNetwork,
  } = usePezkuwi();

  // Extracted hooks
  const { balances, isLoadingBalances, refreshBalances } = useWalletBalances();
  const { allTokens, isLoadingTokens, hiddenTokens, toggleTokenVisibility } = useTokenList();
  const {
    transactions,
    isLoadingHistory,
    historyFilter,
    setHistoryFilter,
    historyScanProgress,
  } = useTransactionHistory();

  // Modal state
  const [walletSelectorVisible, setWalletSelectorVisible] = useState(false);
  const [networkSelectorVisible, setNetworkSelectorVisible] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  // Redirect if no wallet
  useEffect(() => {
    if (!selectedAccount && accounts.length === 0) {
      navigation.replace('WalletSetup');
    }
  }, [selectedAccount, accounts, navigation]);

  if (!selectedAccount && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Network Badge */}
      <View style={styles.networkRow}>
        <TouchableOpacity
          onPress={() => setNetworkSelectorVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Switch network, currently ${NETWORKS[currentNetwork].displayName}`}
        >
          <Text style={styles.networkBadge}>
            🌐 {NETWORKS[currentNetwork].displayName}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoadingBalances} onRefresh={refreshBalances} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet Selector */}
        <View style={styles.walletSelectorRow}>
          <TouchableOpacity
            style={styles.walletSelector}
            onPress={() => setWalletSelectorVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Select wallet, currently ${selectedAccount?.name || 'Wallet'}`}
          >
            <View style={styles.walletSelectorInfo}>
              <Text style={styles.walletSelectorName}>{selectedAccount?.name || 'Wallet'}</Text>
              <Text style={styles.walletSelectorAddress} numberOfLines={1}>
                {selectedAccount?.address ? `${selectedAccount.address.slice(0, 8)}...${selectedAccount.address.slice(-6)}` : ''}
              </Text>
            </View>
            <Text style={styles.walletSelectorArrow}>▼</Text>
          </TouchableOpacity>
          <View style={styles.walletHeaderButtons}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('WalletSetup')} accessibilityRole="button" accessibilityLabel="Add new wallet">
              <Text style={styles.headerBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setQrScannerVisible(true)} accessibilityRole="button" accessibilityLabel="Scan QR code">
              <Text style={styles.headerBtnText}>⊡</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          <View style={styles.balanceCard}>
            <Image source={hezLogo} style={styles.balanceLogo} resizeMode="contain" accessibilityLabel="HEZ token logo" />
            <Text style={styles.balanceSymbol}>HEZ</Text>
            <Text style={styles.balanceAmount}>{balances.HEZ}</Text>
          </View>
          <View style={styles.balanceCard}>
            <Image source={pezLogo} style={styles.balanceLogo} resizeMode="contain" accessibilityLabel="PEZ token logo" />
            <Text style={styles.balanceSymbol}>PEZ</Text>
            <Text style={styles.balanceAmount}>{balances.PEZ}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#22C55E' }]}
            onPress={() => navigation.navigate('Send', {
              tokenSymbol: 'HEZ', tokenName: 'Pezkuwi Coin', tokenBalance: balances.HEZ, tokenLogo: hezLogo,
            })}
            accessibilityRole="button"
            accessibilityLabel="Send tokens"
          >
            <Text style={styles.actionIcon}>↑</Text>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => navigation.navigate('Receive')}
            accessibilityRole="button"
            accessibilityLabel="Receive tokens"
          >
            <Text style={styles.actionIcon}>↓</Text>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('Swap')}
            accessibilityRole="button"
            accessibilityLabel="Swap tokens"
          >
            <Text style={styles.actionIcon}>⇄</Text>
            <Text style={styles.actionLabel}>Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => setBackupModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Backup wallet"
          >
            <Text style={styles.actionIcon}>🔐</Text>
            <Text style={styles.actionLabel}>Backup</Text>
          </TouchableOpacity>
        </View>

        {/* Token List */}
        <TokenList
          tokens={allTokens}
          hiddenTokens={hiddenTokens}
          isLoading={isLoadingTokens}
          onTokenPress={(token) => navigation.navigate('Send', {
            tokenSymbol: token.symbol,
            tokenName: token.name,
            tokenBalance: token.balance,
            tokenAssetId: token.assetId ?? undefined,
            tokenLogo: token.logo ?? undefined,
          })}
          onToggleVisibility={toggleTokenVisibility}
        />

        {/* Transaction History */}
        <TransactionHistorySection
          transactions={transactions}
          isLoading={isLoadingHistory}
          filter={historyFilter}
          onFilterChange={setHistoryFilter}
          scanProgress={historyScanProgress}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <WalletSelector
        visible={walletSelectorVisible}
        onClose={() => setWalletSelectorVisible(false)}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onSelect={(account) => {
          setSelectedAccount(account);
          setWalletSelectorVisible(false);
        }}
        onRename={renameWallet}
        onDelete={deleteWallet}
        onAddNew={() => {
          setWalletSelectorVisible(false);
          navigation.navigate('WalletSetup');
        }}
      />

      <NetworkSelector
        visible={networkSelectorVisible}
        onClose={() => setNetworkSelectorVisible(false)}
        currentNetwork={currentNetwork}
        onSwitch={async (network) => {
          setNetworkSelectorVisible(false);
          await switchNetwork(network);
        }}
      />

      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={(data) => {
          setQrScannerVisible(false);
          navigation.navigate('Send', {
            tokenSymbol: 'HEZ', tokenName: 'Pezkuwi Coin', tokenBalance: balances.HEZ, tokenLogo: hezLogo,
          });
        }}
        title="Scan Address"
        subtitle="Scan a wallet address QR code"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  networkRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  networkBadge: {
    fontSize: 14, color: KurdistanColors.kesk,
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden',
  },
  walletSelectorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  walletSelector: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  walletSelectorInfo: { flex: 1 },
  walletSelectorName: { fontSize: 16, fontWeight: '600', color: '#333' },
  walletSelectorAddress: { fontSize: 12, color: '#999', marginTop: 2 },
  walletSelectorArrow: { fontSize: 12, color: '#666', marginLeft: 8 },
  walletHeaderButtons: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  headerBtnText: { fontSize: 24, color: KurdistanColors.kesk, fontWeight: '300' },
  balanceRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  balanceCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  balanceLogo: { width: 56, height: 56, marginBottom: 12 },
  balanceSymbol: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  balanceAmount: { fontSize: 24, fontWeight: 'bold', color: KurdistanColors.kesk },
  actionsGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  actionButton: {
    width: '22%' as unknown as number, aspectRatio: 1, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  actionIcon: { fontSize: 24, color: '#FFFFFF', marginBottom: 4 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
});

export default WalletScreen;
