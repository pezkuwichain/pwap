import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe, Book, Compass, FileCode, HandCoins, Users, Wrench, MessageCircle, Server, Activity, Zap, Database, Radio, Layers, ArrowLeft } from 'lucide-react';

interface SubdomainItem {
  name: string;
  url: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'coming-soon';
  category: 'main' | 'rpc' | 'tools';
}

const subdomainList: SubdomainItem[] = [
  // Main Services
  { name: 'Explorer', url: 'https://explorer.pezkuwichain.io', description: 'Block explorer and chain analytics', icon: <Compass className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Documentation', url: 'https://docs.pezkuwichain.io', description: 'SDK documentation and guides', icon: <Book className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Wiki', url: 'https://wiki.pezkuwichain.io', description: 'Community knowledge base', icon: <Globe className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Forum', url: 'https://forum.pezkuwichain.io', description: 'Community discussions and proposals', icon: <MessageCircle className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Faucet', url: 'https://faucet.pezkuwichain.io', description: 'Get testnet tokens for development', icon: <HandCoins className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Telemetry', url: 'https://telemetry.pezkuwichain.io', description: 'Network monitoring and node stats', icon: <Activity className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Developers', url: 'https://developers.pezkuwichain.io', description: 'Developer portal and resources', icon: <Users className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'Grants', url: 'https://grants.pezkuwichain.io', description: 'Ecosystem grants program', icon: <Wrench className="w-6 h-6" />, status: 'active', category: 'main' },
  { name: 'API', url: 'https://api.pezkuwichain.io', description: 'REST API for chain data', icon: <FileCode className="w-6 h-6" />, status: 'active', category: 'main' },

  // RPC Endpoints
  { name: 'Pezkuwi RPC', url: 'https://pezkuwichain-rpc.pezkuwichain.io', description: 'Primary mainnet RPC endpoint', icon: <Radio className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Beta RPC', url: 'https://beta-rpc.pezkuwichain.io', description: 'Beta testnet RPC endpoint', icon: <Zap className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Zagros Network', url: 'https://zagros.pezkuwichain.io', description: 'Zagros canary network', icon: <Globe className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Zagros RPC', url: 'https://zagros-rpc.pezkuwichain.io', description: 'Zagros relay chain RPC', icon: <Radio className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Asset Hub RPC', url: 'https://zagros-asset-hub-rpc.pezkuwichain.io', description: 'Zagros Asset Hub parachain RPC', icon: <Database className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Bridge Hub RPC', url: 'https://zagros-bridge-hub-rpc.pezkuwichain.io', description: 'Zagros Bridge Hub parachain RPC', icon: <Layers className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Collectives RPC', url: 'https://zagros-collectives-rpc.pezkuwichain.io', description: 'Zagros Collectives parachain RPC', icon: <Users className="w-6 h-6" />, status: 'active', category: 'rpc' },
  { name: 'Coretime RPC', url: 'https://zagros-coretime-rpc.pezkuwichain.io', description: 'Zagros Coretime parachain RPC', icon: <Server className="w-6 h-6" />, status: 'active', category: 'rpc' },

  // Tools
  { name: 'Try Runtime', url: 'https://try-runtime.pezkuwichain.io', description: 'Test runtime upgrades safely', icon: <Zap className="w-6 h-6" />, status: 'active', category: 'tools' },
  { name: 'Try Runtime Zagros', url: 'https://try-runtime-zagros.pezkuwichain.io', description: 'Test runtime on Zagros canary', icon: <Zap className="w-6 h-6" />, status: 'active', category: 'tools' },
  { name: 'Network Wiki', url: 'https://wiki.network.pezkuwichain.io', description: 'Technical network documentation', icon: <Book className="w-6 h-6" />, status: 'active', category: 'tools' },
];

const Subdomains: React.FC = () => {
  useTranslation();
  const navigate = useNavigate();

  const mainServices = subdomainList.filter(s => s.category === 'main');
  const rpcEndpoints = subdomainList.filter(s => s.category === 'rpc');
  const tools = subdomainList.filter(s => s.category === 'tools');

  const renderCard = (item: SubdomainItem) => (
    <a
      key={item.name}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-green-500/50 hover:bg-gray-900 transition-all duration-300"
    >
      <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-cyan-500/20 text-green-400 group-hover:from-green-500/30 group-hover:to-cyan-500/30 transition-all">
        {item.icon}
      </div>
      <div className="ml-4 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold group-hover:text-green-400 transition-colors">
            {item.name}
          </h3>
          <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-green-400 transition-colors" />
        </div>
        <p className="text-gray-400 text-sm mt-1">{item.description}</p>
        <code className="text-xs text-cyan-400/70 mt-2 block truncate">{item.url}</code>
      </div>
    </a>
  );

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
            PezkuwiChain Subdomains
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Access all PezkuwiChain services, RPC endpoints, and developer tools
          </p>
        </div>

        {/* Main Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Globe className="w-6 h-6 mr-3 text-green-400" />
            Main Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mainServices.map(renderCard)}
          </div>
        </section>

        {/* RPC Endpoints */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Radio className="w-6 h-6 mr-3 text-cyan-400" />
            RPC Endpoints
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rpcEndpoints.map(renderCard)}
          </div>
        </section>

        {/* Developer Tools */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Wrench className="w-6 h-6 mr-3 text-purple-400" />
            Developer Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map(renderCard)}
          </div>
        </section>

        {/* Info Box */}
        <div className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20 rounded-xl p-6 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">Need Help?</h3>
          <p className="text-gray-400 mb-4">
            Check our documentation or join the community forum for support
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="https://docs.pezkuwichain.io"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
            >
              Read Docs
            </a>
            <a
              href="https://forum.pezkuwichain.io"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-700 transition-colors"
            >
              Join Forum
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subdomains;
