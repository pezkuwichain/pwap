import React from 'react';
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
          <h1 className="text-5xl font-bold mb-2">Developer Portal</h1>
          <p className="text-xl text-gray-400">Everything you need to build on PezkuwiChain.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Quick Start Guide */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <Book className="text-blue-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">Quick Start Guide</h2>
            <p className="text-gray-400 mb-4">Your first steps to building a dApp on PezkuwiChain.</p>
                          <ol className="list-decimal list-inside space-y-2">
                            <li>Install the Polkadot.js extension.</li>
                            <li>Get some testnet HEZ from the Faucet.</li>              <li>Clone a starter project from our GitHub.</li>
              <li>Start building!</li>
            </ol>
          </div>

          {/* SDKs */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <Download className="text-green-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">SDK Downloads</h2>
            <p className="text-gray-400 mb-4">Libraries to interact with the chain.</p>
            <div className="space-y-3">
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>Javascript/Typescript SDK</span>
              </a>
              <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>Rust SDK</span>
              </a>
               <a href="#" className="flex items-center text-blue-400 hover:text-white">
                <Github className="mr-2" size={20} />
                <span>Python SDK</span>
              </a>
            </div>
          </div>
          
          {/* Community */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <MessageCircle className="text-purple-400 mb-4" size={32} />
            <h2 className="text-2xl font-bold mb-2">Community</h2>
            <p className="text-gray-400 mb-4">Get help and connect with other developers.</p>
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
          <h2 className="text-3xl font-bold text-center mb-8">Code Examples</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-2">Connect to the Network</h3>
              <CodeSnippet language="javascript" code={connectCode} />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Make a Transfer</h3>
              <CodeSnippet language="javascript" code={transferCode} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Developers;
