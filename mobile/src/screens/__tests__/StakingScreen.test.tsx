import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import StakingScreen from '../StakingScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const StakingScreenWrapper = () => (
  <PezkuwiProvider>
    <StakingScreen />
  </PezkuwiProvider>
);

describe('StakingScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<StakingScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<StakingScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
