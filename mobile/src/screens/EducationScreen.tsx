import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PezkuwiWebView } from '../components';

/**
 * Education (Perwerde) Screen
 *
 * Uses WebView to load the education platform from the web app.
 * Includes courses, enrollments, certificates, and progress tracking.
 * Native wallet bridge allows transaction signing for enrollments.
 */
const EducationScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/education"
        title="Perwerde"
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

export default EducationScreen;
