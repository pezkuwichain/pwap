import { useState } from 'react';
import { ArrowLeft, Send, User, Clock, ThumbsUp } from 'lucide-react';
import { ForumThread } from './ThreadCard';
import { useTelegram } from '../../hooks/useTelegram';

export interface ForumReply {
  id: string;
  content: string;
  author: string;
  authorAddress?: string;
  createdAt: Date;
  likes: number;
  userLiked?: boolean;
}

interface ThreadViewProps {
  thread: ForumThread;
  replies: ForumReply[];
  onBack: () => void;
  onReply: (content: string) => void;
  onLikeReply: (replyId: string) => void;
  isConnected: boolean;
}

export function ThreadView({
  thread,
  replies,
  onBack,
  onReply,
  onLikeReply,
  isConnected
}: ThreadViewProps) {
  const { hapticImpact, showBackButton, hideBackButton, isTelegram } = useTelegram();
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup Telegram back button
  useState(() => {
    if (isTelegram) {
      showBackButton(onBack);
      return () => hideBackButton();
    }
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    if (isTelegram) {
      hapticImpact('medium');
    }

    try {
      await onReply(replyContent);
      setReplyContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="text-lg font-semibold text-white truncate flex-1">{thread.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Original post */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{thread.author}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{formatDate(thread.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {thread.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {thread.content}
          </p>
        </div>

        {/* Replies */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-4">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </h4>

          <div className="space-y-4">
            {replies.map(reply => (
              <div key={reply.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">{reply.author}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatDate(reply.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onLikeReply(reply.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      reply.userLiked ? 'text-green-500' : 'text-gray-500 hover:text-green-500'
                    }`}
                  >
                    <ThumbsUp className={`w-3 h-3 ${reply.userLiked ? 'fill-current' : ''}`} />
                    <span>{reply.likes}</span>
                  </button>
                </div>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{reply.content}</p>
              </div>
            ))}

            {replies.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No replies yet. Be the first to reply!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply input */}
      {isConnected ? (
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitReply();
                }
              }}
            />
            <button
              onClick={handleSubmitReply}
              disabled={!replyContent.trim() || isSubmitting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-800 bg-gray-900 text-center text-gray-500 text-sm">
          Connect wallet to reply
        </div>
      )}
    </div>
  );
}
