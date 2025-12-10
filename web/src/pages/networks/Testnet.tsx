import React from 'react';
import NetworkPage from './NetworkPage';

const Testnet: React.FC = () => {
  return (
    <NetworkPage
      id="testnet"
      name="Public Testnet"
      type="Development"
      description="Public testing network for community and developers to test applications"
      endpoint="wss://testnet.pezkuwichain.io"
      chainId="pezkuwichain-testnet"
      validators={10}
      features={[
        'Free Test Tokens',
        'Public Access',
        'Full Feature Set',
        'Community Testing',
        'dApp Development',
        'No Real Value'
      ]}
      color="from-cyan-600 to-cyan-800"
      status="coming-soon"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Testnet;
