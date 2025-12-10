import React from 'react';
import NetworkPage from './NetworkPage';

const Development: React.FC = () => {
  return (
    <NetworkPage
      id="development"
      name="Development Environment"
      type="Development"
      description="Internal development network for core team feature development"
      endpoint="wss://dev.pezkuwichain.io"
      chainId="pezkuwichain-dev"
      validators={3}
      features={[
        'Core Development',
        'Feature Prototyping',
        'Internal Only',
        'Frequent Resets',
        'Debug Mode',
        'Hot Reloading'
      ]}
      color="from-yellow-600 to-yellow-800"
      status="coming-soon"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Development;
