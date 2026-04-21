import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

import hezLogo from '../../../../shared/images/hez_token_512.png';
import pezLogo from '../../../../shared/images/pez_token_512.png';
import dotLogo from '../../../../shared/images/dot.png';

interface ChainInfo {
  id: string;
  name: string;
  paraId: number | null; // null = relay chain
  icon: string;
  rpcEndpoint?: string;
}

interface BridgeToken {
  symbol: string;
  name: string;
  decimals: number;
  logo: ImageSourcePropType;
  xcmSupported: boolean;
}

const CHAINS: ChainInfo[] = [
  { id: 'pezkuwi', name: 'Pezkuwi', paraId: null, icon: '🏔️' },
  { id: 'polkadot', name: 'Polkadot', paraId: null, icon: '⭕' },
  { id: 'dicle', name: 'Dicle Testnet', paraId: 1000, icon: '🧪' },
];

const BRIDGE_TOKENS: BridgeToken[] = [
  { symbol: 'HEZ', name: 'Pezkuwi Coin', decimals: 12, logo: hezLogo, xcmSupported: true },
  { symbol: 'PEZ', name: 'Pezkuwi Token', decimals: 12, logo: pezLogo, xcmSupported: true },
  { symbol: 'DOT', name: 'Polkadot', decimals: 10, logo: dotLogo, xcmSupported: true },
];

