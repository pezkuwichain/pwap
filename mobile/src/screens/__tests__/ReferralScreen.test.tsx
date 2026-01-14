import React from 'react';
import { render } from '@testing-library/react-native';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import ReferralScreen from '../ReferralScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const ReferralScreenWrapper = () => (
  <LanguageProvider>
    <PezkuwiProvider>
      <ReferralScreen />
    </PezkuwiProvider>
  </LanguageProvider>
);

describe('ReferralScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<ReferralScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<ReferralScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
