import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PezkuwiWebView from '../components/PezkuwiWebView';

/**
 * Governance Screen
 *
 * Uses WebView to load the governance interface from the web app.
 * Includes elections, proposals, voting, and government role management.
 * Native wallet bridge allows transaction signing for votes.
 */
const GovernanceScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/elections"
        title="Governance"
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

export default GovernanceScreen;
