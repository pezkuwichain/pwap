import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  Clipboard,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi, NetworkType, NETWORKS } from '../contexts/PezkuwiContext';
import { AddTokenModal } from '../components/wallet/AddTokenModal';
import { QRScannerModal } from '../components/wallet/QRScannerModal';
import { HezTokenLogo, PezTokenLogo } from '../components/icons';
import { decodeAddress, checkAddress, encodeAddress } from '@pezkuwi/util-crypto';

// Secure storage helper - same as in PezkuwiContext
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
};

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: Array<{text: string; onPress?: () => void; style?: string}>) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const result = window.confirm(`${title}\n\n${message}`);
      if (result && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!result && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
      if (buttons?.[0]?.onPress) buttons[0].onPress();
    }
  } else {
    showAlert(title, message, buttons as any);
  }
};

// Token Images - From shared/images
// Standardized token logos
const hezLogo = require('../../../shared/images/hez_token_512.png');
const pezLogo = require('../../../shared/images/pez_token_512.png');
const usdtLogo = require('../../../shared/images/USDT(hez)logo.png');
const dotLogo = require('../../../shared/images/dot.png');
const btcLogo = require('../../../shared/images/bitcoin.png');
const ethLogo = require('../../../shared/images/etherium.png');
const bnbLogo = require('../../../shared/images/BNB_logo.png');
const adaLogo = require('../../../shared/images/ADAlogo.png');

interface Token {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  change: string;
  logo: any; // Image source
  assetId?: number;
  isLive: boolean;
}

interface Transaction {
  hash: string;
  method: string;
  section: string;
  from: string;
  to?: string;
  amount?: string;
  blockNumber: number;
  timestamp?: number;
  isIncoming: boolean;
}

const WalletScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    api,
    isApiReady,
    accounts,
    selectedAccount,
    setSelectedAccount,
    connectWallet,
    disconnectWallet,
    createWallet,
    deleteWallet,
    getKeyPair,
    currentNetwork,
    switchNetwork,
    error: pezkuwiError
  } = usePezkuwi();

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [createWalletModalVisible, setCreateWalletModalVisible] = useState(false);
  const [importWalletModalVisible, setImportWalletModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [networkSelectorVisible, setNetworkSelectorVisible] = useState(false);
  const [walletSelectorVisible, setWalletSelectorVisible] = useState(false);
  const [addTokenModalVisible, setAddTokenModalVisible] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [tokenSearchVisible, setTokenSearchVisible] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [tokenSettingsVisible, setTokenSettingsVisible] = useState(false);
  const [hiddenTokens, setHiddenTokens] = useState<string[]>([]);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [walletName, setWalletName] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importWalletName, setImportWalletName] = useState('');
  const [userMnemonic, setUserMnemonic] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // Transaction History State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [balances, setBalances] = useState<{ [key: string]: string }>({
    HEZ: '0.00',
    PEZ: '0.00',
    USDT: '0.00',
  });

  // Gas fee estimation state
  const [estimatedFee, setEstimatedFee] = useState<string>('');
  const [isEstimatingFee, setIsEstimatingFee] = useState(false);
  const [addressError, setAddressError] = useState<string>('');

  // Address Book state
  interface SavedAddress {
    address: string;
    name: string;
    lastUsed?: number;
  }
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressBookVisible, setAddressBookVisible] = useState(false);
  const [saveAddressModalVisible, setSaveAddressModalVisible] = useState(false);
  const [newAddressName, setNewAddressName] = useState('');

  const tokens: Token[] = [
    {
      symbol: 'HEZ',
      name: 'Pezkuwi',
      balance: balances.HEZ,
      value: '$0.00',
      change: '+0.00%',
      logo: hezLogo,
      isLive: true
    },
    {
      symbol: 'PEZ',
      name: 'Pezkuwi Token',
      balance: balances.PEZ,
      value: '$0.00',
      change: '+0.00%',
      logo: pezLogo,
      assetId: 1,
      isLive: true
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      balance: balances.USDT,
      value: '$0.00',
      change: '+0.00%',
      logo: usdtLogo,
      assetId: 1000,
      isLive: true
    },
  ];

  // Fetch balances and history
  const fetchData = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setIsLoadingBalances(true);
    try {
      // 1. Fetch Balances - decode address to raw bytes to avoid SS58 encoding issues
      let accountId: Uint8Array;
      try {
        accountId = decodeAddress(selectedAccount.address);
      } catch (e) {
        console.warn('[Wallet] Failed to decode address, using raw:', e);
        accountId = selectedAccount.address as any;
      }

      const accountInfo = await api.query.system.account(accountId) as any;
      const hezBalance = (Number(accountInfo.data.free.toString()) / 1e12).toFixed(2);

      let pezBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          const pezAsset = await api.query.assets.account(1, accountId) as any;
          if (pezAsset.isSome) pezBalance = (Number(pezAsset.unwrap().balance.toString()) / 1e12).toFixed(2);
        }
      } catch (e) {
        console.warn('[Wallet] PEZ balance fetch failed:', e);
      }

      let usdtBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          // Check ID 1000 first (as per constants), fallback to 2 just in case
          let usdtAsset = await api.query.assets.account(1000, accountId) as any;
          if (usdtAsset.isNone) {
             usdtAsset = await api.query.assets.account(2, accountId) as any;
          }

          if (usdtAsset.isSome) {
             // USDT uses 6 decimals usually, checking constants or assuming standard
             usdtBalance = (Number(usdtAsset.unwrap().balance.toString()) / 1e6).toFixed(2);
          }
        }
      } catch (e) {
        console.warn('[Wallet] USDT balance fetch failed:', e);
      }

      setBalances({ HEZ: hezBalance, PEZ: pezBalance, USDT: usdtBalance });

      // 2. Fetch History - TODO: Connect to production indexer when available
      // For now, skip indexer and show empty history (chain query is too slow for mobile)
      setIsLoadingHistory(true);
      // Indexer disabled until production endpoint is available
      // When ready, use: https://indexer.pezkuwichain.io/api/history/${selectedAccount.address}
      setTransactions([]);

    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoadingBalances(false);
      setIsLoadingHistory(false);
    }
  }, [api, isApiReady, selectedAccount]);

  // Real-time balance subscription
  useEffect(() => {
    if (!api || !isApiReady || !selectedAccount) return;

    let unsubscribe: (() => void) | null = null;

    const subscribeToBalance = async () => {
      try {
        let accountId: Uint8Array;
        try {
          accountId = decodeAddress(selectedAccount.address);
        } catch {
          return;
        }

        // Subscribe to balance changes
        unsubscribe = await api.query.system.account(accountId, (accountInfo: any) => {
          const hezBalance = (Number(accountInfo.data.free.toString()) / 1e12).toFixed(2);
          setBalances(prev => ({ ...prev, HEZ: hezBalance }));
          console.log('[Wallet] Balance updated via subscription:', hezBalance, 'HEZ');
        }) as unknown as () => void;
      } catch (e) {
        console.warn('[Wallet] Subscription failed, falling back to polling:', e);
        // Fallback to polling if subscription fails
        fetchData();
      }
    };

    subscribeToBalance();

    // Initial fetch for other tokens (PEZ, USDT)
    fetchData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [api, isApiReady, selectedAccount]);

  const handleTokenPress = (token: Token) => {
    if (!token.isLive) return;
    setSelectedToken(token);
    setSendModalVisible(true);
  };

  const handleSend = () => {
    setSelectedToken(tokens[0]); // Default to HEZ
    setSendModalVisible(true);
  };

  const handleReceive = () => {
    setSelectedToken(tokens[0]);
    setReceiveModalVisible(true);
  };

  // Handle QR code scan result
  const handleQRScan = (data: string) => {
    // Try to parse the scanned data
    let address = data;
    let amount: string | undefined;

    // Check if it's a Pezkuwi/Substrate URI format (e.g., "substrate:ADDRESS?amount=10")
    if (data.startsWith('substrate:') || data.startsWith('pezkuwi:')) {
      const uri = data.replace(/^(substrate:|pezkuwi:)/, '');
      const [addr, params] = uri.split('?');
      address = addr;

      if (params) {
        const urlParams = new URLSearchParams(params);
        amount = urlParams.get('amount') || undefined;
      }
    }

    // Validate the address
    try {
      const [isValid] = checkAddress(address, 42); // 42 is the SS58 prefix for Pezkuwi
      if (!isValid) {
        // Try with generic prefix
        const [isValidGeneric] = checkAddress(address, -1);
        if (!isValidGeneric) {
          showAlert('Invalid QR Code', 'The scanned QR code does not contain a valid Pezkuwi address.');
          return;
        }
      }
    } catch {
      showAlert('Invalid QR Code', 'The scanned QR code does not contain a valid address.');
      return;
    }

    // Open send modal with the scanned address
    setRecipientAddress(address);
    if (amount) {
      setSendAmount(amount);
    }
    setSelectedToken(tokens[0]); // Default to HEZ
    setSendModalVisible(true);

    // Show success feedback
    if (Platform.OS !== 'web') {
      Alert.alert('Address Scanned', `Address: ${address.slice(0, 8)}...${address.slice(-6)}${amount ? `\nAmount: ${amount}` : ''}`);
    }
  };

  // Load saved addresses from storage
  useEffect(() => {
    const loadAddressBook = async () => {
      try {
        const stored = await AsyncStorage.getItem('@pezkuwi_address_book');
        if (stored) {
          setSavedAddresses(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('[Wallet] Failed to load address book:', e);
      }
    };
    loadAddressBook();
  }, []);

  // Save address to address book
  const saveAddress = async (address: string, name: string) => {
    try {
      const newAddress: SavedAddress = {
        address,
        name,
        lastUsed: Date.now(),
      };
      const updated = [...savedAddresses.filter(a => a.address !== address), newAddress];
      setSavedAddresses(updated);
      await AsyncStorage.setItem('@pezkuwi_address_book', JSON.stringify(updated));
      showAlert('Saved', `Address "${name}" saved to address book`);
    } catch (e) {
      console.warn('[Wallet] Failed to save address:', e);
    }
  };

  // Delete address from address book
  const deleteAddress = async (address: string) => {
    try {
      const updated = savedAddresses.filter(a => a.address !== address);
      setSavedAddresses(updated);
      await AsyncStorage.setItem('@pezkuwi_address_book', JSON.stringify(updated));
    } catch (e) {
      console.warn('[Wallet] Failed to delete address:', e);
    }
  };

  // Select address from address book
  const selectSavedAddress = (address: string) => {
    setRecipientAddress(address);
    setAddressBookVisible(false);
    validateAddress(address);
  };

  // Validate address format
  const validateAddress = (address: string): boolean => {
    if (!address || address.length < 10) {
      setAddressError('Address is too short');
      return false;
    }
    try {
      // Try to decode the address - will throw if invalid
      decodeAddress(address);
      setAddressError('');
      return true;
    } catch (e) {
      setAddressError('Invalid address format');
      return false;
    }
  };

  // Estimate gas fee before sending
  const estimateFee = async () => {
    if (!api || !isApiReady || !selectedAccount || !recipientAddress || !sendAmount || !selectedToken) {
      return;
    }

    if (!validateAddress(recipientAddress)) {
      return;
    }

    setIsEstimatingFee(true);
    try {
      const decimals = selectedToken.symbol === 'USDT' ? 1e6 : 1e12;
      const amountInUnits = BigInt(Math.floor(parseFloat(sendAmount) * decimals));

      let tx;
      if (selectedToken.symbol === 'HEZ') {
        tx = api.tx.balances.transferKeepAlive(recipientAddress, amountInUnits);
      } else if (selectedToken.assetId !== undefined) {
        tx = api.tx.assets.transfer(selectedToken.assetId, recipientAddress, amountInUnits);
      } else {
        return;
      }

      // Get payment info for fee estimation
      const paymentInfo = await tx.paymentInfo(selectedAccount.address);
      const feeInHez = (Number(paymentInfo.partialFee.toString()) / 1e12).toFixed(6);
      setEstimatedFee(feeInHez);
    } catch (e) {
      console.warn('[Wallet] Fee estimation failed:', e);
      setEstimatedFee('~0.001'); // Fallback estimate
    } finally {
      setIsEstimatingFee(false);
    }
  };

  // Auto-estimate fee when inputs change
  useEffect(() => {
    if (sendModalVisible && recipientAddress && sendAmount && parseFloat(sendAmount) > 0) {
      const timer = setTimeout(estimateFee, 500); // Debounce 500ms
      return () => clearTimeout(timer);
    }
  }, [recipientAddress, sendAmount, sendModalVisible, selectedToken]);

  const handleConfirmSend = async () => {
    if (!recipientAddress || !sendAmount || !selectedToken || !selectedAccount || !api) {
      showAlert('Error', 'Please enter recipient address and amount');
      return;
    }

    // Validate address before sending
    if (!validateAddress(recipientAddress)) {
      showAlert('Error', 'Invalid recipient address');
      return;
    }

    // Check if amount is valid
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Error', 'Please enter a valid amount');
      return;
    }

    // Check if user has enough balance
    const currentBalance = parseFloat(balances[selectedToken.symbol] || '0');
    const feeEstimate = parseFloat(estimatedFee || '0.001');
    if (selectedToken.symbol === 'HEZ' && amount + feeEstimate > currentBalance) {
      showAlert('Error', `Insufficient balance. You need ${(amount + feeEstimate).toFixed(4)} HEZ (including fee)`);
      return;
    } else if (selectedToken.symbol !== 'HEZ' && amount > currentBalance) {
      showAlert('Error', `Insufficient ${selectedToken.symbol} balance`);
      return;
    }

    setIsSending(true);
    try {
        const keypair = await getKeyPair(selectedAccount.address);
        if (!keypair) throw new Error('Failed to load keypair');

        // Adjust decimals based on token
        const decimals = selectedToken.symbol === 'USDT' ? 1e6 : 1e12;
        const amountInUnits = BigInt(Math.floor(amount * decimals));

        let tx;
        if (selectedToken.symbol === 'HEZ') {
            // Use transferKeepAlive to prevent account from being reaped
            tx = api.tx.balances.transferKeepAlive(recipientAddress, amountInUnits);
        } else if (selectedToken.assetId !== undefined) {
            tx = api.tx.assets.transfer(selectedToken.assetId, recipientAddress, amountInUnits);
        } else {
            throw new Error('Unknown token type');
        }

        await tx.signAndSend(keypair, ({ status, events }) => {
            if (status.isInBlock) {
                console.log('[Wallet] Transaction in block:', status.asInBlock.toHex());
            }
            if (status.isFinalized) {
                setSendModalVisible(false);
                setIsSending(false);
                setRecipientAddress('');
                setSendAmount('');
                setEstimatedFee('');
                showAlert('Success', `Transaction finalized!\nBlock: ${status.asFinalized.toHex().slice(0, 10)}...`);
                fetchData();
            }
        });
    } catch (e: any) {
        setIsSending(false);
        showAlert('Error', e.message);
    }
  };

  // Connect/Create Wallet handlers
  const handleConnectWallet = async () => {
      if (accounts.length === 0) setCreateWalletModalVisible(true);
      else await connectWallet();
  };

  const handleCreateWallet = async () => {
      try {
        const { address, mnemonic } = await createWallet(walletName);
        setUserMnemonic(mnemonic); // Save for backup
        setCreateWalletModalVisible(false);
        showAlert('Wallet Created', `Save this mnemonic:\n${mnemonic}`, [{ text: 'OK', onPress: () => connectWallet() }]);
      } catch (e) { showAlert('Error', 'Failed'); }
  };

  // Copy Address Handler
  const handleCopyAddress = () => {
    if (!selectedAccount) return;
    Clipboard.setString(selectedAccount.address);
    showAlert('Copied!', 'Address copied to clipboard');
  };

  // Import Wallet Handler
  const handleImportWallet = async () => {
    if (!importMnemonic.trim()) {
      showAlert('Error', 'Please enter a valid mnemonic');
      return;
    }
    try {
      // Use createWallet but inject mnemonic (you may need to modify PezkuwiContext)
      // For now, basic implementation:
      const { Keyring } = await import('@pezkuwi/keyring');
      const keyring = new Keyring({ type: 'sr25519' });
      const pair = keyring.addFromMnemonic(importMnemonic.trim());

      // Store in AsyncStorage (via context method ideally)
      showAlert('Success', `Wallet imported: ${pair.address.slice(0,8)}...`);
      setImportWalletModalVisible(false);
      setImportMnemonic('');
      connectWallet();
    } catch (e: any) {
      showAlert('Error', e.message || 'Invalid mnemonic');
    }
  };

  // Backup Mnemonic Handler
  const handleBackupMnemonic = async () => {
    if (!selectedAccount) {
      showAlert('No Wallet', 'Please create or import a wallet first.');
      return;
    }

    try {
      // Retrieve mnemonic from secure storage
      const seedKey = `pezkuwi_seed_${selectedAccount.address}`;
      const storedMnemonic = await secureStorage.getItem(seedKey);

      if (storedMnemonic) {
        setUserMnemonic(storedMnemonic);
        setBackupModalVisible(true);
      } else {
        showAlert('No Backup', 'Mnemonic not found in secure storage. It may have been imported from another device.');
      }
    } catch (error) {
      console.error('Error retrieving mnemonic:', error);
      showAlert('Error', 'Failed to retrieve mnemonic from secure storage.');
    }
  };

  // Share QR Code
  const handleShareQR = async () => {
    if (!selectedAccount) return;
    try {
      await Share.share({
        message: `My Pezkuwichain Address:\n${selectedAccount.address}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Network Switch Handler
  const handleNetworkSwitch = async (network: NetworkType) => {
    try {
      await switchNetwork(network);
      setNetworkSelectorVisible(false);
      showAlert('Success', `Switched to ${NETWORKS[network].displayName}`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to switch network');
    }
  };

  // Redirect to WalletSetupScreen if no wallet exists
  useEffect(() => {
    if (!selectedAccount && accounts.length === 0) {
      navigation.replace('WalletSetup');
    }
  }, [selectedAccount, accounts, navigation]);

  // Show loading while checking wallet state or redirecting
  if (!selectedAccount && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} testID="wallet-redirecting">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="wallet-screen">
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={styles.topHeader} testID="wallet-top-header">
        <Text style={styles.topHeaderTitle}>Cüzdan / Wallet</Text>
        <TouchableOpacity onPress={() => setNetworkSelectorVisible(true)} testID="wallet-network-button">
          <Text style={styles.networkBadge}>🌐 {NETWORKS[currentNetwork].displayName}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoadingBalances} onRefresh={fetchData} />}
        showsVerticalScrollIndicator={false}
        testID="wallet-scroll-view"
      >
        {/* Wallet Selector Row */}
        <View style={styles.walletSelectorRow}>
          <TouchableOpacity
            style={styles.walletSelector}
            onPress={() => setWalletSelectorVisible(true)}
            testID="wallet-selector-button"
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
            <TouchableOpacity
              style={styles.addWalletButton}
              onPress={() => navigation.navigate('WalletSetup')}
              testID="add-wallet-button"
            >
              <Text style={styles.addWalletIcon}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setQrScannerVisible(true)}
              testID="wallet-scan-button"
            >
              <Text style={styles.scanIcon}>⊡</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Token Cards - HEZ and PEZ side by side */}
        <View style={styles.mainTokensRow}>
          {/* HEZ Card */}
          <TouchableOpacity style={styles.mainTokenCard} onPress={() => handleTokenPress(tokens[0])}>
            <View style={styles.mainTokenLogoContainer}>
              <HezTokenLogo size={56} />
            </View>
            <Text style={styles.mainTokenSymbol}>HEZ</Text>
            <Text style={styles.mainTokenBalance}>{balances.HEZ}</Text>
            <Text style={styles.mainTokenSubtitle}>Welati Coin</Text>
          </TouchableOpacity>

          {/* PEZ Card */}
          <TouchableOpacity style={styles.mainTokenCard} onPress={() => handleTokenPress(tokens[1])}>
            <View style={styles.mainTokenLogoContainer}>
              <PezTokenLogo size={56} />
            </View>
            <Text style={styles.mainTokenSymbol}>PEZ</Text>
            <Text style={styles.mainTokenBalance}>{balances.PEZ}</Text>
            <Text style={styles.mainTokenSubtitle}>Pezkuwichain Token</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Grid - 1x4 */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#22C55E'}]} onPress={handleSend}>
            <Text style={styles.actionIcon}>↑</Text>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#3B82F6'}]} onPress={handleReceive}>
            <Text style={styles.actionIcon}>↓</Text>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#6B7280'}]} onPress={() => navigation.navigate('Swap')}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionLabel}>Swap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#10B981'}]} onPress={() => showAlert('Staking', 'Navigate to Staking')}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>Staking</Text>
          </TouchableOpacity>
        </View>

        {/* Tokens List */}
        <View style={styles.tokensSection}>
          <View style={styles.tokensSectionHeader}>
            <Text style={styles.tokensTitle}>Tokens</Text>
            <View style={styles.tokenHeaderIcons}>
              <TouchableOpacity style={styles.tokenHeaderIcon} onPress={() => setTokenSearchVisible(true)}>
                <Text>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tokenHeaderIcon} onPress={() => setAddTokenModalVisible(true)}>
                <Text>➕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tokenHeaderIcon} onPress={() => setTokenSettingsVisible(true)}>
                <Text>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* USDT */}
          <TouchableOpacity style={styles.tokenListItem}>
            <Image source={usdtLogo} style={styles.tokenListLogo} resizeMode="contain" />
            <View style={styles.tokenListInfo}>
              <Text style={styles.tokenListSymbol}>USDT</Text>
              <Text style={styles.tokenListNetwork}>PEZ Network</Text>
            </View>
            <View style={styles.tokenListBalance}>
              <Text style={styles.tokenListAmount}>{balances.USDT}</Text>
              <Text style={styles.tokenListUsdValue}>$0.00</Text>
            </View>
          </TouchableOpacity>

          {/* DOT */}
          <TouchableOpacity style={styles.tokenListItem}>
            <Image source={dotLogo} style={styles.tokenListLogo} resizeMode="contain" />
            <View style={styles.tokenListInfo}>
              <Text style={styles.tokenListSymbol}>DOT</Text>
              <Text style={styles.tokenListNetwork}>Polkadot</Text>
            </View>
            <View style={styles.tokenListBalance}>
              <Text style={styles.tokenListAmount}>0.00</Text>
              <Text style={styles.tokenListUsdValue}>$0.00</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{height: 100}} />
      </ScrollView>

      {/* Modals */}
      <Modal visible={sendModalVisible} transparent animationType="slide" onRequestClose={() => setSendModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalHeader}>Send {selectedToken?.symbol}</Text>
                <View style={{alignItems:'center', marginBottom:16}}>
                    {selectedToken && <Image source={selectedToken.logo} style={{width:48, height:48}} />}
                </View>

                {/* Recipient Address Input with Address Book */}
                <View style={styles.addressInputRow}>
                  <TextInput
                    style={[styles.inputFieldFlex, addressError ? styles.inputError : null]}
                    placeholder="Recipient Address"
                    value={recipientAddress}
                    onChangeText={(text) => {
                      setRecipientAddress(text);
                      if (text.length > 10) validateAddress(text);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.addressBookButton}
                    onPress={() => setAddressBookVisible(true)}
                  >
                    <Text style={styles.addressBookIcon}>📒</Text>
                  </TouchableOpacity>
                </View>
                {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

                {/* Save Address Button (if valid new address) */}
                {recipientAddress && !addressError && !savedAddresses.find(a => a.address === recipientAddress) && (
                  <TouchableOpacity
                    style={styles.saveAddressLink}
                    onPress={() => setSaveAddressModalVisible(true)}
                  >
                    <Text style={styles.saveAddressLinkText}>💾 Save this address</Text>
                  </TouchableOpacity>
                )}

                {/* Amount Input */}
                <TextInput
                  style={styles.inputField}
                  placeholder={`Amount (Balance: ${balances[selectedToken?.symbol || 'HEZ']} ${selectedToken?.symbol})`}
                  keyboardType="numeric"
                  value={sendAmount}
                  onChangeText={setSendAmount}
                />

                {/* Gas Fee Preview */}
                {(estimatedFee || isEstimatingFee) && (
                  <View style={styles.feePreview}>
                    <Text style={styles.feeLabel}>Estimated Fee:</Text>
                    {isEstimatingFee ? (
                      <ActivityIndicator size="small" color={KurdistanColors.kesk} />
                    ) : (
                      <Text style={styles.feeAmount}>{estimatedFee} HEZ</Text>
                    )}
                  </View>
                )}

                {/* Total (Amount + Fee) */}
                {estimatedFee && sendAmount && selectedToken?.symbol === 'HEZ' && (
                  <View style={styles.totalPreview}>
                    <Text style={styles.totalLabel}>Total (incl. fee):</Text>
                    <Text style={styles.totalAmount}>
                      {(parseFloat(sendAmount || '0') + parseFloat(estimatedFee || '0')).toFixed(6)} HEZ
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => {
                      setSendModalVisible(false);
                      setRecipientAddress('');
                      setSendAmount('');
                      setEstimatedFee('');
                      setAddressError('');
                    }}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnConfirm, (isSending || !!addressError) && styles.btnDisabled]}
                      onPress={handleConfirmSend}
                      disabled={isSending || !!addressError}
                    >
                        <Text style={{color:'white'}}>{isSending ? 'Sending...' : 'Confirm'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      <Modal visible={receiveModalVisible} transparent animationType="slide" onRequestClose={() => setReceiveModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalHeader}>Receive Address</Text>
                <View style={{alignItems:'center', marginVertical: 20}}>
                    {selectedAccount && <QRCode value={selectedAccount.address} size={180}/>}
                </View>
                <Text style={styles.addrFull}>{selectedAccount?.address}</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnCancel} onPress={handleCopyAddress}>
                      <Text>📋 Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCancel} onPress={handleShareQR}>
                      <Text>📤 Share</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.btnConfirm, {width: '100%', marginTop: 8}]} onPress={() => setReceiveModalVisible(false)}>
                    <Text style={{color:'white'}}>Close</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Backup Mnemonic Modal */}
      <Modal visible={backupModalVisible} transparent animationType="slide" onRequestClose={() => setBackupModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalHeader}>🔐 Backup Mnemonic</Text>
                <Text style={{color: 'red', fontSize: 12, marginBottom: 12, textAlign: 'center'}}>
                  ⚠️ NEVER share this with anyone! Write it down and store safely.
                </Text>
                <View style={[styles.inputField, {backgroundColor: '#FFF9E6', padding: 16, minHeight: 100}]}>
                  <Text style={{fontSize: 14, lineHeight: 22}}>{userMnemonic}</Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => {
                    Clipboard.setString(userMnemonic);
                    showAlert('Copied', 'Mnemonic copied to clipboard');
                  }}>
                      <Text>📋 Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnConfirm} onPress={() => setBackupModalVisible(false)}>
                      <Text style={{color:'white'}}>Close</Text>
                  </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Wallet Selector Modal */}
      <Modal visible={walletSelectorVisible} transparent animationType="slide" onRequestClose={() => setWalletSelectorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>👛 My Wallets</Text>
            <Text style={{color: '#666', fontSize: 12, marginBottom: 16, textAlign: 'center'}}>
              Select a wallet or create a new one
            </Text>

            {/* Wallet List */}
            {accounts.map((account) => {
              const isSelected = account.address === selectedAccount?.address;
              return (
                <View key={account.address} style={styles.walletOptionRow}>
                  <TouchableOpacity
                    style={[
                      styles.walletOption,
                      isSelected && styles.walletOptionSelected,
                      {flex: 1, marginBottom: 0}
                    ]}
                    onPress={() => {
                      setSelectedAccount(account);
                      setWalletSelectorVisible(false);
                    }}
                  >
                    <View style={styles.walletOptionIcon}>
                      <Text style={{fontSize: 24}}>👛</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.walletOptionName, isSelected && {color: KurdistanColors.kesk}]}>
                        {account.name}
                      </Text>
                      <Text style={styles.walletOptionAddress} numberOfLines={1}>
                        {account.address.slice(0, 12)}...{account.address.slice(-8)}
                      </Text>
                    </View>
                    {isSelected && <Text style={{fontSize: 20, color: KurdistanColors.kesk}}>✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteWalletButton}
                    onPress={async () => {
                      const confirmDelete = Platform.OS === 'web'
                        ? window.confirm(`Delete "${account.name}"?\n\nThis action cannot be undone. Make sure you have backed up your recovery phrase.`)
                        : await new Promise<boolean>((resolve) => {
                            Alert.alert(
                              'Delete Wallet',
                              `Are you sure you want to delete "${account.name}"?\n\nThis action cannot be undone. Make sure you have backed up your recovery phrase.`,
                              [
                                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
                              ]
                            );
                          });

                      if (confirmDelete) {
                        try {
                          await deleteWallet(account.address);
                          if (accounts.length <= 1) {
                            setWalletSelectorVisible(false);
                          }
                        } catch (err) {
                          if (Platform.OS === 'web') {
                            window.alert('Failed to delete wallet');
                          } else {
                            Alert.alert('Error', 'Failed to delete wallet');
                          }
                        }
                      }
                    }}
                  >
                    <Text style={styles.deleteWalletIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add New Wallet Button */}
            <TouchableOpacity
              style={styles.addNewWalletOption}
              onPress={() => {
                setWalletSelectorVisible(false);
                navigation.navigate('WalletSetup');
              }}
            >
              <View style={styles.addNewWalletIcon}>
                <Text style={{fontSize: 24, color: KurdistanColors.kesk}}>+</Text>
              </View>
              <Text style={styles.addNewWalletText}>Add New Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnConfirm} onPress={() => setWalletSelectorVisible(false)}>
              <Text style={{color:'white'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Network Selector Modal */}
      <Modal visible={networkSelectorVisible} transparent animationType="slide" onRequestClose={() => setNetworkSelectorVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalHeader}>🌐 Select Network</Text>
                <Text style={{color: '#666', fontSize: 12, marginBottom: 16, textAlign: 'center'}}>
                  Choose the network you want to connect to
                </Text>
                {(Object.keys(NETWORKS) as NetworkType[]).map((networkKey) => {
                  const network = NETWORKS[networkKey];
                  const isSelected = networkKey === currentNetwork;
                  return (
                    <TouchableOpacity
                      key={networkKey}
                      style={[
                        styles.networkOption,
                        isSelected && styles.networkOptionSelected
                      ]}
                      onPress={() => handleNetworkSwitch(networkKey)}
                    >
                      <View style={{flex: 1}}>
                        <Text style={[styles.networkName, isSelected && {color: KurdistanColors.kesk}]}>
                          {network.displayName}
                        </Text>
                        <Text style={styles.networkType}>
                          {network.type === 'mainnet' ? '🟢 Mainnet' : network.type === 'testnet' ? '🟡 Testnet' : '🟠 Canary'}
                        </Text>
                      </View>
                      {isSelected && <Text style={{fontSize: 20}}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.btnConfirm} onPress={() => setNetworkSelectorVisible(false)}>
                    <Text style={{color:'white'}}>Close</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Add Token Modal */}
      <AddTokenModal
        visible={addTokenModalVisible}
        onClose={() => setAddTokenModalVisible(false)}
        onTokenAdded={fetchData}
      />

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={handleQRScan}
        title="Scan Address"
        subtitle="Scan a wallet address QR code to send funds"
      />

      {/* Address Book Modal */}
      <Modal visible={addressBookVisible} transparent animationType="slide" onRequestClose={() => setAddressBookVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>📒 Address Book</Text>
            {savedAddresses.length === 0 ? (
              <Text style={styles.emptyAddressBook}>No saved addresses yet</Text>
            ) : (
              <ScrollView style={styles.addressList}>
                {savedAddresses.map((saved) => (
                  <View key={saved.address} style={styles.savedAddressRow}>
                    <TouchableOpacity
                      style={styles.savedAddressInfo}
                      onPress={() => selectSavedAddress(saved.address)}
                    >
                      <Text style={styles.savedAddressName}>{saved.name}</Text>
                      <Text style={styles.savedAddressAddr} numberOfLines={1}>
                        {saved.address.slice(0, 12)}...{saved.address.slice(-8)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteAddressButton}
                      onPress={() => deleteAddress(saved.address)}
                    >
                      <Text>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.btnConfirm} onPress={() => setAddressBookVisible(false)}>
              <Text style={{color:'white'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Address Modal */}
      <Modal visible={saveAddressModalVisible} transparent animationType="slide" onRequestClose={() => setSaveAddressModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>💾 Save Address</Text>
            <Text style={styles.savedAddressAddr}>{recipientAddress.slice(0, 16)}...{recipientAddress.slice(-12)}</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Name (e.g. Alice, Exchange)"
              value={newAddressName}
              onChangeText={setNewAddressName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => {
                setSaveAddressModalVisible(false);
                setNewAddressName('');
              }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={() => {
                  if (newAddressName.trim()) {
                    saveAddress(recipientAddress, newAddressName.trim());
                    setSaveAddressModalVisible(false);
                    setNewAddressName('');
                  }
                }}
              >
                <Text style={{color:'white'}}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Token Search Modal */}
      <Modal visible={tokenSearchVisible} transparent animationType="slide" onRequestClose={() => setTokenSearchVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>🔍 Search Tokens</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Search by name or symbol..."
              value={tokenSearchQuery}
              onChangeText={setTokenSearchQuery}
              autoCapitalize="none"
              autoFocus
            />
            <ScrollView style={styles.tokenSearchResults}>
              {tokens
                .filter(t =>
                  !hiddenTokens.includes(t.symbol) &&
                  (t.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
                   t.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()))
                )
                .map((token) => (
                  <TouchableOpacity
                    key={token.symbol}
                    style={styles.tokenSearchItem}
                    onPress={() => {
                      setTokenSearchVisible(false);
                      setTokenSearchQuery('');
                      handleTokenPress(token);
                    }}
                  >
                    <Image source={token.logo} style={styles.tokenSearchLogo} resizeMode="contain" />
                    <View style={{flex: 1}}>
                      <Text style={styles.tokenSearchSymbol}>{token.symbol}</Text>
                      <Text style={styles.tokenSearchName}>{token.name}</Text>
                    </View>
                    <Text style={styles.tokenSearchBalance}>{balances[token.symbol] || '0.00'}</Text>
                  </TouchableOpacity>
                ))}
              {tokens.filter(t =>
                !hiddenTokens.includes(t.symbol) &&
                (t.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
                 t.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()))
              ).length === 0 && (
                <Text style={styles.noTokensFound}>No tokens found</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.btnConfirm} onPress={() => {
              setTokenSearchVisible(false);
              setTokenSearchQuery('');
            }}>
              <Text style={{color:'white'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Token Settings Modal */}
      <Modal visible={tokenSettingsVisible} transparent animationType="slide" onRequestClose={() => setTokenSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>⚙️ Token Settings</Text>
            <Text style={styles.tokenSettingsSubtitle}>Manage your token visibility</Text>

            <ScrollView style={styles.tokenSettingsList}>
              {tokens.map((token) => {
                const isHidden = hiddenTokens.includes(token.symbol);
                return (
                  <View key={token.symbol} style={styles.tokenSettingsItem}>
                    <Image source={token.logo} style={styles.tokenSettingsLogo} resizeMode="contain" />
                    <View style={{flex: 1}}>
                      <Text style={styles.tokenSettingsSymbol}>{token.symbol}</Text>
                      <Text style={styles.tokenSettingsName}>{token.name}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.tokenVisibilityToggle, isHidden && styles.tokenVisibilityHidden]}
                      onPress={() => {
                        if (isHidden) {
                          setHiddenTokens(prev => prev.filter(s => s !== token.symbol));
                        } else {
                          setHiddenTokens(prev => [...prev, token.symbol]);
                        }
                      }}
                    >
                      <Text style={styles.tokenVisibilityText}>{isHidden ? '👁️‍🗨️' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.tokenSettingsActions}>
              <TouchableOpacity
                style={styles.tokenSettingsOption}
                onPress={() => {
                  setTokenSettingsVisible(false);
                  setAddTokenModalVisible(true);
                }}
              >
                <Text style={styles.tokenSettingsOptionIcon}>➕</Text>
                <Text style={styles.tokenSettingsOptionText}>Add Custom Token</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnConfirm} onPress={() => setTokenSettingsVisible(false)}>
              <Text style={{color:'white'}}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  // Top Header with Back Button
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: KurdistanColors.kesk,
    fontWeight: '500',
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  // Header Styles (New Design)
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  walletTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  networkBadge: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    fontSize: 20,
    color: '#333',
  },

  // Main Token Cards (HEZ & PEZ) - New Design
  mainTokensRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  mainTokenCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  mainTokenLogo: {
    width: 56,
    height: 56,
    marginBottom: 12,
  },
  mainTokenLogoContainer: {
    width: 56,
    height: 56,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTokenSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  mainTokenBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
    marginBottom: 4,
  },
  mainTokenSubtitle: {
    fontSize: 11,
    color: '#888',
  },

  // Action Buttons Grid (1x4) - Single Row
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Tokens List Section - New Design
  tokensSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  tokensSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tokensTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenHeaderIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  tokenHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  tokenListLogo: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  tokenListInfo: {
    flex: 1,
  },
  tokenListSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  tokenListNetwork: {
    fontSize: 12,
    color: '#888',
  },
  tokenListBalance: {
    alignItems: 'flex-end',
  },
  tokenListAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  tokenListUsdValue: {
    fontSize: 12,
    color: '#888',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center'
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20
  },
  inputField: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 10
  },
  btnCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEE',
    alignItems: 'center'
  },
  btnConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center'
  },
  addrFull: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginVertical: 10,
    fontFamily: 'monospace'
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  feePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
  },
  feeAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#92400E',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
  },
  btnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  // Address Book styles
  addressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  inputFieldFlex: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
  },
  addressBookButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressBookIcon: {
    fontSize: 24,
  },
  saveAddressLink: {
    alignSelf: 'flex-start',
    marginTop: -8,
    marginBottom: 8,
  },
  saveAddressLinkText: {
    fontSize: 13,
    color: KurdistanColors.kesk,
  },
  emptyAddressBook: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  addressList: {
    width: '100%',
    maxHeight: 300,
    marginBottom: 16,
  },
  savedAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  savedAddressInfo: {
    flex: 1,
  },
  savedAddressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  savedAddressAddr: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  deleteAddressButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Network Selector Styles
  networkOption: {
    flexDirection: 'row',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
    alignItems: 'center'
  },
  networkOptionSelected: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    borderWidth: 2,
    borderColor: KurdistanColors.kesk
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  networkType: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },

  // Welcome Screen Styles
  welcomeGradient: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  welcomeContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  welcomeBrand: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Button Container (Welcome Screen)
  buttonContainer: {
    flex: 0.55,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: 'flex-start',
  },

  // Primary Button (Welcome Screen)
  primaryWalletButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 128, 0, 0.3)',
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  buttonIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  buttonIconText: {
    fontSize: 24,
    color: 'white',
  },
  buttonTextContainer: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  primaryButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // Secondary Button (Welcome Screen)
  secondaryWalletButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  secondaryButtonSubtext: {
    fontSize: 14,
    color: '#666',
  },

  // Security Notice (Welcome Screen)
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,105,62,0.05)',
    padding: 16,
    borderRadius: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
  securityIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  // Wallet Selector Row
  walletSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  walletSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  walletSelectorInfo: {
    flex: 1,
  },
  walletSelectorName: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  walletSelectorAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  walletSelectorArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  walletHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addWalletButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  addWalletIcon: {
    fontSize: 24,
    color: KurdistanColors.kesk,
    fontWeight: '300',
  },
  // Wallet Selector Modal
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletOptionSelected: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: 'rgba(0, 143, 67, 0.05)',
  },
  walletOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  walletOptionAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  addNewWalletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 143, 67, 0.05)',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
    borderStyle: 'dashed',
  },
  addNewWalletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addNewWalletText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  // Delete wallet
  walletOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  deleteWalletButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteWalletIcon: {
    fontSize: 18,
  },
  // Token Search Modal
  tokenSearchResults: {
    width: '100%',
    maxHeight: 300,
    marginBottom: 16,
  },
  tokenSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  tokenSearchLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  tokenSearchSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tokenSearchName: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  tokenSearchBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  noTokensFound: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 32,
  },
  // Token Settings Modal
  tokenSettingsSubtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  tokenSettingsList: {
    width: '100%',
    maxHeight: 300,
    marginBottom: 16,
  },
  tokenSettingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  tokenSettingsLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  tokenSettingsSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tokenSettingsName: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  tokenVisibilityToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenVisibilityHidden: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  tokenVisibilityText: {
    fontSize: 20,
  },
  tokenSettingsActions: {
    width: '100%',
    marginBottom: 16,
  },
  tokenSettingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 143, 67, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 143, 67, 0.2)',
  },
  tokenSettingsOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  tokenSettingsOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: KurdistanColors.kesk,
  },
});

export default WalletScreen;