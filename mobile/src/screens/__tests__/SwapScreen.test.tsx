import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import SwapScreen from '../SwapScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const SwapScreenWrapper = () => (
  <PezkuwiProvider>
    <SwapScreen />
  </PezkuwiProvider>
);

describe('SwapScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<SwapScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<SwapScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('should display swap interface', () => {
    const { UNSAFE_root } = render(<SwapScreenWrapper />);
    expect(UNSAFE_root).toBeDefined();
  });
});
