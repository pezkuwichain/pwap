import React from 'react';
import { render } from '@testing-library/react-native';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import WalletScreen from '../WalletScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const WalletScreenWrapper = () => (
  <LanguageProvider>
    <PezkuwiProvider>
      <WalletScreen />
    </PezkuwiProvider>
  </LanguageProvider>
);

describe('WalletScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<WalletScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<WalletScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
