import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

/**
 * Be Citizen Screen
 *
 * Uses WebView to load the citizenship application interface from the web app.
 * The web app handles all citizenship logic (new application, existing citizen verification).
 * Native wallet bridge allows transaction signing from the mobile app.
 *
 * Citizenship status is checked at governance action entry points.
 */
const BeCitizenScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/be-citizen"
        title="Be Citizen"
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

export default BeCitizenScreen;
