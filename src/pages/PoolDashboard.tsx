import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PoolDashboard from '@/components/PoolDashboard';

const PoolDashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-12">
      <div className="container mx-auto px-4 py-8 relative">
        <button
          onClick={() => navigate('/wallet')}
          className="absolute top-4 left-4 text-red-500 hover:text-red-400 transition-colors flex items-center gap-2 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Wallet</span>
        </button>
        <PoolDashboard />
      </div>
    </div>
  );
};

export default PoolDashboardPage;
