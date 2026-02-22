import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, ArrowRightLeft } from 'lucide-react';

const TokenomicsSection: React.FC = () => {
  const { t } = useTranslation();
  const [selectedToken, setSelectedToken] = useState<'PEZ' | 'HEZ'>('PEZ');
  const [monthsPassed] = useState(0);
  
  const halvingPeriod = Math.floor(monthsPassed / 48);
  //const _monthsUntilNextHalving = 48 - (monthsPassed % 48);
  
  useEffect(() => {
    const baseAmount = selectedToken === 'PEZ' ? 74218750 : 37109375;
    // Calculate release amount for future use
    const releaseAmount = baseAmount / Math.pow(2, halvingPeriod);
    if (import.meta.env.DEV) console.log('Release amount:', releaseAmount);
  }, [monthsPassed, halvingPeriod, selectedToken]);

  const pezDistribution = [
    { name: t('tokenomics.treasury'), percentage: 96.25, amount: 4812500000, color: 'from-purple-500 to-purple-600' },
    { name: t('tokenomics.presale'), percentage: 1.875, amount: 93750000, color: 'from-cyan-500 to-cyan-600' },
    { name: t('tokenomics.founder'), percentage: 1.875, amount: 93750000, color: 'from-teal-500 to-teal-600' }
  ];

  const hezDistribution = [
    { name: t('tokenomics.stakingRewards'), percentage: 40, amount: 1000000000, color: 'from-yellow-500 to-orange-600' },
    { name: t('tokenomics.governance'), percentage: 30, amount: 750000000, color: 'from-green-500 to-emerald-600' },
    { name: t('tokenomics.ecosystem'), percentage: 20, amount: 500000000, color: 'from-blue-500 to-indigo-600' },
    { name: t('tokenomics.team'), percentage: 10, amount: 250000000, color: 'from-red-500 to-pink-600' }
  ];

  const distribution = selectedToken === 'PEZ' ? pezDistribution : hezDistribution;
  const totalSupply = selectedToken === 'PEZ' ? 5000000000 : 2500000000;
  const tokenColor = selectedToken === 'PEZ' ? 'purple' : 'yellow';

  return (
    <section id="tokenomics" className="py-20 bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
            {t('tokenomics.dualToken')}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-6">
            {t('tokenomics.dualTokenDesc')}
          </p>
          
          {/* Token Selector */}
          <div className="inline-flex bg-gray-950/50 rounded-lg p-1 border border-gray-800">
            <button
              onClick={() => setSelectedToken('PEZ')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                selectedToken === 'PEZ' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('tokenomics.pezToken')}
            </button>
            <button
              onClick={() => setSelectedToken('HEZ')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                selectedToken === 'HEZ'
                  ? 'bg-yellow-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('tokenomics.hezToken')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Distribution Chart */}
          <div className="bg-gray-950/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
            <div className="flex items-center mb-6">
              <PieChart className={`w-6 h-6 text-${tokenColor}-400 mr-3`} />
              <h3 className="text-xl font-semibold text-white">{t('tokenomics.pezDistribution')}</h3>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className={`w-48 h-48 rounded-full bg-gradient-to-br from-${tokenColor}-500 to-${tokenColor}-700 flex items-center justify-center`}>
                <span className="text-white text-3xl font-bold">{selectedToken}</span>
              </div>
            </div>

            <div className="space-y-3">
              {distribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${item.color} mr-3`}></div>
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{item.percentage}%</div>
                    <div className="text-gray-500 text-sm">{item.amount.toLocaleString()} {selectedToken}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-6 p-4 bg-${tokenColor}-500/20 rounded-lg border border-${tokenColor}-500/30`}>
              <div className="flex items-center justify-between">
                <span className={`text-${tokenColor}-400`}>{t('tokenomics.totalSupply')}</span>
                <span className="text-white font-bold">{totalSupply.toLocaleString()} {selectedToken}</span>
              </div>
            </div>
          </div>

          {/* Token Features */}
          <div className="bg-gray-950/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
            <div className="flex items-center mb-6">
              <ArrowRightLeft className={`w-6 h-6 text-${tokenColor}-400 mr-3`} />
              <h3 className="text-xl font-semibold text-white">{t('tokenomics.hezFeatures')}</h3>
            </div>

            {selectedToken === 'PEZ' ? (
              <div className="space-y-4">
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <h4 className="text-purple-400 font-semibold mb-2">{t('tokenomics.govToken')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.govTokenDesc')}</p>
                </div>
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <h4 className="text-purple-400 font-semibold mb-2">{t('tokenomics.stakingRewardsTitle')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.stakingRewardsDesc')}</p>
                </div>
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <h4 className="text-purple-400 font-semibold mb-2">{t('tokenomics.treasuryAccess')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.treasuryAccessDesc')}</p>
                </div>
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <h4 className="text-purple-400 font-semibold mb-2">{t('tokenomics.deflationary')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.deflationaryDesc')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                  <h4 className="text-yellow-400 font-semibold mb-2">{t('tokenomics.utilityToken')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.utilityTokenDesc')}</p>
                </div>
                <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                  <h4 className="text-yellow-400 font-semibold mb-2">{t('tokenomics.p2pTrading')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.p2pTradingDesc')}</p>
                </div>
                <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                  <h4 className="text-yellow-400 font-semibold mb-2">{t('tokenomics.feeDiscounts')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.feeDiscountsDesc')}</p>
                </div>
                <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                  <h4 className="text-yellow-400 font-semibold mb-2">{t('tokenomics.rewardDistribution')}</h4>
                  <p className="text-gray-300 text-sm">{t('tokenomics.rewardDistributionDesc')}</p>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/20 to-yellow-900/20 rounded-lg border border-gray-700">
              <h4 className="text-white font-semibold mb-3">{t('tokenomics.tokenSynergy')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                  {t('tokenomics.synergy1')}
                </div>
                <div className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                  {t('tokenomics.synergy2')}
                </div>
                <div className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  {t('tokenomics.synergy3')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TokenomicsSection;