import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

interface AddTokenModalProps {
  visible: boolean;
  onClose: () => void;
  onTokenAdded?: () => void;
}

export const AddTokenModal: React.FC<AddTokenModalProps> = ({
  visible,
  onClose,
  onTokenAdded,
}) => {
  const { api, isApiReady } = usePezkuwi();
  const [assetId, setAssetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<{
    symbol: string;
    decimals: number;
    name?: string;
  } | null>(null);

  const handleFetchMetadata = async () => {
    if (!api || !isApiReady) {
      Alert.alert('Error', 'API not ready');
      return;
    }

    if (!assetId || isNaN(Number(assetId))) {
      Alert.alert('Error', 'Please enter a valid asset ID');
      return;
    }

    setIsLoading(true);
    try {
      const assetIdNum = Number(assetId);

      // Fetch asset metadata
      const metadataOption = await api.query.assets.metadata(assetIdNum);

      if (metadataOption.isEmpty) {
        Alert.alert('Error', 'Asset not found');
        setTokenMetadata(null);
      } else {
        const metadata = metadataOption.toJSON() as { symbol?: string; decimals?: number; name?: string } | null;
        setTokenMetadata({
          symbol: metadata.symbol || 'UNKNOWN',
          decimals: metadata.decimals || 12,
          name: metadata.name || 'Unknown Token',
        });
      }
    } catch {
      console.error('Failed to fetch token metadata');
      Alert.alert('Error', 'Failed to fetch token metadata');
      setTokenMetadata(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToken = () => {
    if (!tokenMetadata) {
      Alert.alert('Error', 'Please fetch token metadata first');
      return;
    }

    // Store the custom token in AsyncStorage or app state
    // For now, just show success and call the callback
    Alert.alert(
      'Success',
      `Token ${tokenMetadata.symbol} (ID: ${assetId}) added to your wallet!`,
      [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            if (onTokenAdded) onTokenAdded();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setAssetId('');
    setTokenMetadata(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalHeader}>Add Custom Token</Text>

          <Text style={styles.instructions}>
            Enter the asset ID to add a custom token to your wallet
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.inputField}
              placeholder="Asset ID (e.g., 1000)"
              keyboardType="numeric"
              value={assetId}
              onChangeText={setAssetId}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.fetchButton}
              onPress={handleFetchMetadata}
              disabled={isLoading || !assetId}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.fetchButtonText}>Fetch</Text>
              )}
            </TouchableOpacity>
          </View>

          {tokenMetadata && (
            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Symbol:</Text>
                <Text style={styles.metadataValue}>{tokenMetadata.symbol}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Name:</Text>
                <Text style={styles.metadataValue}>{tokenMetadata.name}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Decimals:</Text>
                <Text style={styles.metadataValue}>{tokenMetadata.decimals}</Text>
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleClose}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnConfirm,
                !tokenMetadata && styles.btnConfirmDisabled,
              ]}
              onPress={handleAddToken}
              disabled={!tokenMetadata}
            >
              <Text style={styles.btnConfirmText}>Add Token</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  fetchButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  fetchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  metadataContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEE',
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  btnConfirmDisabled: {
    backgroundColor: '#CCC',
  },
  btnConfirmText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
