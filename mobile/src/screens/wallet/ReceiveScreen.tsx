import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

const ReceiveScreen: React.FC = () => {
  const { selectedAccount } = usePezkuwi();

  if (!selectedAccount) {
    return (
      <View style={styles.container}>
        <Text style={styles.noWallet}>No wallet connected</Text>
      </View>
    );
  }

  const handleCopy = () => {
    Clipboard.setString(selectedAccount.address);
    if (Platform.OS === 'web') {
      window.alert('Address copied!');
    } else {
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My Pezkuwi address: ${selectedAccount.address}`,
        title: 'Pezkuwi Wallet Address',
      });
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Receive</Text>
        <Text style={styles.subtitle}>
          Share your address or QR code to receive tokens
        </Text>

        {/* QR Code */}
        <View style={styles.qrContainer} accessibilityLabel="QR code for your wallet address">
          <QRCode
            value={selectedAccount.address}
            size={200}
            backgroundColor="#FFFFFF"
            color="#000000"
          />
        </View>

        {/* Account Name */}
        <Text style={styles.accountName}>{selectedAccount.name}</Text>

        {/* Address */}
        <View style={styles.addressContainer}>
          <Text style={styles.address} selectable>
            {selectedAccount.address}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Copy wallet address to clipboard">
            <Text style={styles.copyBtnText}>Copy Address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share wallet address">
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Warning */}
      <View style={styles.warning}>
        <Text style={styles.warningText}>
          Only send Pezkuwi (HEZ/PEZ) and supported tokens to this address. Sending unsupported tokens may result in permanent loss.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  noWallet: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 60,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    marginBottom: 20,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    color: KurdistanColors.kesk,
    marginBottom: 8,
  },
  addressContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  address: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  copyBtn: {
    flex: 1,
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    marginTop: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default ReceiveScreen;
