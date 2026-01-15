import React from 'react';
import { render } from '@testing-library/react-native';
import { BiometricAuthProvider } from '../../contexts/BiometricAuthContext';
import SecurityScreen from '../SecurityScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const SecurityScreenWrapper = () => (
  <BiometricAuthProvider>
    <SecurityScreen />
  </BiometricAuthProvider>
);

describe('SecurityScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<SecurityScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<SecurityScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
