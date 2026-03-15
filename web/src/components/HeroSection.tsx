import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Shield } from 'lucide-react';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { formatBalance } from '@pezkuwi/lib/wallet';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { api, isApiReady, assetHubApi, isAssetHubReady, peopleApi, isPeopleReady } = usePezkuwi();
  const [stats, setStats] = useState({
    activeProposals: 0,
    totalVoters: 0,
    tokensStaked: '0',
    citizenCount: null as number | null
  });

  // Fetch governance stats from Relay Chain
  useEffect(() => {
    const fetchGovernanceStats = async () => {
      if (!api || !isApiReady) return;

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

      let totalVoters = 0;
      try {
        const votingKeys = await api.query.convictionVoting.votingFor.keys();
        const uniqueAccounts = new Set(votingKeys.map(key => key.args[0].toString()));
        totalVoters = uniqueAccounts.size;
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Failed to fetch voters:', err);
      }

      setStats(prev => ({ ...prev, activeProposals, totalVoters }));
    };
    fetchGovernanceStats();
  }, [api, isApiReady]);

  // Fetch staking stats from Asset Hub
  useEffect(() => {
    const fetchStakingStats = async () => {
      if (!assetHubApi || !isAssetHubReady) return;

      let tokensStaked = '0';
      try {
        // Sum active stakes from all ledger entries
        const ledgers = await assetHubApi.query.staking.ledger.entries();
        let totalActive = BigInt(0);
        for (const [, ledger] of ledgers) {
          if (!ledger.isEmpty) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (ledger as any).unwrap?.() ? (ledger as any).unwrap().toJSON() : (ledger as any).toJSON();
            totalActive += BigInt(data?.active ?? data?.total ?? '0');
          }
        }
        const formatted = formatBalance(totalActive.toString());
        const [whole, frac] = formatted.split('.');
        const formattedWhole = Number(whole).toLocaleString();
        const formattedFrac = (frac || '00').slice(0, 2);
        tokensStaked = `${formattedWhole}.${formattedFrac} HEZ`;
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Failed to fetch total stake from AH:', err);
      }

      setStats(prev => ({ ...prev, tokensStaked }));
    };
    fetchStakingStats();
  }, [assetHubApi, isAssetHubReady]);

  // Fetch citizen count from People Chain
  useEffect(() => {
    const fetchCitizenCount = async () => {
      if (!peopleApi || !isPeopleReady) return;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(peopleApi.query as any)?.tiki?.citizenNft) {
          setStats(prev => ({ ...prev, citizenCount: 0 }));
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries = await (peopleApi.query as any).tiki.citizenNft.entries();
        setStats(prev => ({ ...prev, citizenCount: entries.length }));
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Failed to fetch citizen count:', err);
        setStats(prev => ({ ...prev, citizenCount: 0 }));
      }
    };
    fetchCitizenCount();
  }, [peopleApi, isPeopleReady]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-6 mb-12 max-w-5xl mx-auto px-4">
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-green-500/40 p-3 sm:p-6 hover:border-green-400/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-green-400 mb-2">{stats.activeProposals}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.activeProposals', 'Active Proposals')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-yellow-400/40 p-3 sm:p-6 hover:border-yellow-400/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-yellow-400 mb-2">{stats.totalVoters.toLocaleString()}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.totalVoters', 'Total Voters')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-red-500/40 p-3 sm:p-6 hover:border-red-500/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-red-400 mb-2 truncate">{stats.tokensStaked}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('hero.stats.tokensStaked', 'Tokens Staked')}</div>
          </div>
          <div className="bg-gray-900/70 backdrop-blur-md rounded-xl border border-green-500/40 p-3 sm:p-6 hover:border-green-500/60 transition-all">
            <div className="text-base sm:text-2xl font-bold text-green-400 mb-2">{stats.citizenCount !== null ? stats.citizenCount.toLocaleString() : '...'}</div>
            <div className="text-xs sm:text-sm text-gray-300 font-medium">Hejmara Kurd Lê Cîhanê</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
          <button
            onClick={() => document.getElementById('governance')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-5 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-green-500 via-yellow-400 to-yellow-500 text-gray-900 font-bold rounded-lg hover:shadow-lg hover:shadow-yellow-400/50 transition-all transform hover:scale-105 flex items-center justify-center group"
          >
            {t('hero.exploreGovernance', 'Explore Governance')}
            <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById('governance')?.scrollIntoView({ behavior: 'smooth' })}
            className="hidden sm:inline-flex px-5 py-3 sm:px-8 sm:py-4 bg-gray-900/80 backdrop-blur-sm text-white font-semibold rounded-lg border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-all"
          >
            {t('hero.learnMore', 'Learn More')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