const XCMBridgeScreen: React.FC = () => {
  const { api, isApiReady, selectedAccount, getKeyPair } = usePezkuwi();

  const [sourceChain, setSourceChain] = useState<ChainInfo>(CHAINS[0]);
  const [destChain, setDestChain] = useState<ChainInfo>(CHAINS[1]);
  const [selectedToken, setSelectedToken] = useState<BridgeToken>(BRIDGE_TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [useSameAddress, setUseSameAddress] = useState(true);

  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [showChainSelector, setShowChainSelector] = useState<'source' | 'dest' | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);

  // Auto-fill recipient with own address
  useEffect(() => {
    if (useSameAddress && selectedAccount) {
      setRecipientAddress(selectedAccount.address);
    }
  }, [useSameAddress, selectedAccount]);

  // Estimate XCM fee
  useEffect(() => {
    if (!api || !isApiReady || !amount || parseFloat(amount) <= 0) {
      setEstimatedFee(null);
      return;
    }

    const estimate = async () => {
      setIsEstimating(true);
      try {
        // XCM fee estimation depends on the route
        // For now, use a rough estimate based on weight
        const baseFee = 0.01; // Base fee in source chain token
        const xcmWeight = 0.005; // Additional XCM execution weight
        setEstimatedFee((baseFee + xcmWeight).toFixed(6));
      } catch {
        setEstimatedFee('~0.015');
      } finally {
        setIsEstimating(false);
      }
    };

    const timer = setTimeout(estimate, 500);
    return () => clearTimeout(timer);
  }, [api, isApiReady, amount, sourceChain, destChain, selectedToken]);

  const canBridge = useMemo(() => {
    return (
      amount &&
      parseFloat(amount) > 0 &&
      recipientAddress &&
      sourceChain.id !== destChain.id &&
      selectedToken.xcmSupported &&
      !isSending
    );
  }, [amount, recipientAddress, sourceChain, destChain, selectedToken, isSending]);

  const handleBridge = async () => {
    if (!api || !selectedAccount || !canBridge) return;

    Alert.alert(
      'Confirm Bridge Transfer',
      `Transfer ${amount} ${selectedToken.symbol}\n\nFrom: ${sourceChain.name}\nTo: ${destChain.name}\nRecipient: ${recipientAddress.slice(0, 12)}...\nEst. Fee: ${estimatedFee || '~0.015'} ${selectedToken.symbol}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsSending(true);
            try {
              const keyPair = await getKeyPair(selectedAccount.address);
              if (!keyPair) throw new Error('No keypair');

              const amountPlanck = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, selectedToken.decimals)));

              // Build XCM transfer
              // xcmPallet.limitedReserveTransferAssets or xcmPallet.limitedTeleportAssets
              const dest = {
                V3: {
                  parents: destChain.paraId ? 0 : 1,
                  interior: destChain.paraId
                    ? { X1: { Parachain: destChain.paraId } }
                    : 'Here',
                },
              };

              const beneficiary = {
                V3: {
                  parents: 0,
                  interior: {
                    X1: {
                      AccountId32: {
                        network: null,
                        id: recipientAddress,
                      },
                    },
                  },
                },
              };

              const assets = {
                V3: [
                  {
                    id: { Concrete: { parents: 0, interior: 'Here' } },
                    fun: { Fungible: amountPlanck.toString() },
                  },
                ],
              };

              // Try limited reserve transfer first
              let tx;
              if (api.tx.xcmPallet?.limitedReserveTransferAssets) {
                tx = api.tx.xcmPallet.limitedReserveTransferAssets(
                  dest, beneficiary, assets, 0, 'Unlimited'
                );
              } else if (api.tx.polkadotXcm?.limitedReserveTransferAssets) {
                tx = api.tx.polkadotXcm.limitedReserveTransferAssets(
                  dest, beneficiary, assets, 0, 'Unlimited'
                );
              } else {
                throw new Error('XCM pallet not available on this chain');
              }

              await tx.signAndSend(keyPair, ({ status }: { status: { isInBlock: boolean; asInBlock: { toHex(): string } } }) => {
                if (status.isInBlock) {
                  setIsSending(false);
                  Alert.alert(
                    'Bridge Initiated',
                    `XCM transfer submitted!\nBlock: ${status.asInBlock.toHex().slice(0, 10)}...\n\nThe transfer may take a few minutes to arrive on ${destChain.name}.`,
                    [{ text: 'OK' }]
                  );
                  setAmount('');
                }
              });
            } catch (e) {
              setIsSending(false);
              Alert.alert('Bridge Failed', (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleSwapChains = () => {
    const temp = sourceChain;
    setSourceChain(destChain);
    setDestChain(temp);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cross-Chain Bridge</Text>
      <Text style={styles.subtitle}>Transfer tokens between chains via XCM</Text>

      {/* Source Chain */}
      <Text style={styles.label}>From</Text>
      <TouchableOpacity style={styles.chainSelector} onPress={() => setShowChainSelector('source')} accessibilityRole="button" accessibilityLabel={`Source chain, currently ${sourceChain.name}`}>
        <Text style={styles.chainIcon}>{sourceChain.icon}</Text>
        <Text style={styles.chainName}>{sourceChain.name}</Text>
        <Text style={styles.chainArrow}>▼</Text>
      </TouchableOpacity>

      {/* Swap Direction */}
      <View style={styles.swapContainer}>
        <TouchableOpacity style={styles.swapBtn} onPress={handleSwapChains} accessibilityRole="button" accessibilityLabel="Swap chain direction">
          <Text style={styles.swapIcon}>⇅</Text>
        </TouchableOpacity>
      </View>

      {/* Dest Chain */}
      <Text style={styles.label}>To</Text>
      <TouchableOpacity style={styles.chainSelector} onPress={() => setShowChainSelector('dest')} accessibilityRole="button" accessibilityLabel={`Destination chain, currently ${destChain.name}`}>
        <Text style={styles.chainIcon}>{destChain.icon}</Text>
        <Text style={styles.chainName}>{destChain.name}</Text>
        <Text style={styles.chainArrow}>▼</Text>
      </TouchableOpacity>

      {/* Token Selector */}
      <Text style={styles.label}>Token</Text>
      <TouchableOpacity style={styles.tokenSelector} onPress={() => setShowTokenSelector(true)} accessibilityRole="button" accessibilityLabel={`Select token, currently ${selectedToken.symbol}`}>
        <Image source={selectedToken.logo} style={styles.tokenLogo} resizeMode="contain" accessibilityLabel={`${selectedToken.symbol} logo`} />
        <Text style={styles.tokenSymbol}>{selectedToken.symbol}</Text>
        <Text style={styles.chainArrow}>▼</Text>
      </TouchableOpacity>

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        accessibilityLabel="Bridge amount"
      />

      {/* Recipient */}
      <View style={styles.recipientHeader}>
        <Text style={styles.label}>Recipient</Text>
        <TouchableOpacity onPress={() => setUseSameAddress(!useSameAddress)} accessibilityRole="button" accessibilityLabel="Toggle same address">
          <Text style={styles.sameAddressToggle}>
            {useSameAddress ? '✓ Same address' : 'Use different address'}
          </Text>
        </TouchableOpacity>
      </View>
      {!useSameAddress && (
        <TextInput
          style={styles.input}
          placeholder="Recipient address on destination chain"
          value={recipientAddress}
          onChangeText={setRecipientAddress}
          autoCapitalize="none"
          accessibilityLabel="Recipient address"
        />
      )}

      {/* Fee Estimate */}
      {estimatedFee && (
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Estimated XCM Fee</Text>
          {isEstimating ? (
            <ActivityIndicator size="small" color={KurdistanColors.kesk} />
          ) : (
            <Text style={styles.feeValue}>{estimatedFee} {selectedToken.symbol}</Text>
          )}
        </View>
      )}

      {/* Warning */}
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Cross-chain transfers may take 1-5 minutes. Ensure the destination chain supports this token.
        </Text>
      </View>

      {/* Bridge Button */}
      <TouchableOpacity
        style={[styles.bridgeBtn, !canBridge && styles.bridgeBtnDisabled]}
        onPress={handleBridge}
        disabled={!canBridge}
        accessibilityRole="button"
        accessibilityLabel={`Bridge ${selectedToken.symbol}`}
      >
        {isSending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.bridgeBtnText}>Bridge {selectedToken.symbol}</Text>
        )}
      </TouchableOpacity>

      {/* Chain Selector Modal */}
      <Modal visible={!!showChainSelector} transparent animationType="slide" onRequestClose={() => setShowChainSelector(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Chain</Text>
            {CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={styles.chainOption}
                onPress={() => {
                  if (showChainSelector === 'source') setSourceChain(chain);
                  else setDestChain(chain);
                  setShowChainSelector(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${chain.name}`}
              >
                <Text style={styles.chainOptionIcon}>{chain.icon}</Text>
                <Text style={styles.chainOptionName}>{chain.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowChainSelector(null)} accessibilityRole="button" accessibilityLabel="Cancel chain selection">
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Token Selector Modal */}
      <Modal visible={showTokenSelector} transparent animationType="slide" onRequestClose={() => setShowTokenSelector(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Token</Text>
            {BRIDGE_TOKENS.filter(t => t.xcmSupported).map((token) => (
              <TouchableOpacity
                key={token.symbol}
                style={styles.chainOption}
                onPress={() => {
                  setSelectedToken(token);
                  setShowTokenSelector(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${token.symbol} ${token.name}`}
              >
                <Image source={token.logo} style={styles.tokenOptionLogo} resizeMode="contain" />
                <View>
                  <Text style={styles.chainOptionName}>{token.symbol}</Text>
                  <Text style={styles.tokenOptionSubtext}>{token.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowTokenSelector(false)} accessibilityRole="button" accessibilityLabel="Cancel token selection">
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  chainSelector: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  chainIcon: { fontSize: 24 },
  chainName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  chainArrow: { fontSize: 12, color: '#999' },
  swapContainer: { alignItems: 'center', marginVertical: -8, zIndex: 10 },
  swapBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 2,
    borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  swapIcon: { fontSize: 20, color: '#333' },
  tokenSelector: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  tokenLogo: { width: 28, height: 28 },
  tokenSymbol: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, fontSize: 16, color: '#333',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  recipientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  sameAddressToggle: { fontSize: 13, color: KurdistanColors.kesk, fontWeight: '600' },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDF4', padding: 14, borderRadius: 12, marginTop: 16,
  },
  feeLabel: { fontSize: 14, color: '#666' },
  feeValue: { fontSize: 14, fontWeight: '600', color: KurdistanColors.kesk },
  warningBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 12 },
  warningText: { fontSize: 13, color: '#92400E', lineHeight: 20 },
  bridgeBtn: {
    backgroundColor: KurdistanColors.kesk, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  bridgeBtnDisabled: { backgroundColor: '#9CA3AF' },
  bridgeBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 16 },
  chainOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    backgroundColor: '#F8F9FA', marginBottom: 8, gap: 12,
  },
  chainOptionIcon: { fontSize: 24 },
  chainOptionName: { fontSize: 16, fontWeight: '600', color: '#333' },
  tokenOptionLogo: { width: 32, height: 32 },
  tokenOptionSubtext: { fontSize: 12, color: '#888', marginTop: 2 },
  modalClose: { backgroundColor: '#EEEEEE', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#666' },
});

export default XCMBridgeScreen;
