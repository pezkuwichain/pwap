import React from 'react';
import { render } from '@testing-library/react-native';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import GovernanceScreen from '../GovernanceScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const GovernanceScreenWrapper = () => (
  <LanguageProvider>
    <PezkuwiProvider>
      <GovernanceScreen />
    </PezkuwiProvider>
  </LanguageProvider>
);

describe('GovernanceScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<GovernanceScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<GovernanceScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
