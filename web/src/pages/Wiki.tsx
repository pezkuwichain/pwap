import React from 'react';
import Layout from '@/components/Layout';
import { Search, BookOpen, Star } from 'lucide-react';

const Wiki: React.FC = () => {

  const categories = [
    { name: 'General', description: 'Learn the basics of PezkuwiChain.' },
    { name: 'Validators', description: 'How to run a validator node and secure the network.' },
    { name: 'Developers', description: 'Guides and resources for building on PezkuwiChain.' },
    { name: 'Tokenomics', description: 'Understand the economics of the HEZ and PEZ tokens.' },
    { name: 'Governance', description: 'Participate in the decentralized governance of the network.' },
    { name: 'Wallets', description: 'Learn how to use the official and third-party wallets.' },
  ];

  const popularArticles = [
    'How to become a validator',
    'PezkuwiChain tokenomics explained',
    'Connecting to the network with Pezkuwi Wallet',
    'Understanding the governance process',
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">Community Wiki</h1>
          <p className="text-xl text-gray-400">Your community-driven knowledge base for all things PezkuwiChain.</p>
          <div className="mt-6 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
              <input
                type="text"
                placeholder="Search the wiki..."
                className="w-full pl-14 pr-4 py-3 rounded-lg bg-gray-800 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-bold mb-6 flex items-center">
              <BookOpen className="mr-3 text-blue-400" />
              Categories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((category, index) => (
                <div key={index} className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer">
                  <h3 className="text-xl font-bold mb-2 text-blue-400">{category.name}</h3>
                  <p className="text-gray-400">{category.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center">
              <Star className="mr-3 text-yellow-400" />
              Popular Articles
            </h2>
            <div className="bg-gray-800 p-6 rounded-lg">
              <ul className="space-y-4">
                {popularArticles.map((article, index) => (
                  <li key={index}>
                    <a href="#" className="hover:text-blue-400 transition-colors">{article}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Wiki;
