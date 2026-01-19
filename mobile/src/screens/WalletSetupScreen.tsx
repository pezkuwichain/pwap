import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { mnemonicGenerate, mnemonicValidate } from '@pezkuwi/util-crypto';

// Alert button type for cross-platform compatibility
interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (buttons?.[0]?.onPress) buttons[0].onPress();
  } else {
    Alert.alert(title, message, buttons);
  }
};

type SetupStep = 'choice' | 'create-show' | 'create-verify' | 'import' | 'wallet-name' | 'success';

const WalletSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { createWallet, importWallet, connectWallet, isReady } = usePezkuwi();

  const [step, setStep] = useState<SetupStep>('choice');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [walletName, setWalletName] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [verificationIndices, setVerificationIndices] = useState<number[]>([]);
  const [selectedWords, setSelectedWords] = useState<{[key: number]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [createdAddress, setCreatedAddress] = useState('');
  const [isCreateFlow, setIsCreateFlow] = useState(true);

  // Generate mnemonic when entering create flow
  const handleCreateNew = () => {
    const generatedMnemonic = mnemonicGenerate(12);
    setMnemonic(generatedMnemonic.split(' '));
    setIsCreateFlow(true);
    setStep('create-show');
  };

  // Go to import flow
  const handleImport = () => {
    setIsCreateFlow(false);
    setStep('import');
  };

  // After showing mnemonic, go to verification
  const handleMnemonicConfirmed = () => {
    // Select 3 random indices for verification
    const indices: number[] = [];
    while (indices.length < 3) {
      const randomIndex = Math.floor(Math.random() * 12);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
      }
    }
    indices.sort((a, b) => a - b);
    setVerificationIndices(indices);
    setSelectedWords({});
    setStep('create-verify');
  };

  // Verify selected words
  const handleVerifyWord = (index: number, word: string) => {
    setSelectedWords(prev => ({ ...prev, [index]: word }));
  };

  // Check if verification is complete and correct
  const isVerificationComplete = () => {
    return verificationIndices.every(idx => selectedWords[idx] === mnemonic[idx]);
  };

  // After verification, go to wallet name
  const handleVerificationComplete = () => {
    if (!isVerificationComplete()) {
      showAlert('Incorrect', 'The words you selected do not match. Please try again.');
      setSelectedWords({});
      return;
    }
    setStep('wallet-name');
  };

  // Create wallet with name
  const handleCreateWallet = async () => {
    if (!walletName.trim()) {
      showAlert('Error', 'Please enter a wallet name');
      return;
    }

    if (!isReady) {
      showAlert('Error', 'Crypto libraries are still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoading(true);
    try {
      const { address } = await createWallet(walletName.trim(), mnemonic.join(' '));
      setCreatedAddress(address);
      await connectWallet();
      setStep('success');
    } catch (error: unknown) {
      if (__DEV__) console.error('[WalletSetup] Create wallet error:', error);
      showAlert('Error', error instanceof Error ? error.message : 'Failed to create wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // Import wallet with mnemonic or dev URI (like //Alice)
  const handleImportWallet = async () => {
    const trimmedInput = importMnemonic.trim();

    // Check if it's a dev URI (starts with //)
    if (trimmedInput.startsWith('//')) {
      // Dev URI like //Alice, //Bob, etc.
      setMnemonic([trimmedInput]); // Store as single-element array to indicate URI
      setStep('wallet-name');
      return;
    }

    // Otherwise treat as mnemonic
    const words = trimmedInput.toLowerCase().split(/\s+/);

    if (words.length !== 12 && words.length !== 24) {
      showAlert('Invalid Input', 'Please enter a valid 12 or 24 word recovery phrase, or a dev URI like //Alice');
      return;
    }

    if (!mnemonicValidate(trimmedInput.toLowerCase())) {
      showAlert('Invalid Mnemonic', 'The recovery phrase is invalid. Please check and try again.');
      return;
    }

    setMnemonic(words);
    setStep('wallet-name');
  };

  // After naming imported wallet
  const handleImportComplete = async () => {
    if (!walletName.trim()) {
      showAlert('Error', 'Please enter a wallet name');
      return;
    }

    if (!isReady) {
      showAlert('Error', 'Crypto libraries are still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoading(true);
    try {
      const { address } = await importWallet(walletName.trim(), mnemonic.join(' '));
      setCreatedAddress(address);
      await connectWallet();
      setStep('success');
    } catch (error: unknown) {
      if (__DEV__) console.error('[WalletSetup] Import wallet error:', error);
      showAlert('Error', error instanceof Error ? error.message : 'Failed to import wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    // Navigate to main wallet screen
    // Using replace to prevent going back to setup
    (navigation as any).replace('Wallet');
  };

  // Go back to previous step (TODO: add back button UI)
  const _handleBack = () => {
    switch (step) {
      case 'create-show':
      case 'import':
        setStep('choice');
        break;
      case 'create-verify':
        setStep('create-show');
        break;
      case 'wallet-name':
        if (isCreateFlow) {
          setStep('create-verify');
        } else {
          setStep('import');
        }
        break;
      default:
        navigation.goBack();
    }
  };

  // Generate shuffled words for verification options
  const getShuffledOptions = (correctWord: string): string[] => {
    const allWords = [...mnemonic];
    const options = [correctWord];

    while (options.length < 4) {
      const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
      if (!options.includes(randomWord)) {
        options.push(randomWord);
      }
    }

    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderChoiceStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-choice">
      <View style={styles.iconContainer}>
        <Text style={styles.mainIcon}>👛</Text>
      </View>

      <Text style={styles.title}>Set Up Your Wallet</Text>
      <Text style={styles.subtitle}>
        Create a new wallet or import an existing one using your recovery phrase
      </Text>

      <View style={styles.choiceButtons}>
        <TouchableOpacity
          style={styles.choiceButton}
          onPress={handleCreateNew}
          testID="wallet-setup-create-button"
        >
          <LinearGradient
            colors={[KurdistanColors.kesk, '#008f43']}
            style={styles.choiceButtonGradient}
          >
            <Text style={styles.choiceButtonIcon}>✨</Text>
            <Text style={styles.choiceButtonTitle}>Create New Wallet</Text>
            <Text style={styles.choiceButtonSubtitle}>
              Generate a new recovery phrase
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choiceButton}
          onPress={handleImport}
          testID="wallet-setup-import-button"
        >
          <View style={styles.choiceButtonOutline}>
            <Text style={styles.choiceButtonIcon}>📥</Text>
            <Text style={[styles.choiceButtonTitle, { color: KurdistanColors.reş }]}>
              Import Existing Wallet
            </Text>
            <Text style={[styles.choiceButtonSubtitle, { color: '#666' }]}>
              Use your 12 or 24 word phrase
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCreateShowStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-show-seed">
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.subtitle}>
        Write down these 12 words in order and keep them safe. This is the only way to recover your wallet.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Never share your recovery phrase with anyone. Anyone with these words can access your funds.
        </Text>
      </View>

      <View style={styles.mnemonicGrid} testID="mnemonic-grid">
        {mnemonic.map((word, index) => (
          <View key={index} style={styles.wordCard}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleMnemonicConfirmed}
        testID="wallet-setup-continue-button"
      >
        <Text style={styles.primaryButtonText}>I&apos;ve Written It Down</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCreateVerifyStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-verify-seed">
      <Text style={styles.title}>Verify Your Phrase</Text>
      <Text style={styles.subtitle}>
        Select the correct words to verify you&apos;ve saved your recovery phrase
      </Text>

      <View style={styles.verificationContainer}>
        {verificationIndices.map((wordIndex) => (
          <View key={wordIndex} style={styles.verificationItem}>
            <Text style={styles.verificationLabel}>Word #{wordIndex + 1}</Text>
            <View style={styles.verificationOptions}>
              {getShuffledOptions(mnemonic[wordIndex]).map((option, optIdx) => (
                <TouchableOpacity
                  key={optIdx}
                  style={[
                    styles.verificationOption,
                    selectedWords[wordIndex] === option && styles.verificationOptionSelected,
                    selectedWords[wordIndex] === option &&
                    selectedWords[wordIndex] === mnemonic[wordIndex] && styles.verificationOptionCorrect,
                  ]}
                  onPress={() => handleVerifyWord(wordIndex, option)}
                  testID={`verify-option-${wordIndex}-${optIdx}`}
                >
                  <Text style={[
                    styles.verificationOptionText,
                    selectedWords[wordIndex] === option && styles.verificationOptionTextSelected,
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !Object.keys(selectedWords).length && styles.primaryButtonDisabled
        ]}
        onPress={handleVerificationComplete}
        disabled={Object.keys(selectedWords).length !== 3}
        testID="wallet-setup-verify-button"
      >
        <Text style={styles.primaryButtonText}>Verify & Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderImportStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-import">
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.subtitle}>
        Enter your 12 or 24 word recovery phrase, or a dev URI like //Alice
      </Text>

      <View style={styles.importInputContainer}>
        <TextInput
          style={styles.importInput}
          placeholder="Enter recovery phrase or //Alice..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          value={importMnemonic}
          onChangeText={setImportMnemonic}
          autoCapitalize="none"
          autoCorrect={false}
          testID="wallet-import-input"
        />
        <Text style={styles.importHint}>
          Mnemonic: separate words with space | Dev URI: //Alice, //Bob, etc.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !importMnemonic.trim() && styles.primaryButtonDisabled
        ]}
        onPress={handleImportWallet}
        disabled={!importMnemonic.trim()}
        testID="wallet-import-continue-button"
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWalletNameStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-name">
      <Text style={styles.title}>Name Your Wallet</Text>
      <Text style={styles.subtitle}>
        Give your wallet a name to easily identify it
      </Text>

      <View style={styles.nameInputContainer}>
        <TextInput
          style={styles.nameInput}
          placeholder="e.g., My Main Wallet"
          placeholderTextColor="#999"
          value={walletName}
          onChangeText={setWalletName}
          autoCapitalize="words"
          maxLength={30}
          testID="wallet-name-input"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (!walletName.trim() || isLoading) && styles.primaryButtonDisabled
        ]}
        onPress={isCreateFlow ? handleCreateWallet : handleImportComplete}
        disabled={!walletName.trim() || isLoading}
        testID="wallet-setup-finish-button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {isCreateFlow ? 'Create Wallet' : 'Import Wallet'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContainer} testID="wallet-setup-success">
      <View style={styles.successIconContainer}>
        <Text style={styles.successIcon}>✅</Text>
      </View>

      <Text style={styles.title}>Wallet Created!</Text>
      <Text style={styles.subtitle}>
        Your wallet is ready to use. You can now send and receive tokens.
      </Text>

      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>Your Wallet Address</Text>
        <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
          {createdAddress}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSuccess}
        testID="wallet-setup-done-button"
      >
        <Text style={styles.primaryButtonText}>Go to Wallet</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'choice':
        return renderChoiceStep();
      case 'create-show':
        return renderCreateShowStep();
      case 'create-verify':
        return renderCreateVerifyStep();
      case 'import':
        return renderImportStep();
      case 'wallet-name':
        return renderWalletNameStep();
      case 'success':
        return renderSuccessStep();
      default:
        return renderChoiceStep();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="wallet-setup-screen">
      {/* Header */}
      {step !== 'choice' && step !== 'success' && (
        <View style={styles.header}>
          <View style={{width: 60}} />
          <View style={styles.progressContainer}>
            {['create-show', 'create-verify', 'wallet-name'].includes(step) && isCreateFlow && (
              <>
                <View style={[styles.progressDot, step === 'create-show' && styles.progressDotActive]} />
                <View style={[styles.progressDot, step === 'create-verify' && styles.progressDotActive]} />
                <View style={[styles.progressDot, step === 'wallet-name' && styles.progressDotActive]} />
              </>
            )}
            {['import', 'wallet-name'].includes(step) && !isCreateFlow && (
              <>
                <View style={[styles.progressDot, step === 'import' && styles.progressDotActive]} />
                <View style={[styles.progressDot, step === 'wallet-name' && styles.progressDotActive]} />
              </>
            )}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      )}

      {/* Close button on choice screen */}
      {step === 'choice' && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton} testID="wallet-setup-close">
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: KurdistanColors.kesk,
    fontWeight: '500',
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
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  mainIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  // Choice buttons
  choiceButtons: {
    gap: 16,
  },
  choiceButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  choiceButtonGradient: {
    padding: 24,
    alignItems: 'center',
  },
  choiceButtonOutline: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
  },
  choiceButtonIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  choiceButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  choiceButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // Warning box
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },

  // Mnemonic grid
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  wordCard: {
    width: '31%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordNumber: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
    minWidth: 20,
  },
  wordText: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },

  // Verification
  verificationContainer: {
    marginBottom: 32,
  },
  verificationItem: {
    marginBottom: 24,
  },
  verificationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  verificationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  verificationOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  verificationOptionSelected: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
  },
  verificationOptionCorrect: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: 'rgba(0, 143, 67, 0.15)',
  },
  verificationOptionText: {
    fontSize: 14,
    color: '#333',
  },
  verificationOptionTextSelected: {
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },

  // Import
  importInputContainer: {
    marginBottom: 32,
  },
  importInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: KurdistanColors.reş,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  importHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginLeft: 4,
  },

  // Wallet name
  nameInputContainer: {
    marginBottom: 32,
  },
  nameInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    color: KurdistanColors.reş,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'center',
  },

  // Primary button
  primaryButton: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Success
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 40,
  },
  successIcon: {
    fontSize: 80,
  },
  addressBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: KurdistanColors.reş,
  },
});

export default WalletSetupScreen;
