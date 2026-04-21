import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { QRScannerModal } from '../../components/wallet/QRScannerModal';
import {
  initWalletConnect,
  setEventCallbacks,
  pair,
  approveSession,
  rejectSession,
  respondToRequest,
  rejectRequest,
  disconnectSession,
  getActiveSessions,
  WCSession,
  WCSignRequest,
} from '../../services/WalletConnectService';
import { logger } from '../../utils/logger';

const WalletConnectScreen: React.FC = () => {
  const { selectedAccount, getKeyPair } = usePezkuwi();

  const [sessions, setSessions] = useState<WCSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrVisible, setQrVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Pending proposal/request
  const [pendingProposal, setPendingProposal] = useState<Web3WalletTypes.SessionProposal | null>(null);
  const [pendingRequest, setPendingRequest] = useState<WCSignRequest | null>(null);
  const [signing, setSigning] = useState(false);

  const refreshSessions = useCallback(async () => {
    try {
      const active = await getActiveSessions();
      setSessions(active);
    } catch {
      // WC not initialized yet
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initWalletConnect();

        setEventCallbacks({
          onSessionProposal: (proposal) => setPendingProposal(proposal),
          onSessionRequest: (request) => setPendingRequest(request),
          onSessionDelete: () => refreshSessions(),
        });

        await refreshSessions();
      } catch (e) {
        logger.error('[WC] Init failed:', e);
        setLoading(false);
      }
    };
    init();
  }, [refreshSessions]);

  const handleScanQR = async (uri: string) => {
    setQrVisible(false);
    if (!uri.startsWith('wc:')) {
      Alert.alert('Invalid QR', 'This is not a WalletConnect QR code');
      return;
    }
    setConnecting(true);
    try {
      await pair(uri);
      // Proposal will come via callback
    } catch (e) {
      Alert.alert('Connection Failed', (e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!pendingProposal || !selectedAccount) return;
    try {
      await approveSession(pendingProposal, selectedAccount.address);
      setPendingProposal(null);
      await refreshSessions();
      Alert.alert('Connected', 'DApp connected successfully');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const handleRejectProposal = async () => {
    if (!pendingProposal) return;
    await rejectSession(pendingProposal.id);
    setPendingProposal(null);
  };

  const handleSignRequest = async () => {
    if (!pendingRequest || !selectedAccount) return;
    setSigning(true);
    try {
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) throw new Error('No keypair');

      // Sign the payload
      const payload = pendingRequest.params as { data?: string; address?: string } | unknown[];
      const dataToSign = Array.isArray(payload) ? String(payload[0]) : (payload as { data?: string })?.data || '';
      const signature = keyPair.sign(dataToSign);
      const hexSig = '0x' + Buffer.from(signature).toString('hex');

      await respondToRequest(pendingRequest.topic, pendingRequest.id, hexSig);
      setPendingRequest(null);
      Alert.alert('Signed', 'Transaction signed successfully');
    } catch (e) {
      Alert.alert('Signing Failed', (e as Error).message);
    } finally {
      setSigning(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!pendingRequest) return;
    await rejectRequest(pendingRequest.topic, pendingRequest.id);
    setPendingRequest(null);
  };

  const handleDisconnect = async (topic: string) => {
    Alert.alert('Disconnect', 'Disconnect from this DApp?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectSession(topic);
          await refreshSessions();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={KurdistanColors.kesk} />
        <Text style={styles.loadingText}>Initializing WalletConnect...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Connect Button */}
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => setQrVisible(true)}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to connect"
        >
          {connecting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.connectBtnText}>Scan QR to Connect</Text>
          )}
        </TouchableOpacity>

        {/* Active Sessions */}
        <Text style={styles.sectionTitle}>
          Connected DApps ({sessions.length})
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔗</Text>
            <Text style={styles.emptyText}>No connected DApps</Text>
            <Text style={styles.emptySubtext}>
              Scan a WalletConnect QR code from a DApp to connect
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.topic} style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                {session.peerIcon && (
                  <Image source={{ uri: session.peerIcon }} style={styles.sessionIcon} accessibilityLabel={`${session.peerName} icon`} />
                )}
                <View style={styles.sessionDetails}>
                  <Text style={styles.sessionName}>{session.peerName}</Text>
                  <Text style={styles.sessionUrl}>{session.peerUrl}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.disconnectBtn}
                onPress={() => handleDisconnect(session.topic)}
                accessibilityRole="button"
                accessibilityLabel={`Disconnect from ${session.peerName}`}
              >
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* QR Scanner */}
      <QRScannerModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        onScan={handleScanQR}
        title="Scan WalletConnect QR"
        subtitle="Scan the QR code shown in the DApp"
      />

      {/* Session Proposal Modal */}
      <Modal visible={!!pendingProposal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connection Request</Text>
            <Text style={styles.modalPeerName}>
              {pendingProposal?.params.proposer.metadata.name}
            </Text>
            <Text style={styles.modalPeerUrl}>
              {pendingProposal?.params.proposer.metadata.url}
            </Text>
            <Text style={styles.modalDescription}>
              wants to connect to your wallet
            </Text>
            {selectedAccount && (
              <Text style={styles.modalAccount}>
                Account: {selectedAccount.name}{'\n'}
                {selectedAccount.address.slice(0, 16)}...
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectProposal} accessibilityRole="button" accessibilityLabel="Reject connection request">
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={handleApproveProposal} accessibilityRole="button" accessibilityLabel="Approve connection request">
                <Text style={styles.approveBtnText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Request Modal */}
      <Modal visible={!!pendingRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign Request</Text>
            <Text style={styles.modalPeerName}>{pendingRequest?.peerName}</Text>
            <Text style={styles.modalDescription}>
              Method: {pendingRequest?.method}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectRequest} accessibilityRole="button" accessibilityLabel="Reject sign request">
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveBtn, signing && { backgroundColor: '#9CA3AF' }]}
                onPress={handleSignRequest}
                disabled={signing}
                accessibilityRole="button"
                accessibilityLabel="Sign transaction"
              >
                <Text style={styles.approveBtnText}>
                  {signing ? 'Signing...' : 'Sign'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 15 },
  connectBtn: {
    backgroundColor: KurdistanColors.kesk, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 24,
  },
  connectBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#999' },
  emptySubtext: { fontSize: 13, color: '#BBB', textAlign: 'center', marginTop: 4 },
  sessionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  sessionInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sessionIcon: { width: 40, height: 40, borderRadius: 10, marginRight: 12 },
  sessionDetails: { flex: 1 },
  sessionName: { fontSize: 16, fontWeight: '600', color: '#333' },
  sessionUrl: { fontSize: 12, color: '#999', marginTop: 2 },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, paddingVertical: 8, alignItems: 'center',
  },
  disconnectBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 12 },
  modalPeerName: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 4 },
  modalPeerUrl: { fontSize: 13, color: '#999', marginBottom: 12 },
  modalDescription: { fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' },
  modalAccount: {
    fontSize: 13, color: '#555', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10,
    marginBottom: 20, textAlign: 'center', width: '100%', fontFamily: 'monospace' as const,
  },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  rejectBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EEEEEE', alignItems: 'center',
  },
  rejectBtnText: { fontSize: 16, fontWeight: '600', color: '#666' },
  approveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: KurdistanColors.kesk, alignItems: 'center',
  },
  approveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

export default WalletConnectScreen;
