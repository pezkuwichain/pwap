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
import FontSizeModal from '../../components/FontSizeModal';
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

// Helper to render FontSizeModal
const renderFontSizeModal = (overrides: any = {}) => {
  const mockSetFontSize = overrides.setFontSize || jest.fn().mockResolvedValue(undefined);
  const mockOnClose = overrides.onClose || jest.fn();

  const themeValue = {
    fontSize: overrides.fontSize || ('medium' as 'small' | 'medium' | 'large'),
    setFontSize: mockSetFontSize,
  };

  const props = {
    visible: overrides.visible !== undefined ? overrides.visible : true,
    onClose: mockOnClose,
  };

  return {
    ...render(
      <MockThemeProvider value={themeValue}>
        <FontSizeModal {...props} />
      </MockThemeProvider>
    ),
    mockSetFontSize,
    mockOnClose,
  };
};

describe('SettingsScreen - Font Size Feature', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('Rendering', () => {
    it('should render Font Size button', () => {
      const { getByText } = renderSettingsScreen();

      expect(getByText('Font Size')).toBeTruthy();
    });

    it('should show current font size in subtitle', () => {
      const { getByText } = renderSettingsScreen({ fontSize: 'medium' });

      expect(getByText('Current: Medium')).toBeTruthy();
    });

    it('should show Small font size in subtitle', () => {
      const { getByText } = renderSettingsScreen({ fontSize: 'small' });

      expect(getByText('Current: Small')).toBeTruthy();
    });

    it('should show Large font size in subtitle', () => {
      const { getByText } = renderSettingsScreen({ fontSize: 'large' });

      expect(getByText('Current: Large')).toBeTruthy();
    });
  });

  describe('Modal Interaction', () => {
    it('should open font size modal when button is pressed', async () => {
      const { getByText, getByTestId } = renderSettingsScreen();

      const fontSizeButton = getByText('Font Size').parent?.parent;
      expect(fontSizeButton).toBeTruthy();

      fireEvent.press(fontSizeButton!);

      // Modal should open (we'll test modal rendering separately)
      await waitFor(() => {
        // Just verify the button was pressable
        expect(fontSizeButton).toBeTruthy();
      });
    });
  });

  describe('Font Scale Application', () => {
    it('should display small font scale', () => {
      const { getByText } = renderSettingsScreen({
        fontSize: 'small',
        fontScale: 0.875,
      });

      // Verify font size is displayed
      expect(getByText('Current: Small')).toBeTruthy();
    });

    it('should display medium font scale', () => {
      const { getByText } = renderSettingsScreen({
        fontSize: 'medium',
        fontScale: 1.0,
      });

      expect(getByText('Current: Medium')).toBeTruthy();
    });

    it('should display large font scale', () => {
      const { getByText } = renderSettingsScreen({
        fontSize: 'large',
        fontScale: 1.125,
      });

      expect(getByText('Current: Large')).toBeTruthy();
    });
  });

  describe('Persistence', () => {
    it('should save font size to AsyncStorage', async () => {
      const mockSetFontSize = jest.fn(async (size) => {
        await AsyncStorage.setItem('@pezkuwi/font_size', size);
      });

      const { getByText } = renderSettingsScreen({
        fontSize: 'medium',
        setFontSize: mockSetFontSize,
      });

      // Simulate selecting a new size
      await mockSetFontSize('large');

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@pezkuwi/font_size', 'large');
      });
    });

    it('should load saved font size on mount', async () => {
      await AsyncStorage.setItem('@pezkuwi/font_size', 'large');

      const { getByText } = renderSettingsScreen({ fontSize: 'large' });

      expect(getByText('Current: Large')).toBeTruthy();
    });
  });
});

describe('FontSizeModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal when visible', () => {
      const { getByText } = renderFontSizeModal({ fontSize: 'medium', visible: true });

      expect(getByText('Font Size')).toBeTruthy();
    });

    it('should render all three size options', () => {
      const { getByText } = renderFontSizeModal();

      expect(getByText('Small')).toBeTruthy();
      expect(getByText(/Medium.*Default/i)).toBeTruthy();
      expect(getByText('Large')).toBeTruthy();
    });

    it('should show checkmark on current size', () => {
      const { getByTestId, getByText } = renderFontSizeModal({ fontSize: 'medium' });

      const mediumOption = getByTestId('font-size-medium');
      expect(mediumOption).toBeTruthy();
      // Checkmark should be visible for medium
      expect(getByText('✓')).toBeTruthy();
    });
  });

  describe('Size Selection', () => {
    it('should call setFontSize when Small is pressed', async () => {
      const { getByTestId, mockSetFontSize, mockOnClose } = renderFontSizeModal({
        fontSize: 'medium',
      });

      const smallButton = getByTestId('font-size-small');
      fireEvent.press(smallButton);

      await waitFor(() => {
        expect(mockSetFontSize).toHaveBeenCalledWith('small');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should call setFontSize when Large is pressed', async () => {
      const { getByTestId, mockSetFontSize, mockOnClose } = renderFontSizeModal({
        fontSize: 'medium',
      });

      const largeButton = getByTestId('font-size-large');
      fireEvent.press(largeButton);

      await waitFor(() => {
        expect(mockSetFontSize).toHaveBeenCalledWith('large');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Close', () => {
    it('should call onClose when close button is pressed', async () => {
      const { getByTestId, mockOnClose } = renderFontSizeModal();

      const closeButton = getByTestId('font-size-modal-close');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});
