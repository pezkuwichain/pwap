import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PezkuwiWebView } from '../components';

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
