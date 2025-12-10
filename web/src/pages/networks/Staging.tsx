import React from 'react';
import NetworkPage from './NetworkPage';

const Staging: React.FC = () => {
  return (
    <NetworkPage
      id="staging"
      name="Staging Network"
      type="Development"
      description="Pre-production environment for final testing before mainnet deployment"
      endpoint="wss://staging.pezkuwichain.io"
      chainId="pezkuwichain-staging"
      validators={14}
      features={[
        'Pre-Production Testing',
        'Runtime Upgrades',
        'Feature Validation',
        'Security Audits',
        'Stress Testing',
        'Migration Testing'
      ]}
      color="from-purple-600 to-purple-800"
      status="coming-soon"
      blockTime="~6s"
      finality="~12s"
      consensus="TNPoS"
    />
  );
};

export default Staging;
