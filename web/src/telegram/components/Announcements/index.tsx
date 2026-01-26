import { useState, useEffect } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { AnnouncementCard, Announcement } from './AnnouncementCard';
import { useTelegram } from '../../hooks/useTelegram';

// Mock data - will be replaced with API calls
const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Pezkuwichain Mainnet Launch!',
    content: 'We are excited to announce that Pezkuwichain mainnet is now live! This marks a significant milestone in our journey towards building a decentralized digital state for the Kurdish people.\n\nKey features:\n- Fast transaction finality (6 seconds)\n- Low gas fees\n- Native staking support\n- Democratic governance\n\nStart exploring at app.pezkuwichain.io',
    author: 'Pezkuwi Team',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    likes: 142,
    dislikes: 3,
    isPinned: true,
  },
  {
    id: '2',
    title: 'New Referral Program',
    content: 'Invite friends and earn rewards! For every friend who completes KYC, you will receive bonus points that contribute to your trust score.\n\nShare your referral link from the Rewards section.',
    author: 'Pezkuwi Team',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    likes: 89,
    dislikes: 5,
  },
  {
    id: '3',
    title: 'Staking Rewards Update',
    content: 'We have updated the staking rewards mechanism. Citizens who stake HEZ will now earn PEZ tokens as rewards each epoch.\n\nMinimum stake: 10 HEZ\nEpoch duration: 7 days',
    author: 'Pezkuwi Team',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    likes: 67,
    dislikes: 2,
  },
];

export function Announcements() {
  const { hapticNotification } = useTelegram();
  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);
  const [isLoading, setIsLoading] = useState(false);

  const handleReact = (id: string, reaction: 'like' | 'dislike') => {
    setAnnouncements(prev => prev.map(ann => {
      if (ann.id !== id) return ann;

      const wasLiked = ann.userReaction === 'like';
      const wasDisliked = ann.userReaction === 'dislike';
      const isSameReaction = ann.userReaction === reaction;

      return {
        ...ann,
        userReaction: isSameReaction ? null : reaction,
        likes: reaction === 'like'
          ? ann.likes + (isSameReaction ? -1 : 1)
          : ann.likes - (wasLiked ? 1 : 0),
        dislikes: reaction === 'dislike'
          ? ann.dislikes + (isSameReaction ? -1 : 1)
          : ann.dislikes - (wasDisliked ? 1 : 0),
      };
    }));
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    hapticNotification('success');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In production, this would fetch from API
    setAnnouncements(mockAnnouncements);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Duyurular</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Megaphone className="w-12 h-12 mb-3 opacity-50" />
            <p>No announcements yet</p>
          </div>
        ) : (
          announcements.map(announcement => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onReact={handleReact}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Announcements;
