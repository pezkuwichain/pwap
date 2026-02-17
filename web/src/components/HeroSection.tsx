import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Shield } from 'lucide-react';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { useWallet } from '../contexts/WalletContext'; // Import useWallet
import { formatBalance } from '@pezkuwi/lib/wallet';
import { getTrustScore } from '@pezkuwi/lib/scores';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { api, isApiReady, peopleApi } = usePezkuwi();
  const { selectedAccount } = useWallet(); // Use selectedAccount from WalletContext
  const [stats, setStats] = useState({
    activeProposals: 0,
    totalVoters: 0,
    tokensStaked: '0',
    trustScore: null as number | null
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!api || !isApiReady) return;

      let currentTrustScore: number | null = null; // null = not logged in
      if (selectedAccount?.address) {
        try {
          // Use frontend fallback for trust score
          if (peopleApi) {
            currentTrustScore = await getTrustScore(peopleApi, selectedAccount.address);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch trust score:', err);
          currentTrustScore = 0;
        }
      }

      try {
        // Fetch active (ongoing) referenda only
        let activeProposals = 0;
        try {
          const entries = await api.query.referenda.referendumInfoFor.entries();
          activeProposals = entries.filter(([, info]) => {
            const data = info.toJSON();
            return data && typeof data === 'object' && 'ongoing' in data;
          }).length;
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch referenda:', err);
        }

        // Fetch total staked tokens
        let tokensStaked = '0';
        try {
          const currentEra = await api.query.staking.currentEra();
          if (currentEra.isSome) {
            const eraIndex = currentEra.unwrap().toNumber();
            const totalStake = await api.query.staking.erasTotalStake(eraIndex);
            const formatted = formatBalance(totalStake.toString());
            const [whole, frac] = formatted.split('.');
            const formattedWhole = Number(whole).toLocaleString();
            const formattedFrac = (frac || '00').slice(0, 2);
            tokensStaked = `${formattedWhole}.${formattedFrac} HEZ`;
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch total stake:', err);
        }

        // Count total voters from conviction voting
        let totalVoters = 0;
        try {
          // Get all voting keys and count unique voters
          const votingKeys = await api.query.convictionVoting.votingFor.keys();
          // Each key represents a unique (account, track) pair
          // Count unique accounts
          const uniqueAccounts = new Set(votingKeys.map(key => key.args[0].toString()));
          totalVoters = uniqueAccounts.size;
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to fetch voters:', err);
        }

        // Update stats
        setStats({
          activeProposals,
          totalVoters,
          tokensStaked,
          trustScore: currentTrustScore
        });

        if (import.meta.env.DEV) console.log('✅ Hero stats updated:', {
          activeProposals,
          totalVoters,
          tokensStaked,
          trustScore: currentTrustScore
        });
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to fetch hero stats:', error);
      }
    };

    fetchStats();
  }, [api, isApiReady, peopleApi, selectedAccount]); // Add peopleApi to dependencies

  return (
    <section className="relative min-h-screen flex items-center justify-start overflow-hidden bg-gray-950">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/DKstate.png"
          alt="DKstate Background"
          className="hidden md:block w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-600/20 via-gray-950/70 to-gray-950"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full text-center">
        <div className="mb-8 inline-flex items-center px-4 py-2 rounded-full bg-green-600/20 backdrop-blur-sm border border-green-500/30">
          <Shield className="w-4 h-4 text-yellow-400 mr-2" />
          <span className="text-yellow-400 text-sm font-medium">Digital Kurdistan State v1.0</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent px-4">
          PezkuwiChain
        </h1>

        <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto px-4">
          {t('hero.title', 'Blockchain Governance Platform')}
        </p>
        <p className="text-base sm:text-lg text-gray-400 mb-12 max-w-2xl mx-auto px-4">
          {t('hero.subtitle', 'Democratic and transparent governance with blockchain technology')}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-12 max-w-5xl mx-auto px-4">
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-green-500/40 p-4 sm:p-6 hover:border-green-400/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-green-400 mb-2">{stats.activeProposals}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.activeProposals', 'Active Proposals')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-yellow-400/40 p-4 sm:p-6 hover:border-yellow-400/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-yellow-400 mb-2">{stats.totalVoters.toLocaleString()}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.totalVoters', 'Total Voters')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-red-500/40 p-4 sm:p-6 hover:border-red-500/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-red-400 mb-2 truncate">{stats.tokensStaked}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.tokensStaked', 'Tokens Staked')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-green-500/40 p-4 sm:p-6 hover:border-green-500/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-green-400 mb-2">{stats.trustScore !== null ? stats.trustScore : t('hero.stats.loginToSee', 'Login')}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.trustScore', 'Trust Score')}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
          <button
            onClick={() => document.getElementById('governance')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-gradient-to-r from-green-500 via-yellow-400 to-yellow-500 text-gray-900 font-bold rounded-lg hover:shadow-lg hover:shadow-yellow-400/50 transition-all transform hover:scale-105 flex items-center justify-center group"
          >
            {t('hero.exploreGovernance', 'Explore Governance')}
            <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById('governance')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-gray-900/80 backdrop-blur-sm text-white font-semibold rounded-lg border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-all"
          >
            {t('hero.learnMore', 'Learn More')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
