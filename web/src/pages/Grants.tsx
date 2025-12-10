import React from 'react';
import Layout from '@/components/Layout';
import { Award, Lightbulb, CheckCircle } from 'lucide-react';

const Grants: React.FC = () => {
    
  const fundedProjects = [
    { name: 'Pezkuwi DEX', description: 'A fast and secure decentralized exchange built on PezkuwiChain.', logo: '/pezkuwimarket.png' },
    { name: 'NFT Marketplace', description: 'A platform for creating and trading NFTs with low transaction fees.', logo: '/PezkuwiExchange.png' },
    { name: 'DAO Governance Tool', description: 'A tool for decentralized autonomous organizations to manage their governance.', logo: '/governance.png' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2 text-purple-400">PezkuwiChain Grants Program</h1>
          <p className="text-xl text-gray-400">Funding the future of the PezkuwiChain ecosystem.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-12">
          <div className="bg-gray-800 p-6 rounded-lg">
            <Lightbulb className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">Bring Your Idea</h3>
            <p className="text-gray-400">We support innovative projects that bring value to the ecosystem.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <Award className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">Get Funded</h3>
            <p className="text-gray-400">Receive funding and support to turn your idea into reality.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <CheckCircle className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">Grow the Ecosystem</h3>
            <p className="text-gray-400">Contribute to the growth and decentralization of PezkuwiChain.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="bg-gray-800 p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-6">Apply for a Grant</h2>
            <form>
              <div className="mb-4">
                <label className="block mb-2 font-semibold">Project Name</label>
                <input type="text" placeholder="Your awesome project" className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="mb-4">
                <label className="block mb-2 font-semibold">Team Information</label>
                <textarea placeholder="Tell us about your team" rows={3} className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
              </div>
              <div className="mb-6">
                <label className="block mb-2 font-semibold">Requested Amount (USD)</label>
                <input type="number" placeholder="10000" className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <button className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                Submit Application
              </button>
            </form>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-6">Our Focus Areas</h2>
            <ul className="list-disc list-inside space-y-3 text-lg">
              <li>Decentralized Finance (DeFi)</li>
              <li>NFTs and Gaming</li>
              <li>Infrastructure and Tooling</li>
              <li>Governance and DAOs</li>
              <li>Privacy and Identity</li>
              <li>Mobile and Web3 Applications</li>
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">Funded Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {fundedProjects.map((project, index) => (
              <div key={index} className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                     <img src={project.logo} alt={`${project.name} logo`} className="w-12 h-12 mr-4"/>
                    <h3 className="text-xl font-bold">{project.name}</h3>
                  </div>
                  <p className="text-gray-400">{project.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Grants;
