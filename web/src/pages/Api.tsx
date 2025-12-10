import React from 'react';
import Layout from '@/components/Layout';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeSnippet = ({ language, code }: { language: string, code: string }) => (
  <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', backgroundColor: '#1E1E1E', borderRadius: '0.5rem' }}>
    {code}
  </SyntaxHighlighter>
);

const Api: React.FC = () => {
  const getBlockResponse = `{
  "blockNumber": 123456,
  "hash": "0xabcde12345fghij67890klmno12345pqrst67890uvwxyz12345abcde12345",
  "parentHash": "0x12345abcde12345fghij67890klmno12345pqrst67890uvwxyz12345abc",
  "timestamp": "2025-12-10T10:30:00Z",
  "transactions": [
    "0x98765fedcba..."
  ]
}`;

  const getTxResponse = `{
  "txHash": "0x98765fedcba...",
  "blockNumber": 123456,
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": "100.00 HEZ",
  "fee": "0.01 HEZ"
}`;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <h1 className="text-4xl font-bold mb-8">API Documentation</h1>

        <div className="space-y-12">
          <div>
            <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-700 pb-2">Endpoints</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="text-sm font-bold bg-green-600 text-white rounded px-2 py-1 mr-4">GET</span>
                <span className="font-mono text-lg">/api/blocks/latest</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-bold bg-green-600 text-white rounded px-2 py-1 mr-4">GET</span>
                <span className="font-mono text-lg">/api/blocks/{'{blockNumber}'}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-bold bg-green-600 text-white rounded px-2 py-1 mr-4">GET</span>
                <span className="font-mono text-lg">/api/transactions/{'{txHash}'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-700 pb-2">Examples</h2>
            
            {/* Get Block Example */}
            <div>
              <h3 className="text-xl font-semibold mb-2 font-mono">GET /api/blocks/{'{blockNumber}'}</h3>
              <p className="text-gray-400 mb-4">Retrieve a specific block by its number.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2 text-gray-300">Request</h4>
                  <CodeSnippet language="bash" code={'curl https://api.pezkuwichain.io/api/blocks/123456'} />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-gray-300">Response</h4>
                  <CodeSnippet language="json" code={getBlockResponse} />
                </div>
              </div>
            </div>

            {/* Get Transaction Example */}
            <div>
              <h3 className="text-xl font-semibold mb-2 font-mono">GET /api/transactions/{'{txHash}'}</h3>
              <p className="text-gray-400 mb-4">Retrieve a specific transaction by its hash.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2 text-gray-300">Request</h4>
                  <CodeSnippet language="bash" code={'curl https://api.pezkuwichain.io/api/transactions/0x98765...'} />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-gray-300">Response</h4>
                  <CodeSnippet language="json" code={getTxResponse} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Api;
