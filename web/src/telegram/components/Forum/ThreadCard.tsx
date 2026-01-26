import { MessageCircle, Eye, Clock, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTelegram } from '../../hooks/useTelegram';

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  author: string;
  authorAddress?: string;
  createdAt: Date;
  replyCount: number;
  viewCount: number;
  lastReplyAt?: Date;
  lastReplyAuthor?: string;
  isPinned?: boolean;
  tags?: string[];
}

interface ThreadCardProps {
  thread: ForumThread;
  onClick: () => void;
}

export function ThreadCard({ thread, onClick }: ThreadCardProps) {
  const { hapticSelection, isTelegram } = useTelegram();

  const handleClick = () => {
    if (isTelegram) {
      hapticSelection();
    }
    onClick();
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

  const truncatedContent = thread.content.length > 100
    ? thread.content.slice(0, 100) + '...'
    : thread.content;

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all',
        thread.isPinned && 'border-l-4 border-l-green-600'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            {thread.isPinned && (
              <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
                Pinned
              </span>
            )}
            <h3 className="font-medium text-white truncate">{thread.title}</h3>
          </div>

          {/* Preview */}
          <p className="text-gray-400 text-sm mb-2 line-clamp-2">{truncatedContent}</p>

          {/* Tags */}
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {thread.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{thread.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatDate(thread.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              <span>{thread.replyCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{thread.viewCount}</span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
      </div>

      {/* Last reply info */}
      {thread.lastReplyAt && thread.lastReplyAuthor && (
        <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-500">
          Last reply by <span className="text-gray-400">{thread.lastReplyAuthor}</span>{' '}
          {formatDate(thread.lastReplyAt)}
        </div>
      )}
    </button>
  );
}
