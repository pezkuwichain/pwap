import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { AccountBalance } from '@/components/AccountBalance';
import { TransferModal } from '@/components/TransferModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { TransactionHistory } from '@/components/TransactionHistory';
import { NftList } from '@/components/NftList';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, History, ArrowLeft, Activity } from 'lucide-react';

const WalletDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount } = usePolkadot();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to view your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Wallet Dashboard</h1>
          <p className="text-gray-400">Manage your HEZ and PEZ tokens</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Balance */}
          <div className="lg:col-span-1">
            <AccountBalance />
          </div>

          {/* Right Column - Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Button
                onClick={() => setIsTransferModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500 h-24 flex flex-col items-center justify-center"
              >
                <ArrowUpRight className="w-6 h-6 mb-2" />
                <span>Send</span>
              </Button>

              <Button
                onClick={() => setIsReceiveModalOpen(true)}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 h-24 flex flex-col items-center justify-center"
              >
                <ArrowDownRight className="w-6 h-6 mb-2" />
                <span>Receive</span>
              </Button>

              <Button
                onClick={() => navigate('/pool')}
                variant="outline"
                className="border-blue-600 hover:bg-blue-900/20 text-blue-400 h-24 flex flex-col items-center justify-center"
              >
                <Activity className="w-6 h-6 mb-2" />
                <span>Pool</span>
              </Button>

              <Button
                onClick={() => setIsHistoryModalOpen(true)}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800 h-24 flex flex-col items-center justify-center"
              >
                <History className="w-6 h-6 mb-2" />
                <span>History</span>
              </Button>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No recent transactions</p>
                <p className="text-gray-600 text-sm mt-1">
                  Your transaction history will appear here
                </p>
                <Button
                  onClick={() => setIsHistoryModalOpen(true)}
                  variant="outline"
                  className="mt-4 border-gray-700 hover:bg-gray-800"
                >
                  View All Transactions
                </Button>
              </div>
            </div>

            {/* NFT Collection */}
            <NftList />
          </div>
        </div>
      </div>

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      <ReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
      />

      <TransactionHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
};

export default WalletDashboard;