import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import BeCitizenScreen from '../BeCitizenScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const BeCitizenScreenWrapper = () => (
  <PezkuwiProvider>
    <BeCitizenScreen />
  </PezkuwiProvider>
);

describe('BeCitizenScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<BeCitizenScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<BeCitizenScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
