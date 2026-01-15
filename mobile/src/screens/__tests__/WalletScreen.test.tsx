import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../../contexts/PezkuwiContext';
import WalletScreen from '../WalletScreen';

const WalletScreenWrapper = () => (
  <PezkuwiProvider>
    <WalletScreen />
  </PezkuwiProvider>
);

describe('WalletScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<WalletScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should have defined structure', () => {
    const { UNSAFE_root } = render(<WalletScreenWrapper />);
    expect(UNSAFE_root).toBeDefined();
  });
});
