import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Server, Globe, Zap, Clock, Shield, ExternalLink, Activity } from 'lucide-react';

interface NetworkPageProps {
  id: string;
  name: string;
  type: 'Live' | 'Development' | 'Local';
  description: string;
  endpoint: string;
  chainId: string;
  validators: number;
  features: string[];
  color: string;
  status: 'active' | 'coming-soon' | 'maintenance';
  blockTime?: string;
  finality?: string;
  consensus?: string;
}

const NetworkPage: React.FC<NetworkPageProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id,
  name,
  type,
  description,
  endpoint,
  chainId,
  validators,
  features,
  color,
  status,
  blockTime = '~6s',
  finality = '~12s',
  consensus = 'TNPoS'
}) => {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusColors = {
    'active': 'bg-green-500/20 text-green-400 border-green-500/30',
    'coming-soon': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'maintenance': 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const statusLabels = {
    'active': 'Active',
    'coming-soon': 'Coming Soon',
    'maintenance': 'Maintenance'
  };

  const typeColors = {
    'Live': 'bg-green-900/30 text-green-400',
    'Development': 'bg-yellow-900/30 text-yellow-400',
    'Local': 'bg-blue-900/30 text-blue-400'
  };

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-xl bg-gradient-to-br ${color}`}>
              <Globe className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold text-white">{name}</h1>
                <span className={`px-3 py-1 text-sm rounded-full ${typeColors[type]}`}>
                  {type}
                </span>
              </div>
              <p className="text-gray-400 mt-1">{description}</p>
            </div>
          </div>
          <div className={`inline-flex items-center px-4 py-2 rounded-full border ${statusColors[status]}`}>
            <span className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse"></span>
            {statusLabels[status]}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-center">
            <Server className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{validators}</div>
            <div className="text-gray-400 text-sm">Validators</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-center">
            <Clock className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{blockTime}</div>
            <div className="text-gray-400 text-sm">Block Time</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-center">
            <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{finality}</div>
            <div className="text-gray-400 text-sm">Finality</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-center">
            <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{consensus}</div>
            <div className="text-gray-400 text-sm">Consensus</div>
          </div>
        </div>

        {/* Connection Details */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-cyan-400" />
            Connection Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-2">WebSocket Endpoint</label>
              <div className="flex items-center">
                <code className="flex-1 p-4 bg-gray-950 rounded-lg text-cyan-400 font-mono text-sm border border-gray-800">
                  {endpoint}
                </code>
                <button
                  onClick={() => copyToClipboard(endpoint, 'endpoint')}
                  className="ml-3 p-3 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'endpoint' ?
                    <Check className="w-5 h-5 text-green-400" /> :
                    <Copy className="w-5 h-5" />
                  }
                </button>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-2">Chain ID</label>
              <div className="flex items-center">
                <code className="flex-1 p-4 bg-gray-950 rounded-lg text-purple-400 font-mono text-sm border border-gray-800">
                  {chainId}
                </code>
                <button
                  onClick={() => copyToClipboard(chainId, 'chainId')}
                  className="ml-3 p-3 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                >
                  {copiedField === 'chainId' ?
                    <Check className="w-5 h-5 text-green-400" /> :
                    <Copy className="w-5 h-5" />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Features</h2>
          <div className="flex flex-wrap gap-3">
            {features.map((feature, index) => (
              <span
                key={index}
                className={`px-4 py-2 rounded-full bg-gradient-to-r ${color} text-white text-sm font-medium`}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Code Example */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Start</h2>
          <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-300">
{`import { ApiPromise, WsProvider } from '@pezkuwi/api';

const provider = new WsProvider('${endpoint}');
const api = await ApiPromise.create({ provider });

// Get chain info
const chain = await api.rpc.system.chain();
console.log('Connected to:', chain.toString());`}
              </code>
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <a
            href="https://explorer.pezkuwichain.io"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center px-6 py-3 rounded-lg bg-gradient-to-r ${color} text-white font-semibold hover:opacity-90 transition-opacity`}
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Open Explorer
          </a>
          <a
            href="https://docs.pezkuwichain.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-6 py-3 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Documentation
          </a>
          {type !== 'Live' && (
            <a
              href="https://faucet.pezkuwichain.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-6 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
            >
              Get Test Tokens
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkPage;
