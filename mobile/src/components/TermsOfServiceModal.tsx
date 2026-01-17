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

interface TermsOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using the Pezkuwi mobile application (&quot;App&quot;), you agree to be bound by these
            Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the App.
          </Text>

          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            Pezkuwi is a non-custodial blockchain wallet and governance platform that allows users to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Manage blockchain accounts and private keys</Text>
            <Text style={styles.bulletItem}>• Send and receive cryptocurrency tokens</Text>
            <Text style={styles.bulletItem}>• Participate in decentralized governance</Text>
            <Text style={styles.bulletItem}>• Apply for digital citizenship</Text>
            <Text style={styles.bulletItem}>• Access educational content and earn rewards</Text>
          </View>

          <Text style={styles.sectionTitle}>3. User Responsibilities</Text>

          <Text style={styles.subsectionTitle}>3.1 Account Security</Text>
          <Text style={styles.paragraph}>
            You are solely responsible for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Maintaining the confidentiality of your seed phrase and private keys</Text>
            <Text style={styles.bulletItem}>• All activities that occur under your account</Text>
            <Text style={styles.bulletItem}>• Securing your device with appropriate passcodes and biometric authentication</Text>
          </View>

          <Text style={styles.subsectionTitle}>3.2 Prohibited Activities</Text>
          <Text style={styles.paragraph}>
            You agree NOT to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Use the App for any illegal or unauthorized purpose</Text>
            <Text style={styles.bulletItem}>• Attempt to gain unauthorized access to other users&apos; accounts</Text>
            <Text style={styles.bulletItem}>• Interfere with or disrupt the App or servers</Text>
            <Text style={styles.bulletItem}>• Upload malicious code or viruses</Text>
            <Text style={styles.bulletItem}>• Engage in fraudulent transactions or money laundering</Text>
            <Text style={styles.bulletItem}>• Create fake identities or impersonate others</Text>
          </View>

          <Text style={styles.sectionTitle}>4. Non-Custodial Nature</Text>
          <Text style={styles.paragraph}>
            Pezkuwi is a non-custodial wallet. This means:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• We DO NOT have access to your private keys or funds</Text>
            <Text style={styles.bulletItem}>• We CANNOT recover your funds if you lose your seed phrase</Text>
            <Text style={styles.bulletItem}>• We CANNOT reverse transactions or freeze accounts</Text>
            <Text style={styles.bulletItem}>• You have full control and full responsibility for your assets</Text>
          </View>

          <Text style={styles.sectionTitle}>5. Blockchain Transactions</Text>
          <Text style={styles.paragraph}>
            When you submit a transaction:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Transactions are irreversible once confirmed on the blockchain</Text>
            <Text style={styles.bulletItem}>• Transaction fees (gas) are determined by network demand</Text>
            <Text style={styles.bulletItem}>• We are not responsible for transaction failures due to insufficient fees</Text>
            <Text style={styles.bulletItem}>• You acknowledge the risks of blockchain technology</Text>
          </View>

          <Text style={styles.sectionTitle}>6. Digital Citizenship</Text>
          <Text style={styles.paragraph}>
            Citizenship applications:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Require KYC (Know Your Customer) verification</Text>
            <Text style={styles.bulletItem}>• Are subject to approval by governance mechanisms</Text>
            <Text style={styles.bulletItem}>• Involve storing encrypted personal data on IPFS</Text>
            <Text style={styles.bulletItem}>• Can be revoked if fraudulent information is detected</Text>
          </View>

          <Text style={styles.sectionTitle}>7. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            THE APP IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Uninterrupted or error-free service</Text>
            <Text style={styles.bulletItem}>• Accuracy of displayed data or prices</Text>
            <Text style={styles.bulletItem}>• Security from unauthorized access or hacking</Text>
            <Text style={styles.bulletItem}>• Protection from loss of funds due to user error</Text>
          </View>

          <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PEZKUWI SHALL NOT BE LIABLE FOR:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Loss of funds due to forgotten seed phrases</Text>
            <Text style={styles.bulletItem}>• Unauthorized transactions from compromised devices</Text>
            <Text style={styles.bulletItem}>• Network congestion or blockchain failures</Text>
            <Text style={styles.bulletItem}>• Price volatility of cryptocurrencies</Text>
            <Text style={styles.bulletItem}>• Third-party services (IPFS, Supabase, RPC providers)</Text>
          </View>

          <Text style={styles.sectionTitle}>9. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The Pezkuwi App, including its design, code, and content, is protected by copyright and trademark laws.
            You may not:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Copy, modify, or distribute the App without permission</Text>
            <Text style={styles.bulletItem}>• Reverse engineer or decompile the App</Text>
            <Text style={styles.bulletItem}>• Use the Pezkuwi name or logo without authorization</Text>
          </View>

          <Text style={styles.sectionTitle}>10. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms shall be governed by the laws of decentralized autonomous organizations (DAOs)
            and international arbitration. Disputes will be resolved through community governance mechanisms
            when applicable.
          </Text>

          <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms at any time. Changes will be effective upon posting
            in the App. Your continued use of the App constitutes acceptance of modified Terms.
          </Text>

          <Text style={styles.sectionTitle}>12. Termination</Text>
          <Text style={styles.paragraph}>
            We may terminate or suspend your access to the App at any time for violations of these Terms.
            You may stop using the App at any time by deleting it from your device.
          </Text>

          <Text style={styles.sectionTitle}>13. Contact</Text>
          <Text style={styles.paragraph}>
            For questions about these Terms:{'\n'}
            Email: legal@pezkuwichain.io{'\n'}
            Support: info@pezkuwichain.io{'\n'}
            Website: https://pezkuwichain.io
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
  footer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
});

export default TermsOfServiceModal;
