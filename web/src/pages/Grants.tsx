import React from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Award, Lightbulb, CheckCircle } from 'lucide-react';

const Grants: React.FC = () => {
  const { t } = useTranslation();

  const fundedProjects = [
    { name: 'Pezkuwi DEX', description: 'A fast and secure decentralized exchange built on PezkuwiChain.', logo: '/pezkuwimarket.png' },
    { name: 'NFT Marketplace', description: 'A platform for creating and trading NFTs with low transaction fees.', logo: '/PezkuwiExchange.png' },
    { name: 'DAO Governance Tool', description: 'A tool for decentralized autonomous organizations to manage their governance.', logo: '/governance.png' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2 text-purple-400">{t('grants.title')}</h1>
          <p className="text-xl text-gray-400">{t('grants.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-12">
          <div className="bg-gray-800 p-6 rounded-lg">
            <Lightbulb className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">{t('grants.bringIdea')}</h3>
            <p className="text-gray-400">{t('grants.bringIdeaDesc')}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <Award className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">{t('grants.getFunded')}</h3>
            <p className="text-gray-400">{t('grants.getFundedDesc')}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <CheckCircle className="mx-auto text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold">{t('grants.growEcosystem')}</h3>
            <p className="text-gray-400">{t('grants.growEcosystemDesc')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="bg-gray-800 p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-6">{t('grants.applyForGrant')}</h2>
            <form>
              <div className="mb-4">
                <label className="block mb-2 font-semibold">{t('grants.projectName')}</label>
                <input type="text" placeholder="Your awesome project" className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="mb-4">
                <label className="block mb-2 font-semibold">{t('grants.teamInfo')}</label>
                <textarea placeholder="Tell us about your team" rows={3} className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
              </div>
              <div className="mb-6">
                <label className="block mb-2 font-semibold">{t('grants.requestedAmount')}</label>
                <input type="number" placeholder="10000" className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <button className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                {t('grants.submitApplication')}
              </button>
            </form>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-6">{t('grants.focusAreas')}</h2>
            <ul className="list-disc list-inside space-y-3 text-lg">
              <li>{t('grants.defi')}</li>
              <li>{t('grants.nfts')}</li>
              <li>{t('grants.infrastructure')}</li>
              <li>{t('grants.governanceDao')}</li>
              <li>{t('grants.privacy')}</li>
              <li>{t('grants.mobile')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">{t('grants.fundedProjects')}</h2>
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
