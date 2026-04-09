import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  title: string;
  titleKu: string;
  description: string;
  status: 'active' | 'ended';
  totalVotes: number;
  endsAt: string;
  options: PollOption[];
  userVoted: string | null;
}

const INITIAL_POLLS: Poll[] = [
  {
    id: '1',
    titleKu: 'Taybetmendiya nû ya paşîn çi be?',
    title: 'What should the next new feature be?',
    description: 'Vote for the feature you want to see next in PWAP.',
    status: 'active', totalVotes: 342, endsAt: '2026-04-20',
    options: [
      { id: '1a', text: 'NFT Marketplace',    votes: 128 },
      { id: '1b', text: 'DeFi Lending',       votes: 97 },
      { id: '1c', text: 'DAO Voting System',  votes: 72 },
      { id: '1d', text: 'Cross-chain Bridge', votes: 45 },
    ],
    userVoted: null,
  },
  {
    id: '2',
    titleKu: 'Karmasiyonên torê kêm bibin?',
    title: 'Should network fees be reduced?',
    description: 'Proposal to reduce transaction fees by 50% for the next quarter.',
    status: 'active', totalVotes: 521, endsAt: '2026-04-15',
    options: [
      { id: '2a', text: 'Ere / Yes',        votes: 389 },
      { id: '2b', text: 'Na / No',          votes: 87 },
      { id: '2c', text: 'Bêalî / Abstain',  votes: 45 },
    ],
    userVoted: null,
  },
  {
    id: '3',
    titleKu: 'Bernameya bursê ji bo perwerdehiyê?',
    title: 'Scholarship program for education?',
    description: 'Allocate 5% of treasury funds for a community education scholarship.',
    status: 'active', totalVotes: 198, endsAt: '2026-04-25',
    options: [
      { id: '3a', text: 'Ere, 5% / Yes, 5%', votes: 112 },
      { id: '3b', text: 'Ere, 3% / Yes, 3%', votes: 48 },
      { id: '3c', text: 'Na / No',            votes: 23 },
      { id: '3d', text: 'Bêalî / Abstain',    votes: 15 },
    ],
    userVoted: null,
  },
  {
    id: '4',
    titleKu: 'Logoya nû ya PWAP?',
    title: 'New PWAP logo design?',
    description: 'Community voted on the new logo. Results are final.',
    status: 'ended', totalVotes: 876, endsAt: '2026-03-30',
    options: [
      { id: '4a', text: 'Design A - Modern',  votes: 412 },
      { id: '4b', text: 'Design B - Classic', votes: 298 },
      { id: '4c', text: 'Design C - Minimal', votes: 166 },
    ],
    userVoted: '4a',
  },
];

export default function PollsPage() {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>(INITIAL_POLLS);

  const handleVote = (pollId: string, optionId: string) => {
    setPolls(prev =>
      prev.map(poll => {
        if (poll.id !== pollId || poll.userVoted) return poll;
        return {
          ...poll,
          totalVotes: poll.totalVotes + 1,
          userVoted: optionId,
          options: poll.options.map(opt =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          ),
        };
      })
    );
  };

  const pct = (votes: number, total: number) =>
    total === 0 ? 0 : Math.round((votes / total) * 100);

  const activePolls = polls.filter(p => p.status === 'active');
  const endedPolls  = polls.filter(p => p.status === 'ended');

  const renderPoll = (poll: Poll) => {
    const showResults = poll.userVoted !== null || poll.status === 'ended';
    const maxVotes = Math.max(...poll.options.map(o => o.votes));

    return (
      <div key={poll.id} className="bg-gray-900 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            poll.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
          }`}>
            {poll.status === 'active' ? 'Çalak / Active' : 'Qediya / Ended'}
          </span>
          <span className="text-xs text-gray-500">{poll.totalVotes} deng</span>
        </div>

        <p className="font-bold text-white mb-0.5">{poll.titleKu}</p>
        <p className="text-gray-400 text-sm mb-1">{poll.title}</p>
        <p className="text-gray-500 text-xs leading-relaxed mb-4">{poll.description}</p>

        <div className="space-y-2">
          {poll.options.map(option => {
            const percentage = pct(option.votes, poll.totalVotes);
            const isSelected = poll.userVoted === option.id;
            const isWinner   = poll.status === 'ended' && option.votes === maxVotes;

            return (
              <button
                key={option.id}
                onClick={() => { if (!showResults && poll.status === 'active') handleVote(poll.id, option.id); }}
                disabled={showResults}
                className={`w-full relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                  isSelected ? 'border-green-500' :
                  isWinner   ? 'border-yellow-500' :
                  showResults ? 'border-gray-800 cursor-default' :
                  'border-gray-700 hover:border-gray-500 active:scale-[0.99]'
                }`}
              >
                {showResults && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-xl transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? 'rgba(0,169,79,0.2)' : isWinner ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                    }}
                  />
                )}
                <div className="relative flex items-center justify-between px-4 py-3">
                  <span className={`text-sm font-medium ${isSelected ? 'text-green-400' : 'text-white'}`}>
                    {isSelected && '✓ '}{option.text}
                  </span>
                  {showResults && (
                    <span className={`text-sm font-bold ml-2 ${isSelected ? 'text-green-400' : isWinner ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-600 mt-3 text-right">
          {poll.status === 'active' ? `Dawî: ${poll.endsAt}` : `Qediya: ${poll.endsAt}`}
        </p>
      </div>
    );
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
          <span className="text-5xl block mb-2">📊</span>
          <h1 className="text-2xl font-bold">Rapirsî</h1>
          <p className="text-white/70 text-sm mt-0.5">Community Polls</p>
          <p className="text-yellow-400 text-sm font-semibold mt-2">{activePolls.length} çalak / active</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {activePolls.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-white text-base">Rapirsiyên Çalak / Active Polls</h2>
            {activePolls.map(renderPoll)}
          </div>
        )}
        {endedPolls.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-white text-base">Rapirsiyên Qediyayî / Ended Polls</h2>
            {endedPolls.map(renderPoll)}
          </div>
        )}
      </div>
      <div className="h-10" />
    </div>
  );
}
