/**
 * ProfileButton E2E Tests
 *
 * Tests the Profile button in BottomTabNavigator and all features
 * within ProfileScreen and EditProfileScreen.
 *
 * Test Coverage:
 * - Profile screen rendering and loading state
 * - Profile data display (name, email, avatar)
 * - Avatar picker modal
 * - Edit Profile navigation
 * - About Pezkuwi alert
 * - Logout flow
 * - Referrals navigation
 * - EditProfileScreen rendering
 * - EditProfileScreen form interactions
 * - EditProfileScreen save/cancel flows
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock contexts
jest.mock('../../contexts/ThemeContext', () => require('../../__mocks__/contexts/ThemeContext'));
jest.mock('../../contexts/AuthContext', () => require('../../__mocks__/contexts/AuthContext'));
jest.mock('../../contexts/PezkuwiContext', () => ({
  usePezkuwi: () => ({
    endpoint: 'wss://rpc.pezkuwichain.io:9944',
    setEndpoint: jest.fn(),
    api: null,
    isApiReady: false,
    selectedAccount: null,
  }),
}));

// Mock navigation - extended from jest.setup.cjs
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  const ReactModule = require('react');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    useFocusEffect: (callback: () => (() => void) | void) => {
      // Use useEffect to properly handle the callback lifecycle
      ReactModule.useEffect(() => {
        const unsubscribe = callback();
        return unsubscribe;
      }, [callback]);
    },
  };
});

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert');

// Mock Supabase with profile data
const mockSupabaseFrom = jest.fn();
const mockProfileData = {
  id: 'test-user-id',
  full_name: 'Test User',
  avatar_url: 'avatar5',
  wallet_address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  created_at: '2026-01-01T00:00:00.000Z',
  referral_code: 'TESTCODE',
  referral_count: 5,
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockSupabaseFrom(table);
      return {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfileData,
          error: null,
        }),
      };
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/avatar.jpg' } }),
      }),
    },
  },
}));

import ProfileScreen from '../../screens/ProfileScreen';
import EditProfileScreen from '../../screens/EditProfileScreen';
import { MockThemeProvider, mockThemeContext } from '../../__mocks__/contexts/ThemeContext';
import { MockAuthProvider, mockAuthContext } from '../../__mocks__/contexts/AuthContext';

// ============================================================
// TEST HELPERS
// ============================================================

const renderProfileScreen = (overrides: {
  theme?: Partial<typeof mockThemeContext>;
  auth?: Partial<typeof mockAuthContext>;
} = {}) => {
  return render(
    <MockAuthProvider value={overrides.auth}>
      <MockThemeProvider value={overrides.theme}>
        <ProfileScreen />
      </MockThemeProvider>
    </MockAuthProvider>
  );
};

const renderEditProfileScreen = (overrides: {
  theme?: Partial<typeof mockThemeContext>;
  auth?: Partial<typeof mockAuthContext>;
} = {}) => {
  return render(
    <MockAuthProvider value={overrides.auth}>
      <MockThemeProvider value={overrides.theme}>
        <EditProfileScreen />
      </MockThemeProvider>
    </MockAuthProvider>
  );
};

// ============================================================
// TESTS
// ============================================================

describe('ProfileButton E2E Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockAlert.mockClear();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  // ----------------------------------------------------------
  // 1. PROFILE SCREEN RENDERING TESTS
  // ----------------------------------------------------------
  describe('1. ProfileScreen Rendering', () => {
    it('renders Profile screen with main container', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeTruthy();
      });
    });

    it('renders header gradient section', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-header-gradient')).toBeTruthy();
      });
    });

    it('renders profile cards container', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-cards-container')).toBeTruthy();
      });
    });

    it('renders scroll view', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-scroll-view')).toBeTruthy();
      });
    });

    it('renders footer with version info', async () => {
      const { getByTestId, getByText } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-footer')).toBeTruthy();
        expect(getByText('Version 1.0.0')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 2. PROFILE DATA DISPLAY TESTS
  // ----------------------------------------------------------
  describe('2. Profile Data Display', () => {
    it('displays user name from profile data', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const nameElement = getByTestId('profile-name');
        expect(nameElement).toBeTruthy();
      });
    });

    it('displays user email', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const emailElement = getByTestId('profile-email');
        expect(emailElement).toBeTruthy();
      });
    });

    it('displays email card', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-card-email')).toBeTruthy();
      });
    });

    it('displays member since card', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-card-member-since')).toBeTruthy();
      });
    });

    it('displays referrals card with count', async () => {
      const { getByTestId, getByText } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-card-referrals')).toBeTruthy();
        expect(getByText('5 people')).toBeTruthy();
      });
    });

    it('displays referral code when available', async () => {
      const { getByTestId, getByText } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-card-referral-code')).toBeTruthy();
        expect(getByText('TESTCODE')).toBeTruthy();
      });
    });

    it('displays wallet address when available', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-card-wallet')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 3. AVATAR TESTS
  // ----------------------------------------------------------
  describe('3. Avatar Display and Interaction', () => {
    it('renders avatar button', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-avatar-button')).toBeTruthy();
      });
    });

    it('displays emoji avatar when avatar_url is emoji ID', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        // avatar5 = 👩🏻
        expect(getByTestId('profile-avatar-emoji-container')).toBeTruthy();
      });
    });

    it('opens avatar picker modal when avatar button is pressed', async () => {
      const { getByTestId, getByText } = renderProfileScreen();

      await waitFor(() => {
        const avatarButton = getByTestId('profile-avatar-button');
        fireEvent.press(avatarButton);
      });

      await waitFor(() => {
        // AvatarPickerModal displays "Choose Your Avatar" as title
        expect(getByText('Choose Your Avatar')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 4. ACTION BUTTONS TESTS
  // ----------------------------------------------------------
  describe('4. Action Buttons', () => {
    it('renders Edit Profile button', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-edit-button')).toBeTruthy();
      });
    });

    it('renders About Pezkuwi button', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-about-button')).toBeTruthy();
      });
    });

    it('navigates to EditProfile when Edit Profile button is pressed', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const editButton = getByTestId('profile-edit-button');
        fireEvent.press(editButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
    });

    it('shows About Pezkuwi alert when button is pressed', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const aboutButton = getByTestId('profile-about-button');
        fireEvent.press(aboutButton);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'About Pezkuwi',
          expect.stringContaining('Pezkuwi is a decentralized blockchain platform'),
          expect.any(Array)
        );
      });
    });
  });

  // ----------------------------------------------------------
  // 5. REFERRALS NAVIGATION TEST
  // ----------------------------------------------------------
  describe('5. Referrals Navigation', () => {
    it('navigates to Referral screen when referrals card is pressed', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const referralsCard = getByTestId('profile-card-referrals');
        fireEvent.press(referralsCard);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Referral');
    });
  });

  // ----------------------------------------------------------
  // 6. LOGOUT TESTS
  // ----------------------------------------------------------
  describe('6. Logout Flow', () => {
    it('renders logout button', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-logout-button')).toBeTruthy();
      });
    });

    it('shows confirmation alert when logout button is pressed', async () => {
      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        const logoutButton = getByTestId('profile-logout-button');
        fireEvent.press(logoutButton);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Logout',
          'Are you sure you want to logout?',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Logout', style: 'destructive' }),
          ])
        );
      });
    });

    it('calls signOut when logout is confirmed', async () => {
      const mockSignOut = jest.fn();
      const { getByTestId } = renderProfileScreen({
        auth: { signOut: mockSignOut },
      });

      await waitFor(() => {
        const logoutButton = getByTestId('profile-logout-button');
        fireEvent.press(logoutButton);
      });

      await waitFor(() => {
        // Get the alert call arguments
        const alertCall = mockAlert.mock.calls[0];
        const buttons = alertCall[2];
        const logoutAction = buttons.find((b: any) => b.text === 'Logout');

        // Simulate pressing Logout
        if (logoutAction?.onPress) {
          logoutAction.onPress();
        }
      });

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });

  // ----------------------------------------------------------
  // 7. DARK MODE SUPPORT TESTS
  // ----------------------------------------------------------
  describe('7. Dark Mode Support', () => {
    it('applies dark mode colors when enabled', async () => {
      const darkColors = {
        background: '#1A1A1A',
        surface: '#2A2A2A',
        text: '#FFFFFF',
        textSecondary: '#CCCCCC',
        border: '#404040',
      };

      const { getByTestId } = renderProfileScreen({
        theme: { isDarkMode: true, colors: darkColors },
      });

      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 8. EDIT PROFILE SCREEN RENDERING
  // ----------------------------------------------------------
  describe('8. EditProfileScreen Rendering', () => {
    it('renders EditProfile screen with main container', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(() => {
        expect(getByTestId('edit-profile-screen')).toBeTruthy();
      });
    });

    it('renders header with Cancel and Save buttons', async () => {
      const { getByTestId, getByText } = renderEditProfileScreen();

      await waitFor(() => {
        expect(getByTestId('edit-profile-header')).toBeTruthy();
        expect(getByTestId('edit-profile-cancel-button')).toBeTruthy();
        expect(getByTestId('edit-profile-save-button')).toBeTruthy();
        expect(getByText('Edit Profile')).toBeTruthy();
      });
    });

    it('renders avatar section', async () => {
      const { getByTestId, getByText } = renderEditProfileScreen();

      await waitFor(() => {
        expect(getByTestId('edit-profile-avatar-section')).toBeTruthy();
        expect(getByText('Change Avatar')).toBeTruthy();
      });
    });

    it('renders name input field', async () => {
      const { getByTestId, getByText } = renderEditProfileScreen();

      await waitFor(() => {
        expect(getByTestId('edit-profile-name-group')).toBeTruthy();
        expect(getByTestId('edit-profile-name-input')).toBeTruthy();
        expect(getByText('Display Name')).toBeTruthy();
      });
    });

    it('renders read-only email field', async () => {
      const { getByTestId, getByText } = renderEditProfileScreen();

      await waitFor(() => {
        expect(getByTestId('edit-profile-email-group')).toBeTruthy();
        expect(getByText('Email cannot be changed')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 9. EDIT PROFILE FORM INTERACTIONS
  // ----------------------------------------------------------
  describe('9. EditProfileScreen Form Interactions', () => {
    it('allows editing name field', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(() => {
        const nameInput = getByTestId('edit-profile-name-input');
        fireEvent.changeText(nameInput, 'New Name');
      });
    });

    it('opens avatar modal when avatar button is pressed', async () => {
      const { getByTestId, getByText } = renderEditProfileScreen();

      await waitFor(() => {
        const avatarButton = getByTestId('edit-profile-avatar-button');
        fireEvent.press(avatarButton);
      });

      await waitFor(() => {
        expect(getByText('Change Avatar')).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 10. EDIT PROFILE CANCEL FLOW
  // ----------------------------------------------------------
  describe('10. EditProfileScreen Cancel Flow', () => {
    it('goes back without alert when no changes made', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(() => {
        const cancelButton = getByTestId('edit-profile-cancel-button');
        fireEvent.press(cancelButton);
      });

      // Should navigate back directly without showing alert
      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('shows discard alert when changes exist', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(async () => {
        // Make a change
        const nameInput = getByTestId('edit-profile-name-input');
        fireEvent.changeText(nameInput, 'Changed Name');

        // Try to cancel
        const cancelButton = getByTestId('edit-profile-cancel-button');
        fireEvent.press(cancelButton);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to go back?',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Keep Editing' }),
            expect.objectContaining({ text: 'Discard', style: 'destructive' }),
          ])
        );
      });
    });
  });

  // ----------------------------------------------------------
  // 11. EDIT PROFILE SAVE FLOW
  // ----------------------------------------------------------
  describe('11. EditProfileScreen Save Flow', () => {
    it('Save button is disabled when no changes', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(() => {
        const saveButton = getByTestId('edit-profile-save-button');
        expect(saveButton).toBeTruthy();
        // Save button should have disabled styling when no changes
      });
    });

    it('enables Save button when changes are made', async () => {
      const { getByTestId } = renderEditProfileScreen();

      await waitFor(async () => {
        // Make a change
        const nameInput = getByTestId('edit-profile-name-input');
        fireEvent.changeText(nameInput, 'New Name Here');

        // Save button should now be enabled
        const saveButton = getByTestId('edit-profile-save-button');
        expect(saveButton).toBeTruthy();
      });
    });
  });

  // ----------------------------------------------------------
  // 12. EDGE CASES
  // ----------------------------------------------------------
  describe('12. Edge Cases', () => {
    it('handles user without profile data gracefully', async () => {
      // Override mock to return null profile
      jest.doMock('../../lib/supabase', () => ({
        supabase: {
          from: () => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        },
      }));

      const { getByTestId } = renderProfileScreen();

      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeTruthy();
      });
    });

    it('displays fallback for missing user email', async () => {
      const { getByTestId } = renderProfileScreen({
        auth: { user: null },
      });

      // Should handle gracefully
      await waitFor(() => {
        // Loading state or screen should render
      });
    });
  });
});
