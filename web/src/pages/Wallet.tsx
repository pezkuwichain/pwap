import React from 'react';
import Layout from '@/components/Layout';
import { ArrowUpRight, ArrowDownLeft, Send, QrCode } from 'lucide-react';

const Wallet: React.FC = () => {
  const isConnected = false; // Mock connection status

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-green-400">Web Wallet</h1>
          {!isConnected && (
            <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              Connect Wallet
            </button>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-2xl font-bold mb-4">My Balance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <img src="/hez_logo_kurdistangunesi.png" alt="HEZ" className="w-10 h-10" />
              <div>
                <p className="text-gray-400">HEZ</p>
                <p className="text-xl font-bold">1,234.56</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
               <img src="/pez_logo.jpg" alt="PEZ" className="w-10 h-10" />
              <div>
                <p className="text-gray-400">PEZ</p>
                <p className="text-xl font-bold">5,000.00</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <img src="/usdt(hez)logo.png" alt="wHEZ" className="w-10 h-10" />
              <div>
                <p className="text-gray-400">wHEZ</p>
                <p className="text-xl font-bold">100.00</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-4 mt-6">
            <button className="flex items-center justify-center w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
              <Send className="mr-2" size={20} /> Send
            </button>
            <button className="flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
              <QrCode className="mr-2" size={20} /> Receive
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-red-500/20 p-2 rounded-full mr-4">
                  <ArrowUpRight className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="font-semibold">Sent HEZ</p>
                  <p className="text-sm text-gray-400">To: 5FHne...w1s</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">-10.00 HEZ</p>
                <p className="text-sm text-gray-400">3 hours ago</p>
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-green-500/20 p-2 rounded-full mr-4">
                  <ArrowDownLeft className="text-green-400" size={20} />
                </div>
                <div>
                  <p className="font-semibold">Received PEZ</p>
                  <p className="text-sm text-gray-400">From: 5Grwva...c1s</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">+50.00 PEZ</p>
                <p className="text-sm text-gray-400">1 day ago</p>
              </div>
            </div>
             <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-red-500/20 p-2 rounded-full mr-4">
                  <ArrowUpRight className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="font-semibold">Sent wHEZ</p>
                  <p className="text-sm text-gray-400">To: 5E5s3...e3s</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">-5.00 wHEZ</p>
                <p className="text-sm text-gray-400">2 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Wallet;
