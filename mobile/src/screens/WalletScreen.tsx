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
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi, NetworkType, NETWORKS } from '../contexts/PezkuwiContext';
import { AddTokenModal } from '../components/wallet/AddTokenModal';

// Token Images - From shared/images
const hezLogo = require('../../../shared/images/hez_logo.png');
const pezLogo = require('../../../shared/images/pez_logo.jpg');
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
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const {
    api,
    isApiReady,
    accounts,
    selectedAccount,
    connectWallet,
    disconnectWallet,
    createWallet,
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
  const [addTokenModalVisible, setAddTokenModalVisible] = useState(false);
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
      // 1. Fetch Balances
      const accountInfo = await api.query.system.account(selectedAccount.address);
      const hezBalance = (Number(accountInfo.data.free.toString()) / 1e12).toFixed(2);

      let pezBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          const pezAsset = await api.query.assets.account(1, selectedAccount.address);
          if (pezAsset.isSome) pezBalance = (Number(pezAsset.unwrap().balance.toString()) / 1e12).toFixed(2);
        }
      } catch {}

      let usdtBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          // Check ID 1000 first (as per constants), fallback to 2 just in case
          let usdtAsset = await api.query.assets.account(1000, selectedAccount.address);
          if (usdtAsset.isNone) {
             usdtAsset = await api.query.assets.account(2, selectedAccount.address);
          }
          
          if (usdtAsset.isSome) {
             // USDT uses 6 decimals usually, checking constants or assuming standard
             usdtBalance = (Number(usdtAsset.unwrap().balance.toString()) / 1e6).toFixed(2); 
          }
        }
      } catch {}

      setBalances({ HEZ: hezBalance, PEZ: pezBalance, USDT: usdtBalance });

      // 2. Fetch History from Indexer API (MUCH FASTER)
      setIsLoadingHistory(true);
      try {
        const INDEXER_URL = 'http://172.31.134.70:3001'; // Update this to your local IP for physical device testing
        const response = await fetch(`${INDEXER_URL}/api/history/${selectedAccount.address}`);
        const data = await response.json();
        
        const txList = data.map((tx: any) => ({
          hash: tx.hash,
          method: tx.asset_id ? 'transfer' : 'transfer',
          section: tx.asset_id ? 'assets' : 'balances',
          from: tx.sender,
          to: tx.receiver,
          amount: tx.amount,
          blockNumber: tx.block_number,
          isIncoming: tx.receiver === selectedAccount.address,
        }));
        
        setTransactions(txList);
      } catch (e) {
        console.warn('Indexer API unreachable, history not updated', e);
      }

    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoadingBalances(false);
      setIsLoadingHistory(false);
    }
  }, [api, isApiReady, selectedAccount]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const handleConfirmSend = async () => {
    if (!recipientAddress || !sendAmount || !selectedToken || !selectedAccount || !api) {
      Alert.alert('Error', 'Please enter recipient address and amount');
      return;
    }
    
    setIsSending(true);
    try {
        const keypair = await getKeyPair(selectedAccount.address);
        if (!keypair) throw new Error('Failed to load keypair');
        
        // Adjust decimals based on token
        const decimals = selectedToken.symbol === 'USDT' ? 1e6 : 1e12;
        const amountInUnits = BigInt(Math.floor(parseFloat(sendAmount) * decimals));
        
        let tx;
        if (selectedToken.symbol === 'HEZ') {
            tx = api.tx.balances.transfer(recipientAddress, amountInUnits);
        } else if (selectedToken.assetId !== undefined) {
            tx = api.tx.assets.transfer(selectedToken.assetId, recipientAddress, amountInUnits);
        } else {
            throw new Error('Unknown token type');
        }
        
        await tx.signAndSend(keypair, ({ status }) => {
            if (status.isFinalized) {
                setSendModalVisible(false);
                setIsSending(false);
                Alert.alert('Success', 'Transaction Sent!');
                fetchData(); 
            }
        });
    } catch (e: any) {
        setIsSending(false);
        Alert.alert('Error', e.message);
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
        Alert.alert('Wallet Created', `Save this mnemonic:\n${mnemonic}`, [{ text: 'OK', onPress: () => connectWallet() }]);
      } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  // Copy Address Handler
  const handleCopyAddress = () => {
    if (!selectedAccount) return;
    Clipboard.setString(selectedAccount.address);
    Alert.alert('Copied!', 'Address copied to clipboard');
  };

  // Import Wallet Handler
  const handleImportWallet = async () => {
    if (!importMnemonic.trim()) {
      Alert.alert('Error', 'Please enter a valid mnemonic');
      return;
    }
    try {
      // Use createWallet but inject mnemonic (you may need to modify PezkuwiContext)
      // For now, basic implementation:
      const { Keyring } = await import('@pezkuwi/keyring');
      const keyring = new Keyring({ type: 'sr25519' });
      const pair = keyring.addFromMnemonic(importMnemonic.trim());

      // Store in AsyncStorage (via context method ideally)
      Alert.alert('Success', `Wallet imported: ${pair.address.slice(0,8)}...`);
      setImportWalletModalVisible(false);
      setImportMnemonic('');
      connectWallet();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invalid mnemonic');
    }
  };

  // Backup Mnemonic Handler
  const handleBackupMnemonic = async () => {
    // Retrieve mnemonic from secure storage
    // For demo, we show the saved one or prompt user
    if (userMnemonic) {
      setBackupModalVisible(true);
    } else {
      Alert.alert('No Backup', 'Mnemonic not available. Create a new wallet or import existing one.');
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
      Alert.alert('Success', `Switched to ${NETWORKS[network].displayName}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to switch network');
    }
  };

  if (!selectedAccount) {
      return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
              colors={['#00693E', '#008f43', '#00A651']}
              style={styles.welcomeGradient}
            >
              <View style={styles.welcomeContent}>
                <Text style={styles.welcomeEmoji}>🔐</Text>
                <Text style={styles.welcomeTitle}>Welcome to</Text>
                <Text style={styles.welcomeBrand}>Pezkuwichain Wallet</Text>
                <Text style={styles.welcomeSubtitle}>
                  Secure, Fast & Decentralized
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryWalletButton}
                onPress={handleConnectWallet}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[KurdistanColors.kesk, '#00A651']}
                  style={styles.buttonGradient}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                >
                  <View style={styles.buttonIcon}>
                    <Text style={styles.buttonIconText}>➕</Text>
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.primaryButtonText}>Create New Wallet</Text>
                    <Text style={styles.primaryButtonSubtext}>
                      Get started in seconds
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryWalletButton}
                onPress={() => setImportWalletModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.secondaryButtonContent}>
                  <View style={[styles.buttonIcon, {backgroundColor: 'rgba(0,105,62,0.1)'}]}>
                    <Text style={[styles.buttonIconText, {color: KurdistanColors.kesk}]}>📥</Text>
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.secondaryButtonText}>Import Existing Wallet</Text>
                    <Text style={styles.secondaryButtonSubtext}>
                      Use your seed phrase
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.securityNotice}>
                <Text style={styles.securityIcon}>🛡️</Text>
                <Text style={styles.securityText}>
                  Your keys are encrypted and stored locally on your device
                </Text>
              </View>
            </View>

             {/* Create Wallet Modal */}
             <Modal visible={createWalletModalVisible} transparent animationType="slide" onRequestClose={() => setCreateWalletModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalHeader}>Create New Wallet</Text>
                        <TextInput style={styles.inputField} placeholder="Wallet Name" value={walletName} onChangeText={setWalletName} />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setCreateWalletModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.btnConfirm} onPress={handleCreateWallet}><Text style={{color:'white'}}>Create</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Import Wallet Modal */}
            <Modal visible={importWalletModalVisible} transparent animationType="slide" onRequestClose={() => setImportWalletModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalHeader}>Import Wallet</Text>
                        <Text style={{color: '#666', fontSize: 12, marginBottom: 12}}>Enter your 12 or 24 word mnemonic phrase</Text>
                        <TextInput
                          style={[styles.inputField, {height: 100, textAlignVertical: 'top'}]}
                          placeholder="word1 word2 word3..."
                          multiline
                          value={importMnemonic}
                          onChangeText={setImportMnemonic}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setImportWalletModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.btnConfirm} onPress={handleImportWallet}><Text style={{color:'white'}}>Import</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoadingBalances} onRefresh={fetchData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.walletTitle}>pezkuwi wallet</Text>
          <TouchableOpacity onPress={() => setNetworkSelectorVisible(true)}>
            <Text style={styles.networkBadge}>🌐 {NETWORKS[currentNetwork].displayName}</Text>
          </TouchableOpacity>
        </View>

        {/* Main Token Cards - HEZ and PEZ side by side */}
        <View style={styles.mainTokensRow}>
          {/* HEZ Card */}
          <TouchableOpacity style={styles.mainTokenCard} onPress={() => handleTokenPress(tokens[0])}>
            <Image source={hezLogo} style={styles.mainTokenLogo} resizeMode="contain" />
            <Text style={styles.mainTokenSymbol}>HEZ</Text>
            <Text style={styles.mainTokenBalance}>{balances.HEZ}</Text>
            <Text style={styles.mainTokenSubtitle}>Hemuwelet Token</Text>
          </TouchableOpacity>

          {/* PEZ Card */}
          <TouchableOpacity style={styles.mainTokenCard} onPress={() => handleTokenPress(tokens[1])}>
            <Image source={pezLogo} style={styles.mainTokenLogo} resizeMode="contain" />
            <Text style={styles.mainTokenSymbol}>PEZ</Text>
            <Text style={styles.mainTokenBalance}>{balances.PEZ}</Text>
            <Text style={styles.mainTokenSubtitle}>Pezkunel Token</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Grid - 2x4 */}
        <View style={styles.actionsGrid}>
          {/* Row 1 */}
          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#22C55E'}]} onPress={handleSend}>
            <Text style={styles.actionIcon}>↑</Text>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#3B82F6'}]} onPress={handleReceive}>
            <Text style={styles.actionIcon}>↓</Text>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#A855F7'}]} onPress={() => Alert.alert('Scan', 'QR Scanner coming soon')}>
            <Text style={styles.actionIcon}>⊡</Text>
            <Text style={styles.actionLabel}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#6B7280'}]} onPress={() => Alert.alert('P2P', 'Navigate to P2P Platform')}>
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>P2P</Text>
          </TouchableOpacity>

          {/* Row 2 */}
          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#EF4444'}]} onPress={() => Alert.alert('Vote', 'Navigate to Governance')}>
            <Text style={styles.actionIcon}>🗳️</Text>
            <Text style={styles.actionLabel}>Vote</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#F59E0B'}]} onPress={() => Alert.alert('Dapps', 'Navigate to Apps')}>
            <Text style={styles.actionIcon}>⊞</Text>
            <Text style={styles.actionLabel}>Dapps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#10B981'}]} onPress={() => Alert.alert('Staking', 'Navigate to Staking')}>
            <Text style={styles.actionIcon}>🥩</Text>
            <Text style={styles.actionLabel}>Staking</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#8B5CF6'}]} onPress={() => setNetworkSelectorVisible(true)}>
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionLabel}>Connect</Text>
          </TouchableOpacity>
        </View>

        {/* Tokens List */}
        <View style={styles.tokensSection}>
          <View style={styles.tokensSectionHeader}>
            <Text style={styles.tokensTitle}>Tokens</Text>
            <View style={styles.tokenHeaderIcons}>
              <TouchableOpacity style={styles.tokenHeaderIcon}>
                <Text>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tokenHeaderIcon} onPress={() => setAddTokenModalVisible(true)}>
                <Text>➕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tokenHeaderIcon} onPress={handleBackupMnemonic}>
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
                <TextInput style={styles.inputField} placeholder="Address" value={recipientAddress} onChangeText={setRecipientAddress} />
                <TextInput style={styles.inputField} placeholder="Amount" keyboardType="numeric" value={sendAmount} onChangeText={setSendAmount} />
                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => setSendModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirmSend} disabled={isSending}>
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
                    Alert.alert('Copied', 'Mnemonic copied to clipboard');
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

  // Action Buttons Grid (2x4) - New Design
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  actionButton: {
    width: '23%',
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
});

export default WalletScreen;