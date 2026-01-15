import React from 'react';
import { render } from '@testing-library/react-native';
import { BiometricAuthProvider } from '../../contexts/BiometricAuthContext';
import LockScreen from '../LockScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const LockScreenWrapper = () => (
  <BiometricAuthProvider>
    <LockScreen />
  </BiometricAuthProvider>
);

describe('LockScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<LockScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<LockScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
