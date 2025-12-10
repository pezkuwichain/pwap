import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Server, Globe, TestTube, Code, Wifi, Copy, Check, ExternalLink, Compass, Book, Briefcase, FileCode, HandCoins, Users, Wrench, MessageCircle, GitFork } from 'lucide-react';

// ... (interface and const arrays remain the same) ...

interface ChainSpec {
  id: string;
  name: string;
  type: 'Live' | 'Development' | 'Local';
  icon: React.ReactNode;
  endpoint: string;
  chainId: string;
  validators: number;
  features: string[];
  color: string;
}

const chainSpecs: ChainSpec[] = [
  {
    id: 'mainnet',
    name: 'PezkuwiChain Mainnet',
    type: 'Live',
    icon: <Globe className="w-5 h-5" />,
    endpoint: 'wss://mainnet.pezkuwichain.io',
    chainId: '0x1234...abcd',
    validators: 100,
    features: ['Production', 'Real Tokenomics', 'Full Security'],
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'staging',
    name: 'PezkuwiChain Staging',
    type: 'Live',
    icon: <Server className="w-5 h-5" />,
    endpoint: 'wss://staging.pezkuwichain.io',
    chainId: '0x5678...efgh',
    validators: 20,
    features: ['Pre-production', 'Testing Features', 'Beta Access'],
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    id: 'testnet',
    name: 'Real Testnet',
    type: 'Live',
    icon: <TestTube className="w-5 h-5" />,
    endpoint: 'wss://testnet.pezkuwichain.io',
    chainId: '0x9abc...ijkl',
    validators: 8,
    features: ['Test Tokens', 'Full Features', 'Public Testing'],
    color: 'from-teal-500 to-teal-600'
  },
  {
    id: 'beta',
    name: 'Beta Testnet',
    type: 'Live',
    icon: <TestTube className="w-5 h-5" />,
    endpoint: 'wss://beta.pezkuwichain.io',
    chainId: '0xdef0...mnop',
    validators: 4,
    features: ['Experimental', 'New Features', 'Limited Access'],
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: 'alfa',
    name: 'PezkuwiChain Alfa Testnet',
    type: 'Development',
    icon: <TestTube className="w-5 h-5" />,
    endpoint: 'ws://127.0.0.1:8844',
    chainId: 'pezkuwichain_alfa_testnet',
    validators: 4,
    features: ['4 Validators', 'Staking Active', 'Full Features'],
    color: 'from-purple-500 to-pink-600'
  },
  {
    id: 'development',
    name: 'Development',
    type: 'Development',
    icon: <Code className="w-5 h-5" />,
    endpoint: 'ws://127.0.0.1:9944',
    chainId: '0xlocal...dev',
    validators: 1,
    features: ['Single Node', 'Fast Block Time', 'Dev Tools'],
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'local',
    name: 'Local Testnet',
    type: 'Local',
    icon: <Wifi className="w-5 h-5" />,
    endpoint: 'ws://127.0.0.1:9945',
    chainId: '0xlocal...test',
    validators: 2,
    features: ['Multi-node', 'Local Testing', 'Custom Config'],
    color: 'from-indigo-500 to-indigo-600'
  }
];

const subdomains = [
    { name: 'Explorer', href: '/explorer', icon: <Compass />, external: false },
    { name: 'Docs', href: '/docs', icon: <Book />, external: false },
    { name: 'Wallet', href: '/wallet', icon: <Briefcase />, external: false },
    { name: 'API', href: '/api', icon: <FileCode />, external: false },
    { name: 'Faucet', href: '/faucet', icon: <HandCoins />, external: false },
    { name: 'Developers', href: '/developers', icon: <Users />, external: false },
    { name: 'Grants', href: '/grants', icon: <Wrench />, external: false },
    { name: 'Wiki', href: '/wiki', icon: <MessageCircle />, external: false },
    { name: 'Forum', href: '/forum', icon: <GitFork />, external: false },
    { name: 'Telemetry', href: '/telemetry', icon: <Server />, external: false },
]

const ChainSpecs: React.FC = () => {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<ChainSpec>(chainSpecs[0]);
  const navigate = useNavigate();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="py-20 bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            {t('chainSpecs.title')}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {t('chainSpecs.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {chainSpecs.map((spec) => (
            <div
              key={spec.id}
              onClick={() => navigate(`/${spec.id}`)}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                selectedSpec.id === spec.id
                  ? 'bg-gray-900 border-purple-500'
                  : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${spec.color} bg-opacity-20`}>
                  {spec.icon}
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  spec.type === 'Live' ? 'bg-green-900/30 text-green-400' :
                  spec.type === 'Development' ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-blue-900/30 text-blue-400'
                }`}>
                  {spec.type}
                </span>
              </div>
              
              <h3 className="text-white font-semibold mb-2">{spec.name}</h3>
              
              <div className="flex items-center text-sm text-gray-400">
                <Server className="w-3 h-3 mr-1" />
                <span>{spec.validators} validators</span>
              </div>
            </div>
          ))}

          {/* Subdomains Box */}
            <div
              onClick={() => navigate('/subdomains')}
              className="md:col-span-2 lg:col-span-1 cursor-pointer p-4 rounded-xl border transition-all bg-gray-950/50 border-gray-800 hover:border-gray-700"
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 bg-opacity-20">
                        <Compass className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-900/30 text-gray-400">
                        {t('chainSpecs.services')}
                    </span>
                </div>
                <h3 className="text-white font-semibold mb-2">{t('chainSpecs.subdomainsTitle')}</h3>
                <div className="flex items-center text-sm text-gray-400">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    <span>{t('chainSpecs.availableServices', { count: subdomains.length })}</span>
                </div>
            </div>
        </div>

        {/* Selected Chain Details */}
        <div className="bg-gray-950/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${selectedSpec.color} bg-opacity-20 mr-3`}>
                  {selectedSpec.icon}
                </div>
                {selectedSpec.name}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm">{t('chainSpecs.websocketEndpoint')}</label>
                  <div className="flex items-center mt-1">
                    <code className="flex-1 p-3 bg-gray-900 rounded-lg text-cyan-400 font-mono text-sm">
                      {selectedSpec.endpoint}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedSpec.endpoint, `endpoint-${selectedSpec.id}`)}
                      className="ml-2 p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      {copiedId === `endpoint-${selectedSpec.id}` ? 
                        <Check className="w-5 h-5 text-green-400" /> : 
                        <Copy className="w-5 h-5" />
                      }
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">{t('chainSpecs.chainId')}</label>
                  <div className="flex items-center mt-1">
                    <code className="flex-1 p-3 bg-gray-900 rounded-lg text-purple-400 font-mono text-sm">
                      {selectedSpec.chainId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedSpec.chainId, `chainid-${selectedSpec.id}`)}
                      className="ml-2 p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      {copiedId === `chainid-${selectedSpec.id}` ? 
                        <Check className="w-5 h-5 text-green-400" /> : 
                        <Copy className="w-5 h-5" />
                      }
                    </button>
                  </div>
                </div>

                <div>
                    <button
                        onClick={() => navigate('/explorer')}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
                        >
                        <Compass className="w-4 h-4 mr-2" />
                        {t('chainSpecs.viewExplorer')}
                    </button>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">{t('chainSpecs.availableSubdomains')}</h4>
               <div className="grid grid-cols-2 gap-4">
                {subdomains.map(subdomain => (
                    <div key={subdomain.name} onClick={() => navigate(subdomain.href)} className="flex items-center p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                        <div className="mr-3 text-cyan-400">{subdomain.icon}</div>
                        <span className="font-semibold">{subdomain.name}</span>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChainSpecs;