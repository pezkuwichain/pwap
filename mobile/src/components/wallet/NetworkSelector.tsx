import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { NetworkType, NETWORKS } from '../../contexts/PezkuwiContext';

interface NetworkSelectorProps {
  visible: boolean;
  onClose: () => void;
  currentNetwork: NetworkType;
  onSwitch: (network: NetworkType) => void;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  visible,
  onClose,
  currentNetwork,
  onSwitch,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalHeader}>Select Network</Text>
          <Text style={styles.subtitle}>
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
                  isSelected && styles.networkOptionSelected,
                ]}
                onPress={() => onSwitch(networkKey)}
              >
                <View style={{flex: 1}}>
                  <Text style={[styles.networkName, isSelected && {color: KurdistanColors.kesk}]}>
                    {network.displayName}
                  </Text>
                  <Text style={styles.networkType}>
                    {network.type === 'mainnet' ? 'Mainnet' : network.type === 'testnet' ? 'Testnet' : 'Canary'}
                  </Text>
                </View>
                {isSelected && <Text style={{fontSize: 20}}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.btnConfirm} onPress={onClose}>
            <Text style={{color:'white'}}>Close</Text>
          </TouchableOpacity>
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
  btnConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
    width: '100%',
  },
  networkOption: {
    flexDirection: 'row',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
    alignItems: 'center',
  },
  networkOptionSelected: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  networkType: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default NetworkSelector;
