import React from 'react';
import { render } from '@testing-library/react-native';
import { PezkuwiProvider } from '../contexts/PezkuwiContext';
import NFTGalleryScreen from '../NFTGalleryScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const NFTGalleryScreenWrapper = () => (
  <PezkuwiProvider>
    <NFTGalleryScreen />
  </PezkuwiProvider>
);

describe('NFTGalleryScreen', () => {
  it('should render without crashing', () => {
    const { toJSON } = render(<NFTGalleryScreenWrapper />);
    expect(toJSON()).toBeTruthy();
  });

  it('should match snapshot', () => {
    const { toJSON } = render(<NFTGalleryScreenWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
