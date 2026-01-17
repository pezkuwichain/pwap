import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { KurdistanColors } from '../theme/colors';

const HelpScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <Text style={styles.icon}>🤝</Text>
        <Text style={styles.title}>Zû tê</Text>
        <Text style={styles.titleEn}>Coming Soon</Text>
        <View style={styles.messageBox}>
          <Text style={styles.message}>
            Sîstema arîkariyê dê di demeke nêzîk de were destpêkirin.
          </Text>
          <Text style={styles.messageEn}>
            The help and support system will be launched soon.
          </Text>
        </View>
        <View style={styles.featureList}>
          <Text style={styles.featureTitle}>Taybetmendiyên Plankirin:</Text>
          <Text style={styles.featureItem}>• Pirsên pir tên pirsîn (FAQ)</Text>
          <Text style={styles.featureItem}>• Piştgiriya zindî</Text>
          <Text style={styles.featureItem}>• Rêberên bikarhêner</Text>
          <Text style={styles.featureItem}>• Têkiliya civakê</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  contentContainer: { flexGrow: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: KurdistanColors.reş, textAlign: 'center', marginBottom: 4 },
  titleEn: { fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 24 },
  messageBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 24, width: '100%' },
  message: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  messageEn: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  featureList: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%' },
  featureTitle: { fontSize: 16, fontWeight: 'bold', color: KurdistanColors.kesk, marginBottom: 12 },
  featureItem: { fontSize: 14, color: '#555', marginBottom: 8, lineHeight: 20 },
});

export default HelpScreen;
