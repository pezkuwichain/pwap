import React from 'react';
import NetworkPage from './NetworkPage';

const Beta: React.FC = () => {
  return (
    <NetworkPage
      id="beta"
      name="Beta Testnet"
      type="Development"
      description="Active development testnet with the latest features and improvements"
      endpoint="wss://rpc.pezkuwichain.io:9944"
      chainId="pezkuwichain-beta"
      validators={7}
      features={[
        'Latest Features',
        'Active Development',
        'Fast Iterations',
        'Community Access',
        'Bug Hunting',
        'Feature Feedback'
      ]}
      color="from-orange-600 to-orange-800"
      status="active"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Beta;
