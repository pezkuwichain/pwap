import React from 'react';
import NetworkPage from './NetworkPage';

const Mainnet: React.FC = () => {
  return (
    <NetworkPage
      id="mainnet"
      name="PezkuwiChain Mainnet"
      type="Live"
      description="The production PezkuwiChain network with real value transactions"
      endpoint="wss://mainnet.pezkuwichain.io"
      chainId="pezkuwichain-mainnet"
      validators={21}
      features={[
        'HEZ Native Token',
        'Production Ready',
        'Full Security',
        'Governance',
        'Staking',
        'TNPoS Consensus',
        'Identity & KYC',
        'Asset Hub'
      ]}
      color="from-green-600 to-green-800"
      status="coming-soon"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Mainnet;
