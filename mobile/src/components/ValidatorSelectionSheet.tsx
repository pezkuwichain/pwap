import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheet, Button } from './index'; // Assuming these are exported from index.ts or index.tsx in the same folder
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors, AppColors } from '../theme/colors';

interface Validator {
  address: string;
  commission: number;
  totalStake: string; // Formatted balance
  selfStake: string; // Formatted balance
  nominators: number;
  // Add other relevant validator info
}

interface ValidatorSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmNominations: (validators: string[]) => void;
  // Add other props like currentNominations if needed
}

export function ValidatorSelectionSheet({
  visible,
  onClose,
  onConfirmNominations,
}: ValidatorSelectionSheetProps) {
  const { api, isApiReady } = usePezkuwi();
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, _setProcessing] = useState(false);
  const [selectedValidators, setSelectedValidators] = useState<string[]>([]);

  // Fetch real validators from chain
  useEffect(() => {
    const fetchValidators = async () => {
      if (!api || !isApiReady) return;

      setLoading(true);
      try {
        const chainValidators: Validator[] = [];
        // Attempt to fetch from pallet-validator-pool first
        if (api.query.validatorPool && api.query.validatorPool.validators) {
          const rawValidators = await api.query.validatorPool.validators();
          const validatorList = rawValidators.toHuman() as string[];
          for (const rawValidator of validatorList) {
            chainValidators.push({
              address: String(rawValidator),
              commission: 0.05,
              totalStake: '0 HEZ',
              selfStake: '0 HEZ',
              nominators: 0,
            });
          }
        } else {
          // Fallback to session validators
          const sessionValidators = await api.query.session.validators();
          const validatorAddresses = sessionValidators.toJSON() as string[];

          for (const address of validatorAddresses) {
            const validatorPrefs = await api.query.staking.validators(address);
            const prefsJson = validatorPrefs.toJSON() as { commission?: number } | null;
            const commission = prefsJson?.commission
              ? Number(prefsJson.commission) / 1_000_000_000
              : 0.05;

            chainValidators.push({
              address: address,
              commission: commission,
              totalStake: 'Fetching...',
              selfStake: 'Fetching...',
              nominators: 0,
            });
          }
        }
        
        setValidators(chainValidators);
      } catch (error) {
        if (__DEV__) console.error('Error fetching validators:', error);
        Alert.alert('Error', 'Failed to fetch validators.');
      } finally {
        setLoading(false);
      }
    };

    fetchValidators();
  }, [api, isApiReady]);


  const toggleValidatorSelection = (address: string) => {
    setSelectedValidators(prev =>
      prev.includes(address)
        ? prev.filter(item => item !== address)
        : [...prev, address]
    );
  };

  const handleConfirm = () => {
    if (selectedValidators.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one validator.');
      return;
    }
    // Pass selected validators to parent component to initiate transaction
    onConfirmNominations(selectedValidators);
    onClose();
  };

  const renderValidatorItem = ({ item }: { item: Validator }) => (
    <TouchableOpacity
      style={[
        styles.validatorItem,
        selectedValidators.includes(item.address) && styles.selectedValidatorItem,
      ]}
      onPress={() => toggleValidatorSelection(item.address)}
    >
      <View>
        <Text style={styles.validatorAddress}>
          {item.address.substring(0, 8)}...{item.address.substring(item.address.length - 6)}
        </Text>
        <Text style={styles.validatorDetail}>Commission: {item.commission * 100}%</Text>
        <Text style={styles.validatorDetail}>Total Stake: {item.totalStake}</Text>
        <Text style={styles.validatorDetail}>Self Stake: {item.selfStake}</Text>
        <Text style={styles.validatorDetail}>Nominators: {item.nominators}</Text>
      </View>
      {selectedValidators.includes(item.address) && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedIndicatorText}>✔</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Validators">
      {loading ? (
        <ActivityIndicator size="large" color={KurdistanColors.kesk} />
      ) : (
        <FlatList
          data={validators}
          keyExtractor={item => item.address}
          renderItem={renderValidatorItem}
          style={styles.list}
        />
      )}
      <Button
        title={processing ? 'Confirming...' : 'Confirm Nominations'}
        onPress={handleConfirm}
        loading={processing}
        disabled={processing || selectedValidators.length === 0}
        fullWidth
        style={{ marginTop: 20 }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 400, // Adjust as needed
  },
  validatorItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedValidatorItem: {
    borderColor: KurdistanColors.kesk,
    borderWidth: 2,
  },
  validatorAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  validatorDetail: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  selectedIndicator: {
    backgroundColor: KurdistanColors.kesk,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    color: KurdistanColors.spi,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
