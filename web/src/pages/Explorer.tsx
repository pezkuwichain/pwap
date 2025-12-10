import React from 'react';
import Layout from '@/components/Layout';

const Explorer: React.FC = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-blue-400">Block Explorer</h1>
          <div className="w-full md:w-1/2 mt-4 md:mt-0">
            <input
              type="text"
              placeholder="Search by Block / Tx / Address"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Total Blocks</h3>
            <p className="text-2xl font-bold">123,456</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Transactions per Second (TPS)</h3>
            <p className="text-2xl font-bold">15</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Active Validators</h3>
            <p className="text-2xl font-bold">42</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Latest Blocks</h2>
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-bold text-blue-400">Block #123456</span>
                  <span className="text-gray-400">10 secs ago</span>
                </div>
                <div className="text-sm">
                  <span>Includes <span className="font-semibold text-green-400">5</span> transactions</span>
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-bold text-blue-400">Block #123455</span>
                  <span className="text-gray-400">25 secs ago</span>
                </div>
                <div className="text-sm">
                  <span>Includes <span className="font-semibold text-green-400">12</span> transactions</span>
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-bold text-blue-400">Block #123454</span>
                  <span className="text-gray-400">45 secs ago</span>
                </div>
                <div className="text-sm">
                  <span>Includes <span className="font-semibold text-green-400">8</span> transactions</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">Latest Transactions</h2>
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-mono text-sm text-purple-400 truncate">0xabcdef123...</span>
                  <span className="text-gray-400">12 secs ago</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">From:</span> <span className="font-mono text-xs text-gray-300">5Grwva...</span>
                  <span className="font-semibold ml-2">To:</span> <span className="font-mono text-xs text-gray-300">5FHne...</span>
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-mono text-sm text-purple-400 truncate">0x123456abc...</span>
                  <span className="text-gray-400">30 secs ago</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">From:</span> <span className="font-mono text-xs text-gray-300">5DAAn...</span>
                  <span className="font-semibold ml-2">To:</span> <span className="font-mono text-xs text-gray-300">5G6s6...</span>
                </div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-mono text-sm text-purple-400 truncate">0x7890ab123...</span>
                  <span className="text-gray-400">50 secs ago</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">From:</span> <span className="font-mono text-xs text-gray-300">5Hp2d...</span>
                  <span className="font-semibold ml-2">To:</span> <span className="font-mono text-xs text-gray-300">5E5s3...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Explorer;
