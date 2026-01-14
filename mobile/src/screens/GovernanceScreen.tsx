import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PezkuwiWebView } from '../components';

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
