import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import EducationScreen from '../EducationScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const EducationScreenWrapper = () => (
  <PezkuwiProvider>
    <EducationScreen />
  </PezkuwiProvider>
);

describe('EducationScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<EducationScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<EducationScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
