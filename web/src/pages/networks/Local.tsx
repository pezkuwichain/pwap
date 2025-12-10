import React from 'react';
import NetworkPage from './NetworkPage';

const Local: React.FC = () => {
  return (
    <NetworkPage
      id="local"
      name="Local Testnet"
      type="Local"
      description="Run your own local PezkuwiChain node for development and testing"
      endpoint="ws://127.0.0.1:9944"
      chainId="pezkuwichain-local"
      validators={1}
      features={[
        'Local Development',
        'Instant Blocks',
        'Full Control',
        'No Network Latency',
        'Custom Genesis',
        'Unlimited Funds'
      ]}
      color="from-blue-600 to-blue-800"
      status="active"
      blockTime="Instant"
      finality="Instant"
      consensus="Dev"
    />
  );
};

export default Local;
