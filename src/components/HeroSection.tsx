import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Cpu, GitBranch, Shield } from 'lucide-react';
import { NetworkStats } from './NetworkStats';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex items-center justify-start overflow-hidden bg-gray-950">
      {/* Kurdish Flag Background */}
      <div className="absolute inset-0">
        <img
          src="https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760373625599_6626c9cb.webp"
          alt="Kurdish Flag"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-600/20 via-gray-950/70 to-gray-950"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full text-center">
        <div className="mb-8 inline-flex items-center px-4 py-2 rounded-full bg-green-600/20 backdrop-blur-sm border border-green-500/30">
          <Shield className="w-4 h-4 text-yellow-400 mr-2" />
          <span className="text-yellow-400 text-sm font-medium">Substrate Parachain v1.0</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">
          PezkuwiChain
        </h1>

        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
          {t('hero.title')}
        </p>
        <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
          {t('hero.subtitle')}
        </p>

        {/* Live Network Stats */}
        <div className="mb-12">
          <NetworkStats />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-green-500/30 p-4">
            <div className="text-2xl font-bold text-green-400">127</div>
            <div className="text-sm text-gray-400">{t('hero.stats.activeProposals')}</div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-yellow-400/30 p-4">
            <div className="text-2xl font-bold text-yellow-400">3,482</div>
            <div className="text-sm text-gray-400">{t('hero.stats.totalVoters')}</div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-red-500/30 p-4">
            <div className="text-2xl font-bold text-red-400">2.1M</div>
            <div className="text-sm text-gray-400">{t('hero.stats.tokensStaked')}</div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-green-500/30 p-4">
            <div className="text-2xl font-bold text-green-400">95%</div>
            <div className="text-sm text-gray-400">{t('hero.stats.trustScore')}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => document.getElementById('governance')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-yellow-400 text-white font-semibold rounded-lg hover:from-green-700 hover:to-yellow-500 transition-all transform hover:scale-105 flex items-center justify-center group"
          >
            {t('hero.exploreGovernance')}
            <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById('identity')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-gray-900/50 backdrop-blur-sm text-white font-semibold rounded-lg border border-red-500/50 hover:bg-red-500/10 transition-all"
          >
            {t('hero.learnMore')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
