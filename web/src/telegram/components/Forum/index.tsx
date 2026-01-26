import { useState } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageCircle, Plus, RefreshCw, Search, Pin, Clock, User,
  Eye, ChevronRight, ArrowLeft, Send, ThumbsUp, MessageSquare, Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export interface ForumReply {
  id: string;
  content: string;
  author: string;
  authorAddress?: string;
  createdAt: Date;
  likes: number;
  userLiked?: boolean;
}

// Mock data
const mockThreads: ForumThread[] = [
  {
    id: '1',
    title: 'Pezkuwi Forum\'a Hoş Geldiniz!',
    content: 'Bu, Pezkuwi vatandaşları için resmi topluluk forumudur. Dijital devletimiz, yönetişim, geliştirme ve daha fazlası hakkında serbestçe tartışabilirsiniz.\n\nLütfen saygılı olun ve topluluk kurallarımıza uyun.',
    author: 'Admin',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    replyCount: 45,
    viewCount: 1234,
    isPinned: true,
    tags: ['duyuru', 'kurallar'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 30),
    lastReplyAuthor: 'YeniVatandaş',
  },
  {
    id: '2',
    title: 'HEZ nasıl stake edilir ve ödül kazanılır?',
    content: 'Herkese merhaba! İlk HEZ tokenlarımı aldım ve stake etmeye başlamak istiyorum. Biri adım adım süreci açıklayabilir mi? Minimum miktar ne kadar?',
    author: 'KriptoYeni',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    replyCount: 12,
    viewCount: 256,
    tags: ['staking', 'yardım'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    lastReplyAuthor: 'StakingPro',
  },
  {
    id: '3',
    title: 'Öneri: Uygulamaya Kürtçe dil desteği eklenmeli',
    content: 'Kürt dijital devleti olarak, tüm uygulamalarımızda tam Kürtçe dil desteği (Kurmancî ve Soranî) olması gerektiğini düşünüyorum.\n\nNe düşünüyorsunuz?',
    author: 'KürtGeliştirici',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    replyCount: 28,
    viewCount: 567,
    tags: ['öneri', 'yerelleştirme'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    lastReplyAuthor: 'DilUzmanı',
  },
  {
    id: '4',
    title: 'Hata: Cüzdan bakiyesi güncellenmiyor',
    content: 'Transfer yaptıktan sonra cüzdan bakiyem hemen güncellenmiyor. Sayfayı birkaç kez yenilemem gerekiyor. Bu sorunu yaşayan başka var mı?',
    author: 'TeknikKullanıcı',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    replyCount: 8,
    viewCount: 89,
    tags: ['hata', 'cüzdan'],
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    lastReplyAuthor: 'GeliştiriciEkibi',
  },
];

const mockReplies: ForumReply[] = [
  {
    id: '1',
    content: 'Burada olmak harika! Topluluğa katılmak için sabırsızlanıyorum.',
    author: 'YeniVatandaş',
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    likes: 5,
  },
  {
    id: '2',
    content: 'Hoş geldiniz! Dokümantasyon bölümündeki staking rehberini kontrol etmeyi unutmayın.',
    author: 'Yardımcı',
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    likes: 12,
  },
];

function ThreadCard({ thread, onClick }: { thread: ForumThread; onClick: () => void }) {
  const { hapticSelection } = useTelegram();

  const handleClick = () => {
    hapticSelection();
    onClick();
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Az önce';
    if (hours < 24) return `${hours}s önce`;
    if (days < 7) return `${days}g önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <Card
      className={cn(
        "bg-gray-900 border-gray-800 cursor-pointer hover:border-gray-700 transition-all",
        thread.isPinned && "border-l-4 border-l-blue-500"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title with pin badge */}
            <div className="flex items-center gap-2 mb-2">
              {thread.isPinned && (
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">
                  <Pin className="w-3 h-3 mr-1" />
                  Sabit
                </Badge>
              )}
              <h3 className="font-medium text-white truncate">{thread.title}</h3>
            </div>

            {/* Preview */}
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {thread.content.length > 100 ? thread.content.slice(0, 100) + '...' : thread.content}
            </p>

            {/* Tags */}
            {thread.tags && thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {thread.tags.slice(0, 3).map(tag => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-md"
                  >
                    <Hash className="w-3 h-3" />
                    {tag}
                  </div>
                ))}
              </div>
            )}

            {/* Meta info */}
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
          <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
            Son yanıt: <span className="text-gray-400">{thread.lastReplyAuthor}</span>{' '}
            · {formatDate(thread.lastReplyAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ThreadView({
  thread,
  replies,
  onBack,
  onReply,
  onLikeReply,
  isConnected
}: {
  thread: ForumThread;
  replies: ForumReply[];
  onBack: () => void;
  onReply: (content: string) => void;
  onLikeReply: (replyId: string) => void;
  isConnected: boolean;
}) {
  const { hapticImpact } = useTelegram();
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    hapticImpact('medium');

    try {
      await onReply(replyContent);
      setReplyContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Button>
        <h2 className="text-white font-semibold truncate flex-1">{thread.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Original post */}
        <div className="p-4 border-b border-gray-800">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{thread.author}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(thread.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {thread.tags && thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {thread.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-gray-400 border-gray-700 text-xs">
                      <Hash className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {thread.content}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Replies */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-white font-medium text-sm">
              {replies.length} Yanıt
            </span>
          </div>

          <div className="space-y-3">
            {replies.map(reply => (
              <Card key={reply.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
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
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all",
                        reply.userLiked
                          ? "bg-green-500/20 text-green-500"
                          : "bg-gray-800 text-gray-500 hover:text-green-500"
                      )}
                    >
                      <ThumbsUp className={cn("w-3 h-3", reply.userLiked && "fill-current")} />
                      <span>{reply.likes}</span>
                    </button>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{reply.content}</p>
                </CardContent>
              </Card>
            ))}

            {replies.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Henüz yanıt yok. İlk yanıtı siz yazın!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply input */}
      {isConnected ? (
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="flex gap-2">
            <Input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Yanıtınızı yazın..."
              className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitReply();
                }
              }}
            />
            <Button
              onClick={handleSubmitReply}
              disabled={!replyContent.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-800 bg-gray-900 text-center text-gray-500 text-sm">
          Yanıt yazmak için cüzdanınızı bağlayın
        </div>
      )}
    </div>
  );
}

export function ForumSection() {
  const { hapticNotification, showAlert } = useTelegram();
  const { selectedAccount } = usePezkuwi();
  const { isConnected } = useWallet();

  const [threads, setThreads] = useState<ForumThread[]>(mockThreads);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>(mockReplies);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = async () => {
    setIsLoading(true);
    hapticNotification('success');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setThreads(mockThreads);
    setIsLoading(false);
  };

  const handleCreateThread = () => {
    if (!isConnected) {
      showAlert('Konu oluşturmak için cüzdanınızı bağlayın');
      return;
    }
    showAlert('Konu oluşturma özelliği yakında!');
  };

  const handleReply = async (content: string) => {
    if (!isConnected || !selectedThread) return;

    const newReply: ForumReply = {
      id: String(Date.now()),
      content,
      author: selectedAccount?.meta?.name || 'Anonim',
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
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950">
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            Forum
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("w-4 h-4 text-gray-400", isLoading && "animate-spin")} />
            </Button>
            <Button
              size="icon"
              onClick={handleCreateThread}
              className="h-8 w-8 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Konularda ara..."
            className="pl-9 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-gray-300 text-sm">{threads.length} Konu</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg">
            <Pin className="w-4 h-4 text-blue-500" />
            <span className="text-gray-300 text-sm">
              {threads.filter(t => t.isPinned).length} Sabitlenmiş
            </span>
          </div>
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 p-4 pt-0 space-y-3">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 bg-gray-800" />
            ))}
          </>
        ) : sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p>{searchQuery ? 'Konu bulunamadı' : 'Henüz konu yok'}</p>
            {!searchQuery && (
              <Button
                variant="link"
                onClick={handleCreateThread}
                className="mt-2 text-blue-500"
              >
                İlk konuyu oluştur
              </Button>
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

export default ForumSection;
