import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Paper {
  id: string;
  emoji: string;
  titleKu: string;
  title: string;
  authors: string;
  abstract: string;
  category: string;
  date: string;
  citations: number;
  status: 'published' | 'peer-review' | 'draft';
}

const PAPERS: Paper[] = [
  {
    id: '1', emoji: '🔗',
    titleKu: 'Blockchain ji bo Aboriya Dijîtal a Kurdistanê',
    title: 'Blockchain for Kurdistan Digital Economy',
    authors: 'Dr. A. Kurdo, M. Ehmed',
    abstract: 'This paper explores the potential of blockchain technology in building a decentralized digital economy for Kurdistan. We propose the Pezkuwi consensus mechanism and analyze its throughput, security, and decentralization trade-offs.',
    category: 'Blockchain', date: '2026-02-15', citations: 42, status: 'published',
  },
  {
    id: '2', emoji: '💱',
    titleKu: 'Tokenomiya HEZ: Modela Aborî ya Nenavendî',
    title: 'HEZ Tokenomics: A Decentralized Economic Model',
    authors: 'Prof. R. Xan, S. Demirtash',
    abstract: 'An analysis of the HEZ token economic model including supply dynamics, staking incentives, governance utility, and long-term sustainability. We model inflation, deflation, and equilibrium scenarios.',
    category: 'Economics', date: '2026-01-20', citations: 31, status: 'published',
  },
  {
    id: '3', emoji: '🏘️',
    titleKu: 'Bereketli: Aboriya Taxê ya Dijîtal',
    title: 'Bereketli: Digital Neighborhood Economy',
    authors: 'K. Zana, B. Shêx',
    abstract: 'We present Bereketli, a peer-to-peer neighborhood economy platform built on blockchain. The system enables local trade, micro-lending, and community resource sharing with minimal trust assumptions.',
    category: 'DeFi / Social', date: '2025-11-30', citations: 18, status: 'published',
  },
  {
    id: '4', emoji: '🗣️',
    titleKu: 'NLP ji bo Zimanê Kurdî: Rewş û Derfet',
    title: 'NLP for Kurdish Language: Status and Opportunities',
    authors: 'Dr. J. Bakir, D. Ehmed',
    abstract: 'A comprehensive survey of Natural Language Processing research for the Kurdish language. We identify key gaps in tokenization, machine translation, and sentiment analysis, and propose a community-driven dataset initiative.',
    category: 'AI / Language', date: '2026-03-05', citations: 8, status: 'peer-review',
  },
  {
    id: '5', emoji: '🔐',
    titleKu: 'Nasnameya Dijîtal a Nenavendî li ser Pezkuwi',
    title: 'Decentralized Digital Identity on Pezkuwi',
    authors: 'M. Baran, A. Kurdo',
    abstract: 'We design a self-sovereign identity (SSI) framework for the Pezkuwi network. Citizens control their own credentials using zero-knowledge proofs while maintaining compliance with governance requirements.',
    category: 'Identity / Privacy', date: '2026-03-20', citations: 3, status: 'peer-review',
  },
];

const STATUS_META = {
  'published':   { label: 'Weşandî / Published', color: '#16a34a', bg: '#16a34a22' },
  'peer-review': { label: 'Peer Review',          color: '#b45309', bg: '#f59e0b33' },
  'draft':       { label: 'Draft',                color: '#6b7280', bg: '#6b728022' },
};

export default function ResearchPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('research.breadcrumb', 'Education')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">🔬</span>
          <h1 className="text-2xl font-bold">{t('research.title', 'Navenda Lêkolînê')}</h1>
          <p className="text-white/70 text-sm mt-0.5">{t('research.subtitle', 'Research Center')}</p>
          <p className="text-yellow-400 text-xs mt-2 font-semibold">
            {t('research.paperCount', '{{count}} lêkolîn / papers', { count: PAPERS.length })}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">

        {/* About card */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-2">{t('research.about.title', 'Der barê Navenda Lêkolînê / About')}</p>
          <p className="text-xs text-gray-300 leading-relaxed mb-1">
            {t('research.about.ku', 'Navenda Lêkolînê gotarên zanistî yên li ser aboriya dijîtal a Kurdistanê, teknolojiya blockchain, û mijarên pêwendîdar berhev dike.')}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('research.about.en', 'The Research Center curates academic papers on Kurdistan\'s digital economy, blockchain technology, and related topics.')}
          </p>
        </div>

        {/* Papers */}
        <p className="text-sm font-bold text-white px-1">{t('research.papers.title', 'Lêkolîn / Papers')}</p>

        {PAPERS.map(paper => {
          const meta = STATUS_META[paper.status];
          const isOpen = expandedId === paper.id;

          return (
            <button
              key={paper.id}
              className="w-full text-left bg-gray-900 rounded-2xl p-4"
              onClick={() => setExpandedId(isOpen ? null : paper.id)}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{paper.emoji}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: meta.color, backgroundColor: meta.bg }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-gray-500">📖 {paper.citations}</span>
                </div>
              </div>

              <p className="font-bold text-white text-sm leading-snug">{paper.titleKu}</p>
              <p className="text-xs text-gray-400 mt-0.5 mb-1">{paper.title}</p>
              <p className="text-xs text-blue-400 mb-2">{paper.authors}</p>

              <div className="flex gap-4 mb-2">
                <span className="text-[11px] text-gray-500">📁 {paper.category}</span>
                <span className="text-[11px] text-gray-500">📅 {paper.date}</span>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs font-semibold text-green-400 mb-1">Abstract</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{paper.abstract}</p>
                </div>
              )}

              <p className="text-xs text-green-500 text-center mt-2">
                {isOpen ? '▲ ' + t('research.less', 'Kêmtir / Less') : '▼ ' + t('research.more', 'Bêtir / More')}
              </p>
            </button>
          );
        })}

        {/* Submit CTA */}
        <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4 text-center">
          <p className="font-bold text-green-300 text-sm mb-1">
            {t('research.submit.title', 'Lêkolîna xwe bişînin / Submit your research')}
          </p>
          <p className="text-xs text-gray-400 leading-relaxed mb-3">
            {t('research.submit.desc', 'Hûn dikarin gotarên xwe yên zanistî ji bo vekolînê bişînin. Submit your academic papers for peer review.')}
          </p>
          <button className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
            📝 {t('research.submit.btn', 'Bişîne / Submit')}
          </button>
        </div>

      </div>
      <div className="h-10" />
    </div>
  );
}
