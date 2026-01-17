import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors } from '../theme/colors';

type ContributionType = 'zekat' | 'tax';

interface AllocationItem {
  id: string;
  nameKu: string;
  nameEn: string;
  icon: string;
  percentage: number;
}

const DEFAULT_ALLOCATIONS: AllocationItem[] = [
  { id: 'shahid', nameKu: 'Binemalin Şehîda', nameEn: 'Martyr Families', icon: '🏠', percentage: 0 },
  { id: 'education', nameKu: 'Projeyin Perwerde', nameEn: 'Education Projects', icon: '📚', percentage: 0 },
  { id: 'health', nameKu: 'Tenduristî', nameEn: 'Health Services', icon: '🏥', percentage: 0 },
  { id: 'orphans', nameKu: 'Sêwî û Feqîr', nameEn: 'Orphans & Poor', icon: '👶', percentage: 0 },
  { id: 'infrastructure', nameKu: 'Binesazî', nameEn: 'Infrastructure', icon: '🏗️', percentage: 0 },
  { id: 'defense', nameKu: 'Parastina Welat', nameEn: 'National Defense', icon: '🛡️', percentage: 0 },
  { id: 'diaspora', nameKu: 'Diaspora', nameEn: 'Diaspora Support', icon: '🌍', percentage: 0 },
  { id: 'culture', nameKu: 'Çand û Huner', nameEn: 'Culture & Arts', icon: '🎭', percentage: 0 },
];

const TaxZekatScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api, selectedAccount, getKeyPair } = usePezkuwi();

  const [contributionType, setContributionType] = useState<ContributionType>('zekat');
  const [amount, setAmount] = useState('');
  const [allocations, setAllocations] = useState<AllocationItem[]>(DEFAULT_ALLOCATIONS);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Calculate total percentage
  const totalPercentage = useMemo(() => {
    return allocations.reduce((sum, item) => sum + item.percentage, 0);
  }, [allocations]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    const amountNum = parseFloat(amount);
    return (
      amountNum > 0 &&
      totalPercentage === 100 &&
      termsAccepted &&
      selectedAccount
    );
  }, [amount, totalPercentage, termsAccepted, selectedAccount]);

  // Update allocation percentage
  const updateAllocation = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.min(100, Math.max(0, numValue));

    setAllocations(prev =>
      prev.map(item =>
        item.id === id ? { ...item, percentage: clampedValue } : item
      )
    );
  };

  // Calculate HEZ amount for each allocation
  const calculateAllocationAmount = (percentage: number): string => {
    const amountNum = parseFloat(amount) || 0;
    return ((amountNum * percentage) / 100).toFixed(2);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isFormValid) {
      if (totalPercentage !== 100) {
        Alert.alert('Şaşî / Error', 'Dabeşkirin divê %100 be / Allocation must equal 100%');
      } else if (!termsAccepted) {
        Alert.alert('Şaşî / Error', 'Divê hûn şertnameyê qebûl bikin / You must accept the terms');
      }
      return;
    }
    setShowConfirmModal(true);
  };

  // Confirm and send transaction to Treasury
  const confirmAndSend = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      if (!api || !selectedAccount) {
        throw new Error('Wallet not connected');
      }

      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        throw new Error('Could not retrieve key pair');
      }

      // Prepare allocation data as remark
      const allocationData = allocations
        .filter(a => a.percentage > 0)
        .map(a => `${a.id}:${a.percentage}`)
        .join(',');

      // Create remark message with contribution details
      const remarkMessage = JSON.stringify({
        type: contributionType,
        allocations: allocationData,
        timestamp: Date.now(),
      });

      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 1e12)); // Convert to smallest unit (12 decimals for HEZ)

      // Get treasury account address
      // Treasury account is derived from pallet ID "py/trsry" (standard Substrate treasury)
      const treasuryAccount = api.consts.treasury?.palletId
        ? api.registry.createType('AccountId', api.consts.treasury.palletId.toU8a())
        : null;

      if (!treasuryAccount) {
        throw new Error('Treasury account not found');
      }

      if (__DEV__) {
        console.log('[TaxZekat] Treasury account:', treasuryAccount.toString());
        console.log('[TaxZekat] Amount:', amountInUnits.toString());
        console.log('[TaxZekat] Remark:', remarkMessage);
      }

      // Batch: Transfer to treasury + Remark with allocation data
      const txs = [
        api.tx.balances.transferKeepAlive(treasuryAccount, amountInUnits.toString()),
        api.tx.system.remark(remarkMessage),
      ];

      // Submit batch transaction
      await new Promise<void>((resolve, reject) => {
        api.tx.utility
          .batch(txs)
          .signAndSend(keyPair, { nonce: -1 }, ({ status, dispatchError }) => {
            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) {
                let errorMessage = 'Transaction failed';
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorMessage = `${decoded.section}.${decoded.name}`;
                }
                reject(new Error(errorMessage));
                return;
              }
              resolve();
            }
          })
          .catch(reject);
      });

      Alert.alert(
        'Serketî / Success',
        `${contributionType === 'zekat' ? 'Zekat' : 'Bac'} bi serkeftî hat şandin!\n\nMiqdar: ${amount} HEZ\n\nSpas ji bo beşdariya we!\nThank you for your contribution!`,
        [{ text: 'Temam / OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert(
        'Şaşî / Error',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render allocation item
  const renderAllocationItem = (item: AllocationItem) => (
    <View key={item.id} style={styles.allocationItem}>
      <View style={styles.allocationInfo}>
        <Text style={styles.allocationIcon}>{item.icon}</Text>
        <View style={styles.allocationText}>
          <Text style={styles.allocationName}>{item.nameKu}</Text>
          <Text style={styles.allocationNameEn}>{item.nameEn}</Text>
        </View>
      </View>
      <View style={styles.allocationInput}>
        <TextInput
          style={styles.percentageInput}
          value={item.percentage > 0 ? String(item.percentage) : ''}
          onChangeText={(value) => updateAllocation(item.id, value)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#999"
          maxLength={3}
        />
        <Text style={styles.percentSign}>%</Text>
      </View>
      {item.percentage > 0 && parseFloat(amount) > 0 && (
        <Text style={styles.allocationHez}>
          {calculateAllocationAmount(item.percentage)} HEZ
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Description */}
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>
            Beşdariya xwe ya bi dilxwazî ji Komara Dijitaliya Kurdistanê re bişînin.
          </Text>
          <Text style={styles.descriptionTextEn}>
            Send your voluntary contribution to the Digital Kurdistan Republic.
          </Text>
        </View>

        {/* Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cureyê Beşdariyê / Contribution Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                contributionType === 'zekat' && styles.typeButtonActive,
              ]}
              onPress={() => setContributionType('zekat')}
            >
              <Text style={styles.typeIcon}>☪️</Text>
              <Text style={[
                styles.typeText,
                contributionType === 'zekat' && styles.typeTextActive,
              ]}>
                Zekat
              </Text>
              <Text style={[
                styles.typeSubtext,
                contributionType === 'zekat' && styles.typeSubtextActive,
              ]}>
                İslami Zekat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                contributionType === 'tax' && styles.typeButtonActive,
              ]}
              onPress={() => setContributionType('tax')}
            >
              <Text style={styles.typeIcon}>📜</Text>
              <Text style={[
                styles.typeText,
                contributionType === 'tax' && styles.typeTextActive,
              ]}>
                Bac
              </Text>
              <Text style={[
                styles.typeSubtext,
                contributionType === 'tax' && styles.typeSubtextActive,
              ]}>
                Vergi / Tax
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Miqdar / Amount</Text>
          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#999"
            />
            <Text style={styles.amountCurrency}>HEZ</Text>
          </View>
          {selectedAccount && (
            <Text style={styles.balanceText}>
              Bakiye / Balance: -- HEZ
            </Text>
          )}
        </View>

        {/* Allocation Section */}
        <View style={styles.section}>
          <View style={styles.allocationHeader}>
            <Text style={styles.sectionTitle}>Dabeşkirina Fonê / Fund Allocation</Text>
            <View style={[
              styles.totalBadge,
              totalPercentage === 100 && styles.totalBadgeValid,
              totalPercentage > 100 && styles.totalBadgeInvalid,
            ]}>
              <Text style={[
                styles.totalText,
                totalPercentage === 100 && styles.totalTextValid,
                totalPercentage > 100 && styles.totalTextInvalid,
              ]}>
                {totalPercentage}%
              </Text>
            </View>
          </View>
          <Text style={styles.allocationHint}>
            Divê bêkêmasî %100 be / Must equal exactly 100%
          </Text>

          <View style={styles.allocationList}>
            {allocations.map(renderAllocationItem)}
          </View>
        </View>

        {/* Terms Section */}
        <View style={styles.termsSection}>
          <View style={[
            styles.termsBox,
            contributionType === 'zekat' ? styles.termsBoxZekat : styles.termsBoxTax,
          ]}>
            <Text style={styles.termsIcon}>
              {contributionType === 'zekat' ? '☪️' : '📜'}
            </Text>
            <Text style={styles.termsTitle}>SOZNAME / COMMITMENT</Text>

            {contributionType === 'zekat' ? (
              <>
                <Text style={styles.termsText}>
                  Komara Dijitaliya Kurdistanê (Dijital Kurdistan Devleti), İslami usul ve kurallara uygun olarak, zekat gönderimlerinizi TAM OLARAK sizin belirlediğiniz oranlara göre sarfedeceğini TAAHHÜT EDER.
                </Text>
                <Text style={styles.termsText}>
                  Zekat fonları yalnızca Kuran'da belirtilen 8 sınıfa (Tevbe 9:60) harcanacaktır: Fakirler, Miskinler, Zekat memurları, Müellefe-i kulub, Köleler, Borçlular, Fi sebilillah, İbn-i sebil.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.termsText}>
                  Komara Dijitaliya Kurdistanê (Dijital Kurdistan Devleti), vergi katkılarınızı belirlediğiniz oranlara MÜMKÜN OLDUĞU KADAR uygun şekilde kullanacağını taahhüt eder.
                </Text>
                <Text style={styles.termsText}>
                  Acil durumlar veya zorunlu hallerde, devlet küçük inisiyatifler kullanabilir. Tüm harcamalar blockchain üzerinde şeffaf olarak kaydedilecektir.
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setTermsAccepted(!termsAccepted)}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              Okudum ve kabul ediyorum / I have read and accept
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !isFormValid && styles.submitButtonDisabled,
            contributionType === 'zekat' ? styles.submitButtonZekat : styles.submitButtonTax,
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {contributionType === 'zekat' ? '☪️ ZEKAT BIŞÎNE' : '📤 BAC BIŞÎNE'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Piştrast bike / Confirm</Text>

            <View style={styles.modalSummary}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Cure / Type:</Text>
                <Text style={styles.modalValue}>
                  {contributionType === 'zekat' ? 'Zekat' : 'Bac / Tax'}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Miqdar / Amount:</Text>
                <Text style={styles.modalValue}>{amount} HEZ</Text>
              </View>

              <Text style={styles.modalSectionTitle}>Dabeşkirin / Allocation:</Text>
              {allocations
                .filter(a => a.percentage > 0)
                .map(a => (
                  <View key={a.id} style={styles.modalAllocation}>
                    <Text style={styles.modalAllocationText}>
                      {a.icon} {a.nameKu}
                    </Text>
                    <Text style={styles.modalAllocationValue}>
                      {calculateAllocationAmount(a.percentage)} HEZ ({a.percentage}%)
                    </Text>
                  </View>
                ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelText}>Betal / Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  contributionType === 'zekat' ? styles.submitButtonZekat : styles.submitButtonTax,
                ]}
                onPress={confirmAndSend}
              >
                <Text style={styles.modalConfirmText}>✓ Piştrast</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  descriptionBox: {
    backgroundColor: `${KurdistanColors.kesk}15`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: KurdistanColors.kesk,
  },
  descriptionText: {
    fontSize: 14,
    color: KurdistanColors.reş,
    lineHeight: 20,
    marginBottom: 8,
  },
  descriptionTextEn: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: `${KurdistanColors.kesk}10`,
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  typeTextActive: {
    color: KurdistanColors.kesk,
  },
  typeSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  typeSubtextActive: {
    color: KurdistanColors.kesk,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    padding: 16,
    color: KurdistanColors.reş,
  },
  amountCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: KurdistanColors.kesk,
    paddingRight: 16,
  },
  balanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  totalBadgeValid: {
    backgroundColor: `${KurdistanColors.kesk}20`,
  },
  totalBadgeInvalid: {
    backgroundColor: `${KurdistanColors.sor}20`,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  totalTextValid: {
    color: KurdistanColors.kesk,
  },
  totalTextInvalid: {
    color: KurdistanColors.sor,
  },
  allocationHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  allocationList: {
    gap: 12,
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
  },
  allocationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  allocationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  allocationText: {
    flex: 1,
  },
  allocationName: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  allocationNameEn: {
    fontSize: 11,
    color: '#666',
  },
  allocationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 8,
  },
  percentageInput: {
    width: 40,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
    color: KurdistanColors.reş,
  },
  percentSign: {
    fontSize: 14,
    color: '#666',
  },
  allocationHez: {
    fontSize: 11,
    color: KurdistanColors.kesk,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 60,
    textAlign: 'right',
  },
  termsSection: {
    marginBottom: 16,
  },
  termsBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  termsBoxZekat: {
    backgroundColor: `${KurdistanColors.kesk}10`,
    borderWidth: 1,
    borderColor: `${KurdistanColors.kesk}30`,
  },
  termsBoxTax: {
    backgroundColor: `${KurdistanColors.zer}15`,
    borderWidth: 1,
    borderColor: `${KurdistanColors.zer}40`,
  },
  termsIcon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 12,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'justify',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: KurdistanColors.kesk,
  },
  checkmark: {
    color: KurdistanColors.spi,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: KurdistanColors.reş,
  },
  submitButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  submitButtonZekat: {
    backgroundColor: KurdistanColors.kesk,
  },
  submitButtonTax: {
    backgroundColor: '#D4A017',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginTop: 8,
    marginBottom: 12,
  },
  modalAllocation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalAllocationText: {
    fontSize: 13,
    color: '#444',
  },
  modalAllocationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
});

export default TaxZekatScreen;
