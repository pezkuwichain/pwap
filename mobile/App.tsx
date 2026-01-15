import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { PezkuwiProvider } from './src/contexts/PezkuwiContext';
import { BiometricAuthProvider } from './src/contexts/BiometricAuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PezkuwiProvider>
            <BiometricAuthProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </BiometricAuthProvider>
          </PezkuwiProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
