import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PezkuwiWebView } from '../components';

/**
 * P2P Trading Screen
 *
 * Uses WebView to load the full-featured P2P trading interface from the web app.
 * The web app handles all P2P logic (offers, trades, escrow, chat, disputes).
 * Native wallet bridge allows transaction signing from the mobile app.
 */
const P2PScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/p2p"
        title="P2P Trading"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default P2PScreen;
