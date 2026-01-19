import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PezkuwiWebView from '../components/PezkuwiWebView';

/**
 * Forum Screen
 *
 * Uses WebView to load the full-featured forum from the web app.
 * Includes categories, threads, posts, replies, and moderation features.
 */
const ForumScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/forum"
        title="Forum"
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

export default ForumScreen;
