import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTelegram } from '../../hooks/useTelegram';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  authorAvatar?: string;
  createdAt: Date;
  likes: number;
  dislikes: number;
  userReaction?: 'like' | 'dislike' | null;
  isPinned?: boolean;
  imageUrl?: string;
}

interface AnnouncementCardProps {
  announcement: Announcement;
  onReact: (id: string, reaction: 'like' | 'dislike') => void;
}

export function AnnouncementCard({ announcement, onReact }: AnnouncementCardProps) {
  const { hapticImpact, isTelegram } = useTelegram();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReact = (reaction: 'like' | 'dislike') => {
    if (isTelegram) {
      hapticImpact('light');
    }
    onReact(announcement.id, reaction);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const truncatedContent = announcement.content.length > 200 && !isExpanded
    ? announcement.content.slice(0, 200) + '...'
    : announcement.content;

  return (
    <div className={cn(
      'bg-gray-800 rounded-lg p-4 border border-gray-700',
      announcement.isPinned && 'border-green-600 border-l-4'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Author avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center overflow-hidden">
            {announcement.authorAvatar ? (
              <img
                src={announcement.authorAvatar}
                alt={announcement.author}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>

          <div>
            <h3 className="font-semibold text-white text-sm">{announcement.author}</h3>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatDate(announcement.createdAt)}</span>
            </div>
          </div>
        </div>

        {announcement.isPinned && (
          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
            Pinned
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-white font-medium mb-2">{announcement.title}</h4>

      {/* Content */}
      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
        {truncatedContent}
      </p>

      {/* Show more/less button */}
      {announcement.content.length > 200 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-green-500 text-sm mt-2 hover:text-green-400"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Image */}
      {announcement.imageUrl && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <img
            src={announcement.imageUrl}
            alt=""
            className="w-full h-auto max-h-64 object-cover"
          />
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-700">
        <button
          onClick={() => handleReact('like')}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            announcement.userReaction === 'like'
              ? 'text-green-500'
              : 'text-gray-400 hover:text-green-500'
          )}
        >
          <ThumbsUp className={cn(
            'w-4 h-4',
            announcement.userReaction === 'like' && 'fill-current'
          )} />
          <span>{announcement.likes}</span>
        </button>

        <button
          onClick={() => handleReact('dislike')}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            announcement.userReaction === 'dislike'
              ? 'text-red-500'
              : 'text-gray-400 hover:text-red-500'
          )}
        >
          <ThumbsDown className={cn(
            'w-4 h-4',
            announcement.userReaction === 'dislike' && 'fill-current'
          )} />
          <span>{announcement.dislikes}</span>
        </button>
      </div>
    </div>
  );
}
