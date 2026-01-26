import { useState } from 'react';
import { MessageCircle, Plus, RefreshCw, Search } from 'lucide-react';
import { ThreadCard, ForumThread } from './ThreadCard';
import { ThreadView, ForumReply } from './ThreadView';
import { useTelegram } from '../../hooks/useTelegram';
import { usePezkuwi } from '@/contexts/PezkuwiContext';

// Mock data - will be replaced with API calls
const mockThreads: ForumThread[] = [
  {
    id: '1',
    title: 'Welcome to Pezkuwi Forum!',
    content: 'This is the official community forum for Pezkuwi citizens. Feel free to discuss anything related to our digital state, governance, development, and more.\n\nPlease be respectful and follow our community guidelines.',
    author: 'Admin',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    replyCount: 45,
    viewCount: 1234,
    isPinned: true,
    tags: ['announcement', 'rules'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 30),
    lastReplyAuthor: 'NewCitizen',
  },
  {
    id: '2',
    title: 'How to stake HEZ and earn rewards?',
    content: 'Hi everyone! I just got my first HEZ tokens and want to start staking. Can someone explain the process step by step? What is the minimum amount required?',
    author: 'CryptoNewbie',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    replyCount: 12,
    viewCount: 256,
    tags: ['staking', 'help'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    lastReplyAuthor: 'StakingPro',
  },
  {
    id: '3',
    title: 'Proposal: Add support for Kurdish language in the app',
    content: 'As a Kurdish digital state, I think it would be great to have full Kurdish language support (Kurmanci and Sorani) in all our applications.\n\nWhat do you think?',
    author: 'KurdishDev',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    replyCount: 28,
    viewCount: 567,
    tags: ['proposal', 'localization'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    lastReplyAuthor: 'LanguageExpert',
  },
  {
    id: '4',
    title: 'Bug report: Wallet balance not updating',
    content: 'After making a transfer, my wallet balance doesn\'t update immediately. I have to refresh the page multiple times. Is anyone else experiencing this issue?',
    author: 'TechUser',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    replyCount: 8,
    viewCount: 89,
    tags: ['bug', 'wallet'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    lastReplyAuthor: 'DevTeam',
  },
];

const mockReplies: ForumReply[] = [
  {
    id: '1',
    content: 'Great to be here! Looking forward to participating in the community.',
    author: 'NewCitizen',
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    likes: 5,
  },
  {
    id: '2',
    content: 'Welcome! Make sure to check out the staking guide in the docs section.',
    author: 'Helper',
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    likes: 12,
  },
];

export function Forum() {
  const { hapticNotification, showAlert } = useTelegram();
  const { selectedAccount } = usePezkuwi();
  const [threads, setThreads] = useState<ForumThread[]>(mockThreads);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>(mockReplies);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isConnected = !!selectedAccount;

  const handleRefresh = async () => {
    setIsLoading(true);
    hapticNotification('success');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setThreads(mockThreads);
    setIsLoading(false);
  };

  const handleCreateThread = () => {
    if (!isConnected) {
      showAlert('Please connect your wallet to create a thread');
      return;
    }
    // TODO: Implement thread creation modal
    showAlert('Thread creation coming soon!');
  };

  const handleReply = async (content: string) => {
    if (!isConnected || !selectedThread) return;

    const newReply: ForumReply = {
      id: String(Date.now()),
      content,
      author: selectedAccount?.meta?.name || 'Anonymous',
      createdAt: new Date(),
      likes: 0,
    };

    setReplies(prev => [...prev, newReply]);
    hapticNotification('success');
  };

  const handleLikeReply = (replyId: string) => {
    setReplies(prev => prev.map(reply => {
      if (reply.id !== replyId) return reply;
      return {
        ...reply,
        likes: reply.userLiked ? reply.likes - 1 : reply.likes + 1,
        userLiked: !reply.userLiked,
      };
    }));
  };

  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: pinned first, then by date
  const sortedThreads = [...filteredThreads].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  if (selectedThread) {
    return (
      <ThreadView
        thread={selectedThread}
        replies={replies}
        onBack={() => setSelectedThread(null)}
        onReply={handleReply}
        onLikeReply={handleLikeReply}
        isConnected={isConnected}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Forum</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateThread}
            className="p-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threads..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p>{searchQuery ? 'No threads found' : 'No threads yet'}</p>
            {!searchQuery && (
              <button
                onClick={handleCreateThread}
                className="mt-4 text-green-500 hover:text-green-400"
              >
                Create the first thread
              </button>
            )}
          </div>
        ) : (
          sortedThreads.map(thread => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onClick={() => setSelectedThread(thread)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Forum;
