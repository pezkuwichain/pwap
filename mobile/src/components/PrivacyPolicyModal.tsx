import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { KurdistanColors } from '../theme/colors';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Data Minimization Principle</Text>
          <Text style={styles.paragraph}>
            Pezkuwi collects the MINIMUM data necessary to provide blockchain wallet functionality.
            We operate on a "your keys, your coins, your responsibility" model.
          </Text>

          <Text style={styles.sectionTitle}>What Data We Collect</Text>

          <Text style={styles.subsectionTitle}>Stored LOCALLY on Your Device (NOT sent to Pezkuwi servers):</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Private Keys / Seed Phrase:</Text> Encrypted and stored in device secure storage</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Account Balance:</Text> Cached from blockchain queries</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Transaction History:</Text> Cached from blockchain queries</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Settings:</Text> Language preference, theme, biometric settings</Text>
          </View>

          <Text style={styles.subsectionTitle}>Stored on Supabase (Third-party service):</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Profile Information:</Text> Username, email (if provided), avatar image</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Citizenship Applications:</Text> Application data if you apply for citizenship</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Forum Posts:</Text> Public posts and comments</Text>
          </View>

          <Text style={styles.subsectionTitle}>Stored on Blockchain (Public, immutable):</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Transactions:</Text> All transactions are publicly visible on PezkuwiChain</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Account Address:</Text> Your public address is visible to all</Text>
          </View>

          <Text style={styles.subsectionTitle}>Never Collected:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Browsing History:</Text> We don't track which screens you visit</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Device Identifiers:</Text> No IMEI, MAC address, or advertising ID collection</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Location Data:</Text> No GPS or location tracking</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Contact Lists:</Text> We don't access your contacts</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Third-party Analytics:</Text> No Google Analytics, Facebook Pixel, or similar trackers</Text>
          </View>

          <Text style={styles.sectionTitle}>Why We Need Permissions</Text>

          <Text style={styles.subsectionTitle}>Internet (REQUIRED)</Text>
          <Text style={styles.paragraph}>
            • Connect to PezkuwiChain blockchain RPC endpoint{'\n'}
            • Query balances and transaction history{'\n'}
            • Submit transactions
          </Text>

          <Text style={styles.subsectionTitle}>Storage (REQUIRED)</Text>
          <Text style={styles.paragraph}>
            • Save encrypted seed phrase locally{'\n'}
            • Cache account data for offline viewing{'\n'}
            • Store profile avatar
          </Text>

          <Text style={styles.subsectionTitle}>Camera (OPTIONAL)</Text>
          <Text style={styles.paragraph}>
            • Take profile photos{'\n'}
            • Scan QR codes for payments{'\n'}
            • Capture NFT images
          </Text>

          <Text style={styles.subsectionTitle}>Biometric (OPTIONAL)</Text>
          <Text style={styles.paragraph}>
            • Secure authentication for transactions{'\n'}
            • Protect seed phrase viewing{'\n'}
            • Alternative to password entry
          </Text>

          <Text style={styles.subsectionTitle}>Notifications (OPTIONAL)</Text>
          <Text style={styles.paragraph}>
            • Alert you to incoming transfers{'\n'}
            • Notify staking reward claims{'\n'}
            • Governance proposal notifications
          </Text>

          <Text style={styles.sectionTitle}>Zero-Knowledge Proofs & Encryption</Text>
          <Text style={styles.paragraph}>
            Citizenship applications are encrypted using ZK-proofs (Zero-Knowledge Proofs).
            This means:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Your personal data is encrypted before storage</Text>
            <Text style={styles.bulletItem}>• Only a cryptographic hash is stored on the blockchain</Text>
            <Text style={styles.bulletItem}>• Your data is uploaded to IPFS (decentralized storage) in encrypted form</Text>
            <Text style={styles.bulletItem}>• Even if someone accesses the data, they cannot decrypt it without your private key</Text>
          </View>

          <Text style={styles.sectionTitle}>Your Data Rights</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Export Data:</Text> You can export your seed phrase and account data anytime</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Delete Data:</Text> Delete your local data by uninstalling the app</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Supabase Data:</Text> Contact support@pezkuwichain.io to delete profile data</Text>
          </View>

          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.paragraph}>
            For privacy concerns: privacy@pezkuwichain.io{'\n'}
            General support: info@pezkuwichain.io
          </Text>

          <Text style={styles.footer}>
            Last updated: {new Date().toLocaleDateString()}{'\n'}
            © {new Date().getFullYear()} PezkuwiChain
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: KurdistanColors.reş,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 12,
  },
  bulletList: {
    marginBottom: 12,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 6,
  },
  bold: {
    fontWeight: '600',
  },
  footer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
});

export default PrivacyPolicyModal;
