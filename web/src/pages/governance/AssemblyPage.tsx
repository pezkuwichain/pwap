import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Member {
  id: string;
  name: string;
  role: string;
  roleKu: string;
  emoji: string;
  region: string;
  since: string;
}

interface Session {
  id: string;
  titleKu: string;
  title: string;
  date: string;
  status: 'upcoming' | 'completed' | 'in-session';
  agenda: string;
}

const MEMBERS: Member[] = [
  { id: '1', name: 'Azad Kurdo',       role: 'Speaker',              roleKu: 'Serokê Meclîsê',          emoji: '👨‍⚖️', region: 'Amed',       since: '2025-06' },
  { id: '2', name: 'Rozerin Xan',      role: 'Deputy Speaker',       roleKu: 'Cîgirê Serokê Meclîsê',  emoji: '👩‍⚖️', region: 'Hewler',     since: '2025-06' },
  { id: '3', name: 'Serhat Demirtash', role: 'Finance Committee',    roleKu: 'Komîteya Darayî',         emoji: '👨‍💼', region: 'Diyarbekir', since: '2025-08' },
  { id: '4', name: 'Jîn Bakir',        role: 'Technology Committee', roleKu: 'Komîteya Teknolojiyê',   emoji: '👩‍💻', region: 'Silêmanî',   since: '2025-07' },
  { id: '5', name: 'Kawa Zana',        role: 'Education Committee',  roleKu: 'Komîteya Perwerdê',       emoji: '👨‍🎓', region: 'Wan',        since: '2025-09' },
  { id: '6', name: 'Berfîn Shêx',      role: 'Social Affairs',       roleKu: 'Karên Civakî',            emoji: '👩‍🏫', region: 'Kerkûk',     since: '2025-08' },
  { id: '7', name: 'Dilovan Ehmed',    role: 'Foreign Relations',    roleKu: 'Têkiliyên Derve',         emoji: '🧑‍💼', region: 'Qamişlo',   since: '2025-10' },
];

const SESSIONS: Session[] = [
  { id: 's1', titleKu: 'Civîna Budceya Q2 2026',      title: 'Q2 2026 Budget Session',      date: '2026-04-15', status: 'upcoming',  agenda: 'Treasury allocation, staking rewards adjustment, education fund.' },
  { id: 's2', titleKu: 'Civîna Yasadanînê #12',       title: 'Legislative Session #12',     date: '2026-04-10', status: 'upcoming',  agenda: 'Cross-chain bridge proposal, fee structure revision.' },
  { id: 's3', titleKu: 'Civîna Awarte ya Ewlehiyê',   title: 'Emergency Security Session',  date: '2026-03-28', status: 'completed', agenda: 'Network security audit results, validator requirements update.' },
  { id: 's4', titleKu: 'Civîna Yasadanînê #11',       title: 'Legislative Session #11',     date: '2026-03-15', status: 'completed', agenda: 'Citizenship criteria, NFT standards, community grants.' },
];

type Tab = 'members' | 'sessions';

export default function AssemblyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const sessionStatusLabel = (status: Session['status']) => {
    if (status === 'upcoming')   return t('assembly.session.upcoming', 'Upcoming');
    if (status === 'in-session') return t('assembly.session.inSession', 'In Session');
    return t('assembly.session.completed', 'Completed');
  };

  const sessionStatusCls = (status: Session['status']) => {
    if (status === 'upcoming')   return 'bg-blue-900/50 text-blue-400';
    if (status === 'in-session') return 'bg-green-900/50 text-green-400';
    return 'bg-gray-800 text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl">←</button>
          <span className="text-sm text-white/70">{t('assembly.breadcrumb', 'Governance')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">🏛️</span>
          <h1 className="text-2xl font-bold">{t('assembly.title', 'Kurdistan Digital Assembly')}</h1>
          <p className="text-white/70 text-sm mt-0.5">{t('assembly.subtitle', 'Kurdistan Digital Assembly')}</p>
        </div>
        <div className="mt-4 flex bg-white/10 rounded-2xl overflow-hidden">
          {[
            { val: MEMBERS.length, label: t('assembly.stats.members', 'Members') },
            { val: 4,              label: t('assembly.stats.committees', 'Committees') },
            { val: 12,             label: t('assembly.stats.sessions', 'Sessions') },
          ].map((stat, i) => (
            <div key={i} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-white/20' : ''}`}>
              <p className="text-xl font-bold text-white">{stat.val}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex bg-gray-900 rounded-xl p-1">
          {(['members', 'sessions'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-400'
              }`}
            >
              {tab === 'members' ? t('assembly.tab.members', 'Members') : t('assembly.tab.sessions', 'Sessions')}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {activeTab === 'members' && MEMBERS.map(m => (
          <div key={m.id} className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
            <span className="text-4xl">{m.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">{m.name}</p>
              <p className="text-green-400 text-sm font-medium">{m.roleKu}</p>
              <p className="text-gray-500 text-xs">{m.role}</p>
              <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                <span>📍 {m.region}</span>
                <span>{t('assembly.member.since', 'Since')} {m.since}</span>
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'sessions' && SESSIONS.map(s => (
          <div key={s.id} className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sessionStatusCls(s.status)}`}>
                {sessionStatusLabel(s.status)}
              </span>
              <span className="text-xs text-gray-500">{s.date}</span>
            </div>
            <p className="font-bold text-white">{s.titleKu}</p>
            <p className="text-gray-400 text-sm mb-2">{s.title}</p>
            <p className="text-gray-500 text-xs leading-relaxed">{s.agenda}</p>
          </div>
        ))}
      </div>
      <div className="h-10" />
    </div>
  );
}
