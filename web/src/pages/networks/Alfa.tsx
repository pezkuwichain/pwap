import React from 'react';
import NetworkPage from './NetworkPage';

const Alfa: React.FC = () => {
  return (
    <NetworkPage
      id="alfa"
      name="Alfa Testnet"
      type="Development"
      description="Early-stage testing network for experimental features and internal testing"
      endpoint="wss://alfa.pezkuwichain.io"
      chainId="pezkuwichain-alfa"
      validators={5}
      features={[
        'Experimental Features',
        'Early Access',
        'Internal Testing',
        'Rapid Changes',
        'Developer Preview',
        'Unstable'
      ]}
      color="from-red-600 to-red-800"
      status="coming-soon"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Alfa;
