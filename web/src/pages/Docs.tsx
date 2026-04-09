import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import Layout from '@/components/Layout';

const DOCS_URL = 'https://docs.pezkuwichain.io';

const DOC_SECTIONS = [
  {
    icon: '📄',
    titleKey: 'docs.section.whitepaper',
    title: 'Whitepaper',
    descKey: 'docs.section.whitepaper.desc',
    desc: 'The foundational document describing the PezkuwiChain vision, architecture, and tokenomics.',
    path: '/whitepaper',
    color: 'bg-green-900/30 border-green-700/40',
    iconBg: 'bg-green-800',
  },
  {
    icon: '🏛️',
    titleKey: 'docs.section.architecture',
    title: 'Architecture',
    descKey: 'docs.section.architecture.desc',
    desc: 'Technical deep-dive into the blockchain architecture, consensus, pallets, and relay chain.',
    path: '/architecture',
    color: 'bg-blue-900/30 border-blue-700/40',
    iconBg: 'bg-blue-800',
  },
  {
    icon: '🚀',
    titleKey: 'docs.section.gettingStarted',
    title: 'Getting Started',
    descKey: 'docs.section.gettingStarted.desc',
    desc: 'Set up your wallet, get test tokens from the faucet, and make your first transaction.',
    path: '/getting-started',
    color: 'bg-yellow-900/30 border-yellow-700/40',
    iconBg: 'bg-yellow-800',
  },
  {
    icon: '⚙️',
    titleKey: 'docs.section.nodeSetup',
    title: 'Node Setup',
    descKey: 'docs.section.nodeSetup.desc',
    desc: 'Run a validator or full node on PezkuwiChain mainnet, testnet or local environment.',
    path: '/node-setup',
    color: 'bg-purple-900/30 border-purple-700/40',
    iconBg: 'bg-purple-800',
  },
  {
    icon: '🛠️',
    titleKey: 'docs.section.sdk',
    title: 'SDK Reference',
    descKey: 'docs.section.sdk.desc',
    desc: 'JavaScript/TypeScript SDK for building dApps on PezkuwiChain — API reference and examples.',
    path: '/sdk',
    color: 'bg-cyan-900/30 border-cyan-700/40',
    iconBg: 'bg-cyan-800',
  },
  {
    icon: '🤝',
    titleKey: 'docs.section.contributing',
    title: 'Contributor Guide',
    descKey: 'docs.section.contributing.desc',
    desc: 'How to contribute to PezkuwiChain — code, documentation, translations, and governance.',
    path: '/contributing',
    color: 'bg-red-900/30 border-red-700/40',
    iconBg: 'bg-red-800',
  },
];

const QUICK_LINKS = [
  { label: 'Mainnet RPC', value: 'wss://rpc.pezkuwichain.io' },
  { label: 'Explorer', value: 'explorer.pezkuwichain.io', href: 'https://explorer.pezkuwichain.io' },
  { label: 'Faucet', value: 'app.pezkuwichain.io/faucet', href: '/faucet' },
  { label: 'GitHub', value: 'github.com/pezkuwichain', href: 'https://github.com/pezkuwichain' },
];

const Docs: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('docs.title', 'PezkuwiChain Documentation')}
          </h1>
          <p className="text-gray-400 text-lg">
            {t('docs.subtitle', 'Everything you need to build on the Kurdish national blockchain')}
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {QUICK_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href ?? '#'}
              target={link.href?.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="bg-gray-800 rounded-xl p-3 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <p className="text-xs text-gray-400 mb-1">{link.label}</p>
              <p className="text-xs text-green-400 font-mono truncate">{link.value}</p>
            </a>
          ))}
        </div>

        {/* Documentation Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {DOC_SECTIONS.map(section => (
            <a
              key={section.path}
              href={`${DOCS_URL}${section.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex gap-4 p-4 rounded-2xl border ${section.color} hover:opacity-90 transition-opacity cursor-pointer`}
            >
              <div className={`w-12 h-12 ${section.iconBg} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-white text-sm mb-1">
                  {t(section.titleKey, section.title)}
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t(section.descKey, section.desc)}
                </p>
              </div>
              <ExternalLink size={14} className="text-gray-500 flex-shrink-0 mt-1" />
            </a>
          ))}
        </div>

        {/* Full Docs Button */}
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">
            {t('docs.fullDocsNote', 'For complete and up-to-date documentation, visit the official documentation portal.')}
          </p>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <ExternalLink size={16} />
            {t('docs.visitFullDocs', 'Visit docs.pezkuwichain.io')}
          </a>
        </div>

      </div>
    </Layout>
  );
};

export default Docs;
