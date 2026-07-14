import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { MultisigOperations } from '@/components/MultisigOperations';

const MultisigOperationsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-12">
      <div className="container mx-auto px-4 py-8 relative max-w-3xl">
        <button
          onClick={() => navigate('/wallet')}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('multisigOps.backToWallet')}</span>
        </button>

        <div className="pt-16">
          <MultisigOperations />
        </div>
      </div>
    </div>
  );
};

export default MultisigOperationsPage;
