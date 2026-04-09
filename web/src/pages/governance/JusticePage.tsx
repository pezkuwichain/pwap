import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface DisputeCase {
  id: string;
  caseNumber: string;
  titleKu: string;
  title: string;
  description: string;
  status: 'open' | 'in-review' | 'resolved';
  category: string;
  filedDate: string;
  resolvedDate?: string;
  resolution?: string;
}

const CASES: DisputeCase[] = [
  {
    id: '1', caseNumber: 'DKR-2026-001',
    titleKu: 'Nakokiya Dravdana Token', title: 'Token Transaction Dispute',
    description: 'Dispute over a failed transaction of 500 HEZ between two parties. Sender claims tokens were deducted but receiver did not receive them.',
    status: 'open', category: 'Transaction', filedDate: '2026-04-02',
  },
  {
    id: '2', caseNumber: 'DKR-2026-002',
    titleKu: 'Binpêkirina Peymana Zîrek', title: 'Smart Contract Violation',
    description: 'A DeFi protocol allegedly failed to distribute staking rewards as specified in its smart contract terms.',
    status: 'in-review', category: 'Smart Contract', filedDate: '2026-03-28',
  },
  {
    id: '3', caseNumber: 'DKR-2025-047',
    titleKu: 'Destavêtina Nasnameya Dijîtal', title: 'Digital Identity Fraud',
    description: 'A citizen reported unauthorized use of their digital identity credentials to access governance voting.',
    status: 'resolved', category: 'Identity', filedDate: '2026-02-15',
    resolvedDate: '2026-03-10',
    resolution: 'Identity credentials were revoked and reissued. Fraudulent votes were invalidated. Perpetrator account suspended.',
  },
  {
    id: '4', caseNumber: 'DKR-2025-039',
    titleKu: 'Nakokiya NFT ya Milkiyetê', title: 'NFT Ownership Dispute',
    description: 'Two parties claim ownership of the same NFT certificate. Investigation revealed a minting error in the original smart contract.',
    status: 'resolved', category: 'NFT / Ownership', filedDate: '2026-01-20',
    resolvedDate: '2026-02-28',
    resolution: 'Both parties received compensatory NFTs. Smart contract was patched to prevent duplicate minting.',
  },
];

const STATUS_CONFIG = {
  'open':      { label: 'Vekirî / Open',               cls: 'bg-red-900/50 text-red-400',    dot: 'bg-red-400' },
  'in-review': { label: 'Di lêkolînê de / In Review',  cls: 'bg-yellow-900/50 text-yellow-400', dot: 'bg-yellow-400' },
  'resolved':  { label: 'Çareserkirî / Resolved',      cls: 'bg-green-900/50 text-green-400', dot: 'bg-green-400' },
};

export default function JusticePage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = {
    open: CASES.filter(c => c.status === 'open').length,
    'in-review': CASES.filter(c => c.status === 'in-review').length,
    resolved: CASES.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl">←</button>
          <span className="text-sm text-white/70">Governance</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">⚖️</span>
          <h1 className="text-2xl font-bold">Dadwerî</h1>
          <p className="text-white/70 text-sm mt-0.5">Justice & Dispute Resolution</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Vekirî\nOpen',        val: counts['open'],      color: 'border-l-red-500' },
            { label: 'Lêkolîn\nIn Review',  val: counts['in-review'], color: 'border-l-yellow-500' },
            { label: 'Çareser\nResolved',   val: counts['resolved'],  color: 'border-l-green-500' },
          ].map((s, i) => (
            <div key={i} className={`bg-gray-900 rounded-xl p-4 text-center border-l-4 ${s.color}`}>
              <p className="text-2xl font-bold text-white">{s.val}</p>
              <p className="text-[10px] text-gray-400 mt-1 whitespace-pre-line leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-gray-900 rounded-xl p-4 border-l-4 border-l-green-600">
          <p className="font-bold text-white text-sm mb-2">Çareserkirina Nakokiyan / Dispute Resolution</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Sîstema dadweriya dijîtal a Kurdistanê nakokiyên di navbera welatiyên dijîtal de bi awayekî adil û zelal çareser dike. Hemû biryar li ser blockchain tên tomarkirin.
          </p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed italic">
            Kurdistan's digital justice system resolves disputes between digital citizens fairly and transparently. All decisions are recorded on the blockchain.
          </p>
        </div>

        {/* Cases */}
        <h2 className="font-bold text-white text-base pt-1">Dozên Dawî / Recent Cases</h2>
        {CASES.map(c => {
          const cfg = STATUS_CONFIG[c.status];
          const isOpen = expanded === c.id;
          return (
            <div key={c.id} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-xs font-semibold">{c.caseNumber}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="font-bold text-white">{c.titleKu}</p>
              <p className="text-gray-400 text-sm mb-2">{c.title}</p>
              <div className="flex gap-4 text-xs text-gray-500 mb-3">
                <span>📁 {c.category}</span>
                <span>📅 {c.filedDate}</span>
              </div>

              {isOpen && (
                <div className="border-t border-gray-800 pt-3 space-y-3">
                  <p className="text-sm text-gray-300 leading-relaxed">{c.description}</p>
                  {c.resolution && (
                    <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-3">
                      <p className="text-green-400 text-xs font-bold mb-1">Biryar / Resolution:</p>
                      <p className="text-gray-300 text-xs leading-relaxed">{c.resolution}</p>
                      <p className="text-gray-500 text-xs mt-2">Dîroka çareseriyê: {c.resolvedDate}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="mt-2 text-green-400 text-xs font-medium w-full text-center"
              >
                {isOpen ? '▲ Kêmtir' : '▼ Bêtir'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="h-10" />
    </div>
  );
}
