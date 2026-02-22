import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@/contexts/WalletContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TokenSwap from '@/components/TokenSwap';
import PoolDashboard from '@/components/PoolDashboard';
import { CreatePoolModal } from './CreatePoolModal';
import { InitializeHezPoolModal } from './InitializeHezPoolModal';
import { InitializeUsdtModal } from './InitializeUsdtModal';
import { MintAssetModal } from './MintAssetModal';
import { MINTABLE_ASSETS, type AssetConfig } from './mintableAssets';
import { XCMConfigurationWizard } from '@/components/admin/XCMConfigurationWizard';
import { ArrowRightLeft, Droplet, Settings } from 'lucide-react';
import { isFounderWallet } from '@pezkuwi/utils/auth';

// DEX Dashboard - Asset Hub API migration complete
export const DEXDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { account } = useWallet();
  const { sudoKey } = usePezkuwi();
  const [activeTab, setActiveTab] = useState('swap');

  // Admin modal states
  const [showCreatePoolModal, setShowCreatePoolModal] = useState(false);
  const [showInitializeHezPoolModal, setShowInitializeHezPoolModal] = useState(false);
  const [showInitializeUsdtModal, setShowInitializeUsdtModal] = useState(false);
  const [showXcmBridgeModal, setShowXcmBridgeModal] = useState(false);

  // Generic mint modal state
  const [mintModalAsset, setMintModalAsset] = useState<AssetConfig | null>(null);

  const isFounder = account ? isFounderWallet(account, sudoKey) : false;

  const handleCreatePool = () => {
    setShowCreatePoolModal(true);
  };

  const handleModalClose = () => {
    setShowCreatePoolModal(false);
    setShowInitializeHezPoolModal(false);
    setShowInitializeUsdtModal(false);
    setShowXcmBridgeModal(false);
    setMintModalAsset(null);
  };

  const handleSuccess = async () => {
    // Pool modals will refresh their own data
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900/30 via-yellow-900/30 to-red-900/30 border-b border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 bg-clip-text text-transparent">
            {t('dex.title')}
          </h1>
          <p className="text-gray-400 text-lg">
            {t('dex.description')}
          </p>

          {/* Wallet status */}
          {account && (
            <div className="mt-4 flex items-center gap-4">
              <div className="px-4 py-2 bg-gray-900/80 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400">{t('dex.connected')} </span>
                <span className="text-sm font-mono text-white">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
              {isFounder && (
                <div className="px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg">
                  <span className="text-xs text-green-400 font-semibold">
                    {t('dex.founderAccess')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!account ? (
          <div className="text-center py-12">
            <div className="mb-4 text-gray-400 text-lg">
              {t('dex.connectWallet')}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${isFounder ? 'grid-cols-3' : 'grid-cols-2'} gap-2 bg-gray-900/50 p-1 rounded-lg mb-8`}>
              <TabsTrigger value="swap" className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('dex.tabs.swap')}</span>
              </TabsTrigger>
              <TabsTrigger value="pools" className="flex items-center gap-2">
                <Droplet className="w-4 h-4" />
                <span className="hidden sm:inline">{t('dex.tabs.pools')}</span>
              </TabsTrigger>
              {isFounder && (
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('dex.tabs.admin')}</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="swap" className="mt-6">
              <TokenSwap />
            </TabsContent>

            <TabsContent value="pools" className="mt-6">
              <PoolDashboard />
            </TabsContent>

            {isFounder && (
              <TabsContent value="admin" className="mt-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="p-6 bg-gray-900 border border-blue-900/30 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-2">{t('dex.admin.tokenWrapping')}</h3>
                    <p className="text-gray-400 mb-6">
                      {t('dex.admin.tokenWrappingDesc')}
                    </p>
                    <button
                      onClick={() => setShowInitializeHezPoolModal(true)}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {t('dex.admin.wrapHez')}
                    </button>
                  </div>

                  {/* Token Minting Section */}
                  <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-2">{t('dex.admin.tokenMinting')}</h3>
                    <p className="text-gray-400 mb-6">
                      {t('dex.admin.tokenMintingDesc')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button
                        onClick={() => setShowInitializeUsdtModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <img src="/tokens/USDT.png" alt="USDT" className="w-5 h-5 rounded-full" />
                        {t('dex.admin.mintToken', { symbol: 'wUSDT' })}
                      </button>
                      <button
                        onClick={() => setMintModalAsset(MINTABLE_ASSETS.wDOT)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <img src="/tokens/DOT.png" alt="DOT" className="w-5 h-5 rounded-full" />
                        {t('dex.admin.mintToken', { symbol: 'wDOT' })}
                      </button>
                      <button
                        onClick={() => setMintModalAsset(MINTABLE_ASSETS.wETH)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <img src="/tokens/ETH.png" alt="ETH" className="w-5 h-5 rounded-full" />
                        {t('dex.admin.mintToken', { symbol: 'wETH' })}
                      </button>
                      <button
                        onClick={() => setMintModalAsset(MINTABLE_ASSETS.wBTC)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <img src="/tokens/BTC.png" alt="BTC" className="w-5 h-5 rounded-full" />
                        {t('dex.admin.mintToken', { symbol: 'wBTC' })}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-900 border border-purple-900/30 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-2">{t('dex.admin.xcmWizard')}</h3>
                    <p className="text-gray-400 mb-6">
                      {t('dex.admin.xcmWizardDesc')}
                    </p>
                    <button
                      onClick={() => setShowXcmBridgeModal(true)}
                      className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {t('dex.admin.openXcmWizard')}
                    </button>
                  </div>

                  <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-2">{t('dex.admin.poolManagement')}</h3>
                    <p className="text-gray-400 mb-6">
                      {t('dex.admin.poolManagementDesc')}
                    </p>
                    <button
                      onClick={handleCreatePool}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {t('dex.admin.createNewPool')}
                    </button>
                  </div>

                  <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold text-white mb-2">{t('dex.admin.poolStatistics')}</h3>
                    <p className="text-gray-400 text-sm">
                      {t('dex.admin.poolStatsDesc')}
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>

      {/* Admin Modals */}
      <CreatePoolModal
        isOpen={showCreatePoolModal}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <InitializeHezPoolModal
        isOpen={showInitializeHezPoolModal}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <InitializeUsdtModal
        isOpen={showInitializeUsdtModal}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <XCMConfigurationWizard
        isOpen={showXcmBridgeModal}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      {/* Generic Mint Asset Modal */}
      {mintModalAsset && (
        <MintAssetModal
          isOpen={true}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          asset={mintModalAsset}
        />
      )}
    </div>
  );
};
