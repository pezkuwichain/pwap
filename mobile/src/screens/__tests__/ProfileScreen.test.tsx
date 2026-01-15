import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../../contexts/PezkuwiContext';
import ProfileScreen from '../ProfileScreen';

const ProfileScreenWrapper = () => (
  <PezkuwiProvider>
    <ProfileScreen />
  </PezkuwiProvider>
);

describe('ProfileScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<ProfileScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<ProfileScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
