import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '../../contexts/AuthContext';
import SignUpScreen from '../SignUpScreen';

// Wrapper with required providers
const SignUpScreenWrapper = () => (
  <AuthProvider>
    <SignUpScreen />
  </AuthProvider>
);

describe('SignUpScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<SignUpScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<SignUpScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
