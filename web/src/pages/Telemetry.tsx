import React from 'react';
import Layout from '@/components/Layout';
import { CheckCircle, Zap, Server, Globe } from 'lucide-react';

const Telemetry: React.FC = () => {

  const validators = [
    { name: 'Validator A', stake: '1.2M HEZ', uptime: 99.98, status: 'Active' },
    { name: 'Validator B', stake: '1.1M HEZ', uptime: 99.95, status: 'Active' },
    { name: 'Validator C', stake: '1.0M HEZ', uptime: 99.92, status: 'Active' },
    { name: 'Validator D', stake: '0.9M HEZ', uptime: 99.80, status: 'Active' },
    { name: 'Validator E', stake: '0.8M HEZ', uptime: 100, status: 'Waiting' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <h1 className="text-4xl font-bold mb-8">Network Telemetry</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Best Finalized Block</h3>
            <p className="text-2xl font-bold">1,234,567</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Average Block Time</h3>
            <p className="text-2xl font-bold">6.0s</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Active Nodes</h3>
            <p className="text-2xl font-bold">1,234</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-400">Validators</h3>
            <p className="text-2xl font-bold">42</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              <Server className="mr-3 text-blue-400" />
              Validators
            </h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2">Name</th>
                  <th className="py-2 text-right">Total Stake</th>
                  <th className="py-2 text-right">Uptime</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {validators.map((validator, index) => (
                  <tr key={index} className="border-b border-gray-700">
                    <td className="py-3 font-semibold">{validator.name}</td>
                    <td className="py-3 text-right">{validator.stake}</td>
                    <td className="py-3 text-right">{validator.uptime}%</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${validator.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {validator.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              <Globe className="mr-3 text-green-400" />
              Node Map
            </h2>
            <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Node map visualization placeholder</p>
            </div>
             <p className="text-sm text-gray-400 mt-4">
               Note: A fully functional telemetry site already exists at <a href="https://telemetry.pezkuwichain.io/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">telemetry.pezkuwichain.io</a>.
              This page is a placeholder for a new, integrated design.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Telemetry;
