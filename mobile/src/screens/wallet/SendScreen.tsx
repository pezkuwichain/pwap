import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { decodeAddress } from '@pezkuwi/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { QRScannerModal } from '../../components/wallet/QRScannerModal';
import { addLocalTransaction } from '../../services/TransactionHistoryService';
import { useBiometricAuth } from '../../contexts/BiometricAuthContext';

interface SavedAddress {
  address: string;
  name: string;
  lastUsed?: number;
}

type SendScreenParams = {
  Send: {
    tokenSymbol: string;
    tokenName: string;
    tokenBalance: string;
    tokenAssetId?: number;
    tokenLogo?: ImageSourcePropType;
  };
};

const ADDRESS_BOOK_KEY = '@pezkuwi_address_book';

const SendScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<SendScreenParams, 'Send'>>();
  const { api, isApiReady, selectedAccount, getKeyPair, currentNetwork } = usePezkuwi();
  const { isBiometricEnabled, authenticate } = useBiometricAuth();

  const { tokenSymbol, tokenName, tokenBalance, tokenAssetId, tokenLogo } = route.params;

  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [addressError, setAddressError] = useState('');
  const [estimatedFee, setEstimatedFee] = useState('');
  const [isEstimatingFee, setIsEstimatingFee] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const sendGuardRef = useRef(false); // Prevents double-send race condition

  // Address book
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [saveAddressName, setSaveAddressName] = useState('');
  const [showSaveAddress, setShowSaveAddress] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ADDRESS_BOOK_KEY).then(data => {
      if (data) setSavedAddresses(JSON.parse(data));
    });
  }, []);

  const validateAddress = (address: string): boolean => {
    if (!address || address.length < 10) {
      setAddressError('Address is too short');
      return false;
    }
    try {
      decodeAddress(address);
      setAddressError('');
      return true;
    } catch {
      setAddressError('Invalid address format');
      return false;
    }
  };

  // Auto estimate fee
  const estimateFee = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount || !recipientAddress || !sendAmount) return;
    if (!validateAddress(recipientAddress)) return;

    setIsEstimatingFee(true);
    try {
      const decimals = tokenSymbol === 'USDT' ? 1e6 : 1e12;
      const amountInUnits = BigInt(Math.floor(parseFloat(sendAmount) * decimals));

      let tx;
      if (tokenSymbol === 'HEZ') {
        tx = api.tx.balances.transferKeepAlive(recipientAddress, amountInUnits);
      } else if (tokenAssetId !== undefined) {
        tx = api.tx.assets.transfer(tokenAssetId, recipientAddress, amountInUnits);
      } else {
        return;
      }

      const paymentInfo = await tx.paymentInfo(selectedAccount.address);
      setEstimatedFee((Number(paymentInfo.partialFee.toString()) / 1e12).toFixed(6));
    } catch {
      setEstimatedFee('~0.001');
    } finally {
      setIsEstimatingFee(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady, selectedAccount, recipientAddress, sendAmount, tokenSymbol, tokenAssetId]);

  useEffect(() => {
    if (recipientAddress && sendAmount && parseFloat(sendAmount) > 0) {
      const timer = setTimeout(estimateFee, 500);
      return () => clearTimeout(timer);
    }
  }, [recipientAddress, sendAmount, estimateFee]);

  const handleSend = async () => {
    // Double-send guard using ref (survives re-renders)
    if (sendGuardRef.current) return;

    if (!recipientAddress || !sendAmount || !selectedAccount || !api) {
      Alert.alert('Error', 'Please enter recipient address and amount');
      return;
    }
    if (!validateAddress(recipientAddress)) {
      Alert.alert('Error', 'Invalid recipient address');
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const currentBalance = parseFloat(tokenBalance || '0');
    const feeEstimate = parseFloat(estimatedFee || '0.001');
    if (tokenSymbol === 'HEZ' && amount + feeEstimate > currentBalance) {
      Alert.alert('Error', `Insufficient balance. Need ${(amount + feeEstimate).toFixed(4)} HEZ (incl. fee)`);
      return;
    } else if (tokenSymbol !== 'HEZ' && amount > currentBalance) {
      Alert.alert('Error', `Insufficient ${tokenSymbol} balance`);
      return;
    }

    sendGuardRef.current = true;

    // Biometric auth before sending
    if (isBiometricEnabled) {
      const authResult = await authenticate();
      if (!authResult) {
        sendGuardRef.current = false;
        Alert.alert('Authentication Failed', 'Biometric authentication required to send tokens');
        return;
      }
    }

    setIsSending(true);
    try {
      const keypair = await getKeyPair(selectedAccount.address);
      if (!keypair) throw new Error('Failed to load keypair');

      const decimals = tokenSymbol === 'USDT' ? 1e6 : 1e12;
      const amountInUnits = BigInt(Math.floor(amount * decimals));

      let tx;
      if (tokenSymbol === 'HEZ') {
        tx = api.tx.balances.transferKeepAlive(recipientAddress, amountInUnits);
      } else if (tokenAssetId !== undefined) {
        tx = api.tx.assets.transfer(tokenAssetId, recipientAddress, amountInUnits);
      } else {
        throw new Error('Unknown token type');
      }

      await tx.signAndSend(keypair, ({ status }: { status: { isFinalized: boolean; asFinalized: { toHex(): string } } }) => {
        if (status.isFinalized) {
          addLocalTransaction(selectedAccount.address, currentNetwork, {
            hash: status.asFinalized.toHex(),
            blockNumber: 0,
            timestamp: Date.now(),
            type: 'transfer_out',
            section: tokenAssetId !== undefined ? 'assets' : 'balances',
            method: 'transfer',
            from: selectedAccount.address,
            to: recipientAddress,
            amount: sendAmount,
            amountRaw: String(amountInUnits),
            token: tokenSymbol,
            fee: estimatedFee || '0',
            success: true,
          }).catch(() => {});

          setIsSending(false);
          Alert.alert('Success', `Transaction finalized!\nBlock: ${status.asFinalized.toHex().slice(0, 10)}...`, [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      });
    } catch (e: unknown) {
      setIsSending(false);
      sendGuardRef.current = false;
      Alert.alert('Error', (e as Error).message);
    }
  };

  const saveAddress = async () => {
    if (!saveAddressName.trim()) return;
    const updated = [...savedAddresses, { address: recipientAddress, name: saveAddressName.trim(), lastUsed: Date.now() }];
    setSavedAddresses(updated);
    await AsyncStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(updated));
    setShowSaveAddress(false);
    setSaveAddressName('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Token Header */}
      <View style={styles.tokenHeader}>
        {tokenLogo && <Image source={tokenLogo} style={styles.tokenLogo} resizeMode="contain" accessibilityLabel={`${tokenSymbol} token logo`} />}
        <View>
          <Text style={styles.tokenTitle}>Send {tokenSymbol}</Text>
          <Text style={styles.tokenSubtitle}>Balance: {tokenBalance} {tokenSymbol}</Text>
        </View>
      </View>

      {/* Recipient */}
      <Text style={styles.label}>Recipient Address</Text>
      <View style={styles.addressRow}>
        <TextInput
          style={[styles.input, styles.addressInput, addressError ? styles.inputError : null]}
          placeholder="Enter or scan address"
          value={recipientAddress}
          onChangeText={(text) => {
            setRecipientAddress(text);
            if (text.length > 10) validateAddress(text);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Recipient wallet address"
        />
        <TouchableOpacity style={styles.iconBtn} onPress={() => setQrScannerVisible(true)} accessibilityRole="button" accessibilityLabel="Scan QR code for address">
          <Text style={styles.iconBtnText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddressBook(!showAddressBook)} accessibilityRole="button" accessibilityLabel="Open address book">
          <Text style={styles.iconBtnText}>📒</Text>
        </TouchableOpacity>
      </View>
      {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

      {/* Save address link */}
      {recipientAddress && !addressError && !savedAddresses.find(a => a.address === recipientAddress) && (
        <TouchableOpacity onPress={() => setShowSaveAddress(true)} accessibilityRole="button" accessibilityLabel="Save this address to address book">
          <Text style={styles.saveLink}>Save this address</Text>
        </TouchableOpacity>
      )}

      {/* Address Book */}
      {showAddressBook && savedAddresses.length > 0 && (
        <View style={styles.addressBookSection}>
          {savedAddresses.map((saved) => (
            <TouchableOpacity
              key={saved.address}
              style={styles.addressBookItem}
              onPress={() => {
                setRecipientAddress(saved.address);
                setShowAddressBook(false);
                validateAddress(saved.address);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select saved address ${saved.name}`}
            >
              <Text style={styles.addressBookName}>{saved.name}</Text>
              <Text style={styles.addressBookAddr}>{saved.address.slice(0, 12)}...{saved.address.slice(-6)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Save Address Inline */}
      {showSaveAddress && (
        <View style={styles.saveAddressRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Name (e.g. Alice)"
            value={saveAddressName}
            onChangeText={setSaveAddressName}
            accessibilityLabel="Name for saved address"
          />
          <TouchableOpacity style={styles.saveBtnSmall} onPress={saveAddress} accessibilityRole="button" accessibilityLabel="Save address">
            <Text style={styles.saveBtnSmallText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountRow}>
        <TextInput
          style={[styles.input, styles.amountInput]}
          placeholder="0.00"
          keyboardType="numeric"
          value={sendAmount}
          onChangeText={setSendAmount}
          accessibilityLabel={`Amount of ${tokenSymbol} to send`}
        />
        <TouchableOpacity
          style={styles.maxBtn}
          onPress={() => {
            const fee = parseFloat(estimatedFee || '0.001');
            const max = tokenSymbol === 'HEZ'
              ? Math.max(0, parseFloat(tokenBalance) - fee).toFixed(4)
              : tokenBalance;
            setSendAmount(max);
          }}
          accessibilityRole="button"
          accessibilityLabel="Set maximum amount"
        >
          <Text style={styles.maxBtnText}>MAX</Text>
        </TouchableOpacity>
      </View>

      {/* Fee */}
      {(estimatedFee || isEstimatingFee) && (
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Estimated Fee</Text>
          {isEstimatingFee ? (
            <ActivityIndicator size="small" color={KurdistanColors.kesk} />
          ) : (
            <Text style={styles.feeValue}>{estimatedFee} HEZ</Text>
          )}
        </View>
      )}

      {/* Total */}
      {estimatedFee && sendAmount && tokenSymbol === 'HEZ' && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total (incl. fee)</Text>
          <Text style={styles.totalValue}>
            {(parseFloat(sendAmount || '0') + parseFloat(estimatedFee || '0')).toFixed(6)} HEZ
          </Text>
        </View>
      )}

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendBtn, (isSending || !!addressError) && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={isSending || !!addressError}
        accessibilityRole="button"
        accessibilityLabel={`Send ${tokenSymbol}`}
      >
        {isSending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.sendBtnText}>Send {tokenSymbol}</Text>
        )}
      </TouchableOpacity>

      {/* QR Scanner */}
      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={(data) => {
          setRecipientAddress(data);
          setQrScannerVisible(false);
          validateAddress(data);
        }}
        title="Scan Address"
        subtitle="Scan a wallet address QR code"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 40 },
  tokenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  tokenLogo: { width: 48, height: 48 },
  tokenTitle: { fontSize: 22, fontWeight: '700', color: '#333' },
  tokenSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, fontSize: 16, color: '#333',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  addressRow: { flexDirection: 'row', gap: 8 },
  addressInput: { flex: 1 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  iconBtnText: { fontSize: 20 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  saveLink: { color: KurdistanColors.kesk, fontSize: 13, marginTop: 4 },
  addressBookSection: { marginTop: 8, gap: 6 },
  addressBookItem: {
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
  },
  addressBookName: { fontSize: 14, fontWeight: '600', color: '#333' },
  addressBookAddr: { fontSize: 11, color: '#999', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  saveAddressRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtnSmall: {
    backgroundColor: KurdistanColors.kesk, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center',
  },
  saveBtnSmallText: { color: '#FFF', fontWeight: '600' },
  amountRow: { flexDirection: 'row', gap: 8 },
  amountInput: { flex: 1 },
  maxBtn: {
    backgroundColor: `${KurdistanColors.kesk}15`, borderRadius: 12, paddingHorizontal: 16,
    justifyContent: 'center', borderWidth: 1, borderColor: KurdistanColors.kesk,
  },
  maxBtnText: { color: KurdistanColors.kesk, fontWeight: '700', fontSize: 13 },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, marginTop: 16,
  },
  feeLabel: { fontSize: 14, color: '#666' },
  feeValue: { fontSize: 14, fontWeight: '600', color: KurdistanColors.kesk },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginTop: 8,
  },
  totalLabel: { fontSize: 14, color: '#92400E' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  sendBtn: {
    backgroundColor: KurdistanColors.kesk, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  sendBtnDisabled: { backgroundColor: '#9CA3AF' },
  sendBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});

export default SendScreen;
