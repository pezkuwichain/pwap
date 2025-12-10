import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Clock, Send } from 'lucide-react';

const Faucet: React.FC = () => {
  const [address, setAddress] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [token, setToken] = useState('HEZ');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRequest = () => {
    // Mock request logic
    if (address) {
      console.log(`Requesting ${token} for address:`, address);
      setCooldown(300); // 5 minutes cooldown
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  const recentDistributions = [
      { token: 'HEZ', address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', txHash: '0xabcde...', time: '2 minutes ago' },
      { token: 'PEZ', address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', txHash: '0x12345...', time: '5 minutes ago' },
      { token: 'wHEZ', address: '5DAAn...c1s', txHash: '0x789ab...', time: '15 minutes ago' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white flex flex-col items-center">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-2 text-yellow-400">Testnet Faucet</h1>
          <p className="text-gray-400 mb-8">Get testnet tokens to build and test your dApps on PezkuwiChain.</p>

          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            <div className="flex mb-4">
               <select 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="p-3 rounded-l-lg bg-gray-700 text-white focus:outline-none"
                >
                <option>HEZ</option>
                <option>PEZ</option>
                <option>wHEZ</option>
              </select>
              <input
                type="text"
                placeholder="Enter your wallet address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 bg-gray-700 text-white focus:outline-none rounded-r-lg"
              />
            </div>
            
            <button 
              onClick={handleRequest}
              disabled={cooldown > 0 || !address}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {cooldown > 0 ? (
                <>
                  <Clock className="mr-2" size={20} />
                  <span>Wait for {formatTime(cooldown)}</span>
                </>
              ) : (
                <>
                  <Send className="mr-2" size={20} />
                  <span>Request Tokens</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-12 w-full">
            <h2 className="text-2xl font-bold mb-4 text-left">Recent Distributions</h2>
            <div className="space-y-3">
              {recentDistributions.map((dist, index) => (
                <div key={index} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center text-sm">
                  <div className="flex flex-col text-left">
                    <span><span className="font-bold text-yellow-400">{dist.token}</span> sent to <span className="font-mono text-gray-300">{dist.address.substring(0, 12)}...</span></span>
                     <span className="font-mono text-xs text-gray-500">{dist.txHash}</span>
                  </div>
                  <span className="text-gray-400">{dist.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Faucet;
