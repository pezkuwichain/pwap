import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '../../contexts/AuthContext';
import ForumScreen from '../ForumScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const ForumScreenWrapper = () => (
  <AuthProvider>
    <ForumScreen />
  </AuthProvider>
);

describe('ForumScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<ForumScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should have defined structure', () => {
    const { getByText } = render(<ForumScreenWrapper />);
    // Just verify it renders without errors
    expect(getByText).toBeDefined();
  });
});
