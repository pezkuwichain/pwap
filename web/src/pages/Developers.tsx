import React from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Download, Book, MessageCircle, Github } from 'lucide-react';

const CodeSnippet = ({ language, code }: { language: string, code: string }) => (
  <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', backgroundColor: '#1E1E1E', borderRadius: '0.5rem' }}>
    {code}
  </SyntaxHighlighter>
);

const Developers: React.FC = () => {
  const { t } = useTranslation();
  const connectCode = `import { ApiPromise, WsProvider } from '@pezkuwi/api';

// Connect to the PezkuwiChain node
const wsProvider = new WsProvider('wss://rpc.pezkuwichain.io');
const api = await ApiPromise.create({ provider: wsProvider });

console.log('API is connected:', api.isConnected);`;

  const transferCode = `// Example: Transfer HEZ tokens
const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice');
const bob = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

const unsub = await api.tx.balances
  .transfer(bob, 12345)
  .signAndSend(alice, (result) => {
    console.log(\`Current status is \${result.status}\`);
    if (result.isFinalized) {
      console.log(\`Transaction finalized at blockHash \${result.status.asFinalized}\`);
      unsub();
    }
  });`;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">{t('developers.title')}</h1>
          <p className="text-xl text-gray-400">{t('developers.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Quick Start Guide */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <Book className="text-blue-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">{t('developers.quickStart')}</h2>
            <p className="text-gray-400 mb-4">{t('developers.quickStartDesc')}</p>
                          <ol className="list-decimal list-inside space-y-2">
                            <li>{t('developers.step1')}</li>
                            <li>{t('developers.step2')}</li>              <li>{t('developers.step3')}</li>
              <li>{t('developers.step4')}</li>
            </ol>
          </div>

          {/* SDKs */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <Download className="text-green-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">{t('developers.sdkDownloads')}</h2>
            <p className="text-gray-400 mb-4">{t('developers.sdkDesc')}</p>
            <div className="space-y-3">
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>{t('developers.jsSdk')}</span>
              </a>
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>{t('developers.rustSdk')}</span>
              </a>
               <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>{t('developers.pythonSdk')}</span>
              </a>
            </div>
          </div>
          
          {/* Community */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <MessageCircle className="text-purple-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">{t('developers.community')}</h2>
            <p className="text-gray-400 mb-4">{t('developers.communityDesc')}</p>
             <div className="space-y-3">
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>GitHub</span>
              </a>
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <MessageCircle className="mr-2" size={20} />
                <span>Discord</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-3xl font-bold text-center mb-8">{t('developers.codeExamples')}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-2">{t('developers.connectNetwork')}</h3>
              <CodeSnippet language="javascript" code={connectCode} />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">{t('developers.makeTransfer')}</h3>
              <CodeSnippet language="javascript" code={transferCode} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Developers;
