import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Share,
  Clipboard,
  Alert,
  Linking,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ visible, onClose }) => {
  const { selectedAccount, api } = usePezkuwi();
  const [copied, setCopied] = useState(false);
  const [inviteeAddress, setInviteeAddress] = useState('');

  // Generate referral link
  const referralLink = useMemo(() => {
    if (!selectedAccount?.address) return '';
    // TODO: Update with actual app deep link or web URL
    return `https://pezkuwi.net/be-citizen?ref=${selectedAccount.address}`;
  }, [selectedAccount?.address]);

  const shareText = useMemo(() => {
    return `Join me on Digital Kurdistan (PezkuwiChain)! 🏛️\n\nBecome a citizen and get your Welati Tiki NFT.\n\nUse my referral link:\n${referralLink}`;
  }, [referralLink]);

  const handleCopy = () => {
    Clipboard.setString(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Copied!', 'Referral link copied to clipboard');
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: shareText,
        title: 'Join Digital Kurdistan',
      });
    } catch (error) {
      if (__DEV__) console.error('Share error:', error);
    }
  };

  const handleSharePlatform = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(referralLink);

    const urls: Record<string, string> = {
      whatsapp: `whatsapp://send?text=${encodedText}`,
      telegram: `tg://msg?text=${encodedText}`,
      twitter: `twitter://post?message=${encodedText}`,
      email: `mailto:?subject=${encodeURIComponent('Join Digital Kurdistan')}&body=${encodedText}`,
    };

    if (urls[platform]) {
      Linking.openURL(urls[platform]).catch(() => {
        // Fallback to web URL if app not installed
        const webUrls: Record<string, string> = {
          whatsapp: `https://wa.me/?text=${encodedText}`,
          telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent('Join Digital Kurdistan! 🏛️')}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
        };
        if (webUrls[platform]) {
          Linking.openURL(webUrls[platform]);
        }
      });
    }
  };

  const handleInitiateReferral = async () => {
    if (!api || !selectedAccount || !inviteeAddress) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }

    try {
      // TODO: Implement on-chain referral initiation
      // const tx = api.tx.referral.initiateReferral(inviteeAddress);
      // await tx.signAndSend(selectedAccount.address);
      Alert.alert('Success', 'Referral initiated successfully!');
      setInviteeAddress('');
    } catch (error) {
      if (__DEV__) console.error('Initiate referral error:', error);
      Alert.alert('Error', 'Failed to initiate referral');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Friends</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalDescription}>
              Share your referral link. When your friends complete KYC, you&apos;ll earn trust score points!
            </Text>

            {/* Referral Link */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Referral Link</Text>
              <View style={styles.linkContainer}>
                <TextInput
                  style={styles.linkInput}
                  value={referralLink}
                  editable={false}
                  multiline
                />
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyButtonIcon}>{copied ? '✓' : '📋'}</Text>
                <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>
                Anyone who signs up with this link will be counted as your referral
              </Text>
            </View>

            {/* Share Options */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Share via</Text>
              <View style={styles.shareGrid}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleNativeShare}
                >
                  <Text style={styles.shareButtonIcon}>📤</Text>
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleSharePlatform('whatsapp')}
                >
                  <Text style={styles.shareButtonIcon}>💬</Text>
                  <Text style={styles.shareButtonText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleSharePlatform('telegram')}
                >
                  <Text style={styles.shareButtonIcon}>✈️</Text>
                  <Text style={styles.shareButtonText}>Telegram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleSharePlatform('twitter')}
                >
                  <Text style={styles.shareButtonIcon}>🐦</Text>
                  <Text style={styles.shareButtonText}>Twitter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleSharePlatform('email')}
                >
                  <Text style={styles.shareButtonIcon}>📧</Text>
                  <Text style={styles.shareButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Advanced: Pre-register */}
            <View style={[styles.section, styles.advancedSection]}>
              <Text style={styles.sectionLabel}>Pre-Register a Friend (Advanced)</Text>
              <Text style={styles.hint}>
                If you know your friend&apos;s wallet address, you can pre-register them on-chain.
              </Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Friend's wallet address"
                placeholderTextColor="#999"
                value={inviteeAddress}
                onChangeText={setInviteeAddress}
              />
              <TouchableOpacity
                style={styles.initiateButton}
                onPress={handleInitiateReferral}
                disabled={!inviteeAddress}
              >
                <Text style={styles.initiateButtonText}>Initiate Referral</Text>
              </TouchableOpacity>
            </View>

            {/* Rewards Info */}
            <View style={styles.rewardsSection}>
              <Text style={styles.rewardsSectionTitle}>Referral Rewards</Text>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardText}>• 1-10 referrals: 10 points each (up to 100)</Text>
              </View>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardText}>• 11-50 referrals: 5 points each (up to 300)</Text>
              </View>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardText}>• 51-100 referrals: 4 points each (up to 500)</Text>
              </View>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardText}>• Maximum: 500 trust score points</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  linkContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  linkInput: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  copyButtonIcon: {
    fontSize: 16,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 4,
  },
  shareButtonIcon: {
    fontSize: 24,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  advancedSection: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  addressInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  initiateButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  initiateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rewardsSection: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  rewardsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.kesk,
    marginBottom: 12,
  },
  rewardRow: {
    marginBottom: 6,
  },
  rewardText: {
    fontSize: 12,
    color: '#666',
  },
  doneButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
