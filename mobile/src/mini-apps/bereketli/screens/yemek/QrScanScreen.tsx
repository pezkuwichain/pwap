import React, {useState, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import {confirmPickup} from '../../api/orders';

export default function QrScanScreen({navigation}: any) {
  const {t} = useTranslation();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const insets = useSafeAreaInsets();
  const processedRef = useRef(false);

  const handleQrRead = async (event: any) => {
    if (processedRef.current || processing) return;
    const qrData = event.nativeEvent?.codeStringValue || event?.nativeEvent?.codeStringValue;
    if (!qrData) return;

    processedRef.current = true;
    setScanning(false);
    setProcessing(true);

    try {
      // QR data format: "orderId:qrToken" or just qrToken
      let orderId = '';
      let qrToken = '';

      if (qrData.includes(':')) {
        const parts = qrData.split(':');
        orderId = parts[0];
        qrToken = parts[1];
      } else {
        // Try as pure qr_token — backend will match
        qrToken = qrData;
        orderId = qrData;
      }

      const order = await confirmPickup(orderId, qrToken);

      Alert.alert(
        t('qrScan.successTitle'),
        t('qrScan.successMessage', {orderId: order.id.slice(0, 8).toUpperCase(), price: order.total_price.toFixed(0)}),
        [{text: t('common.ok'), onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('qrScan.errorMessage');
      Alert.alert(t('common.error'), msg, [
        {text: t('qrScan.retryButton'), onPress: () => {
          processedRef.current = false;
          setScanning(true);
          setProcessing(false);
        }},
        {text: t('common.cancel'), onPress: () => navigation.goBack()},
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('qrScan.title')}</Text>
        <View style={{width: 40}} />
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        {scanning && (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(result) => handleQrRead({ nativeEvent: { codeStringValue: result.data } })}
          />
        )}

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            {processing && (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
          </View>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>
          {processing ? t('qrScan.verifying') : t('qrScan.scanPrompt')}
        </Text>
        <Text style={styles.instructionText}>
          {t('qrScan.instructions')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 24, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},

  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  instructions: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
