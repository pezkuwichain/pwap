import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

interface Account {
  address: string;
  name: string;
}

interface WalletSelectorProps {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccount: Account | null;
  onSelect: (account: Account) => void;
  onRename: (address: string, newName: string) => Promise<void>;
  onDelete: (address: string) => Promise<void>;
  onAddNew: () => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({
  visible,
  onClose,
  accounts,
  selectedAccount,
  onSelect,
  onRename,
  onDelete,
  onAddNew,
}) => {
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameAddress, setRenameAddress] = useState('');
  const [renameName, setRenameName] = useState('');

  const handleDelete = async (account: Account) => {
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
        await onDelete(account.address);
        if (accounts.length <= 1) {
          onClose();
        }
      } catch {
        if (Platform.OS === 'web') {
          window.alert('Failed to delete wallet');
        } else {
          Alert.alert('Error', 'Failed to delete wallet');
        }
      }
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>My Wallets</Text>
            <Text style={styles.subtitle}>
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
                      onSelect(account);
                      onClose();
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
                    style={styles.renameWalletButton}
                    onPress={() => {
                      setRenameAddress(account.address);
                      setRenameName(account.name);
                      setRenameModalVisible(true);
                    }}
                  >
                    <Text style={styles.renameWalletIcon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteWalletButton}
                    onPress={() => handleDelete(account)}
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
                onClose();
                onAddNew();
              }}
            >
              <View style={styles.addNewWalletIcon}>
                <Text style={{fontSize: 24, color: KurdistanColors.kesk}}>+</Text>
              </View>
              <Text style={styles.addNewWalletText}>Add New Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnConfirm} onPress={onClose}>
              <Text style={{color:'white'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename Wallet Modal */}
      <Modal visible={renameModalVisible} transparent animationType="slide" onRequestClose={() => setRenameModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Rename Wallet</Text>
            <TextInput
              style={styles.inputField}
              placeholder="New wallet name"
              value={renameName}
              onChangeText={setRenameName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setRenameModalVisible(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={async () => {
                  if (renameName.trim()) {
                    await onRename(renameAddress, renameName.trim());
                    setRenameModalVisible(false);
                  }
                }}
              >
                <Text style={{color:'white'}}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    alignItems: 'center',
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputField: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 10,
  },
  btnCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEE',
    alignItems: 'center',
  },
  btnConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  walletOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
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
  renameWalletButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameWalletIcon: {
    fontSize: 18,
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
});

export default WalletSelector;
