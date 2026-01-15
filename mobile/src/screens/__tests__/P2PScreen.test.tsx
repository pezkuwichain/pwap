import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import P2PScreen from '../P2PScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Wrapper with required providers
const P2PScreenWrapper = () => (
  <PezkuwiProvider>
    <P2PScreen />
  </PezkuwiProvider>
);

describe('P2PScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<P2PScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<P2PScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
