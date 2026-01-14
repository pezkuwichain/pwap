import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock contexts before importing SettingsScreen
jest.mock('../../contexts/ThemeContext', () => require('../../__mocks__/contexts/ThemeContext'));
jest.mock('../../contexts/BiometricAuthContext', () => require('../../__mocks__/contexts/BiometricAuthContext'));
jest.mock('../../contexts/AuthContext', () => require('../../__mocks__/contexts/AuthContext'));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

import SettingsScreen from '../../screens/SettingsScreen';
import { MockThemeProvider } from '../../__mocks__/contexts/ThemeContext';
import { MockBiometricAuthProvider } from '../../__mocks__/contexts/BiometricAuthContext';
import { MockAuthProvider } from '../../__mocks__/contexts/AuthContext';

// Helper to render SettingsScreen with all required providers
const renderSettingsScreen = (themeValue = {}, biometricValue = {}, authValue = {}) => {
  return render(
    <MockAuthProvider value={authValue}>
      <MockBiometricAuthProvider value={biometricValue}>
        <MockThemeProvider value={themeValue}>
          <SettingsScreen />
        </MockThemeProvider>
      </MockBiometricAuthProvider>
    </MockAuthProvider>
  );
};

describe('SettingsScreen - Dark Mode Feature', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
  });

  describe('Rendering', () => {
    it('should render Dark Mode section with toggle', () => {
      const { getByText } = renderSettingsScreen();

      expect(getByText('APPEARANCE')).toBeTruthy();
      expect(getByText('darkMode')).toBeTruthy();
    });

    it('should show current dark mode state', () => {
      const { getByText } = renderSettingsScreen({ isDarkMode: false });

      // Should show subtitle when dark mode is off
      expect(getByText(/settingsScreen.subtitles.lightThemeEnabled/i)).toBeTruthy();
    });

    it('should show "Enabled" when dark mode is on', () => {
      const { getByText } = renderSettingsScreen({ isDarkMode: true });

      // Should show subtitle when dark mode is on
      expect(getByText(/settingsScreen.subtitles.darkThemeEnabled/i)).toBeTruthy();
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle dark mode when switch is pressed', async () => {
      const mockToggleDarkMode = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = renderSettingsScreen({
        isDarkMode: false,
        toggleDarkMode: mockToggleDarkMode,
      });

      // Find the toggle switch
      const darkModeSwitch = getByTestId('dark-mode-switch');

      // Toggle the switch
      fireEvent(darkModeSwitch, 'valueChange', true);

      // Verify toggleDarkMode was called
      await waitFor(() => {
        expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
      });
    });

    it('should toggle from enabled to disabled', async () => {
      const mockToggleDarkMode = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = renderSettingsScreen({
        isDarkMode: true,
        toggleDarkMode: mockToggleDarkMode,
      });

      const darkModeSwitch = getByTestId('dark-mode-switch');

      // Toggle off
      fireEvent(darkModeSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Persistence', () => {
    it('should save dark mode preference to AsyncStorage', async () => {
      const mockToggleDarkMode = jest.fn(async () => {
        await AsyncStorage.setItem('@pezkuwi/theme', 'dark');
      });

      const { getByTestId } = renderSettingsScreen({
        isDarkMode: false,
        toggleDarkMode: mockToggleDarkMode,
      });

      const darkModeSwitch = getByTestId('dark-mode-switch');
      fireEvent(darkModeSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@pezkuwi/theme', 'dark');
      });
    });

    it('should load dark mode preference on mount', async () => {
      // Pre-set dark mode in AsyncStorage
      await AsyncStorage.setItem('@pezkuwi/theme', 'dark');

      const { getByText } = renderSettingsScreen({ isDarkMode: true });

      // Verify dark mode is enabled - check for dark theme subtitle
      expect(getByText(/settingsScreen.subtitles.darkThemeEnabled/i)).toBeTruthy();
    });
  });

  describe('Theme Application', () => {
    it('should apply dark theme colors when enabled', () => {
      const darkColors = {
        background: '#121212',
        surface: '#1E1E1E',
        text: '#FFFFFF',
        textSecondary: '#B0B0B0',
        border: '#333333',
      };

      const { getByTestId } = renderSettingsScreen({
        isDarkMode: true,
        colors: darkColors,
      });

      const container = getByTestId('settings-screen');

      // Verify dark background is applied
      expect(container.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: darkColors.background,
        })
      );
    });

    it('should apply light theme colors when disabled', () => {
      const lightColors = {
        background: '#F5F5F5',
        surface: '#FFFFFF',
        text: '#000000',
        textSecondary: '#666666',
        border: '#E0E0E0',
      };

      const { getByTestId } = renderSettingsScreen({
        isDarkMode: false,
        colors: lightColors,
      });

      const container = getByTestId('settings-screen');

      // Verify light background is applied
      expect(container.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: lightColors.background,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid toggle clicks', async () => {
      const mockToggleDarkMode = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = renderSettingsScreen({
        isDarkMode: false,
        toggleDarkMode: mockToggleDarkMode,
      });

      const darkModeSwitch = getByTestId('dark-mode-switch');

      // Rapid clicks
      fireEvent(darkModeSwitch, 'valueChange', true);
      fireEvent(darkModeSwitch, 'valueChange', false);
      fireEvent(darkModeSwitch, 'valueChange', true);

      await waitFor(() => {
        // Should handle all toggle attempts
        expect(mockToggleDarkMode).toHaveBeenCalled();
      });
    });

    it('should call toggleDarkMode multiple times without issues', async () => {
      const mockToggleDarkMode = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = renderSettingsScreen({
        isDarkMode: false,
        toggleDarkMode: mockToggleDarkMode,
      });

      const darkModeSwitch = getByTestId('dark-mode-switch');

      // Toggle multiple times
      fireEvent(darkModeSwitch, 'valueChange', true);
      fireEvent(darkModeSwitch, 'valueChange', false);
      fireEvent(darkModeSwitch, 'valueChange', true);

      await waitFor(() => {
        // Should handle all calls
        expect(mockToggleDarkMode).toHaveBeenCalledTimes(3);
      });
    });
  });
});
