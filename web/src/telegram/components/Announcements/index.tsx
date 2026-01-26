import { useState, useEffect } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Megaphone, RefreshCw, ThumbsUp, ThumbsDown, Pin, Clock,
  User, ChevronDown, ChevronUp, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Mock data - will be replaced with API calls
const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Pezkuwichain Mainnet Yayında!',
    content: 'Pezkuwichain mainnet artık aktif! Bu, Kürt halkı için merkezi olmayan bir dijital devlet inşa etme yolculuğumuzda önemli bir kilometre taşı.\n\nÖne çıkan özellikler:\n- Hızlı işlem kesinliği (6 saniye)\n- Düşük gas ücretleri\n- Yerleşik staking desteği\n- Demokratik yönetişim\n\nKeşfetmeye başlayın: app.pezkuwichain.io',
    author: 'Pezkuwi Ekibi',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    likes: 142,
    dislikes: 3,
    isPinned: true,
  },
  {
    id: '2',
    title: 'Yeni Referral Programı',
    content: 'Arkadaşlarınızı davet edin ve ödüller kazanın! KYC tamamlayan her arkadaşınız için trust score\'unuza katkıda bulunan bonus puanlar alacaksınız.\n\nReferans linkinizi Rewards bölümünden paylaşın.',
    author: 'Pezkuwi Ekibi',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    likes: 89,
    dislikes: 5,
  },
  {
    id: '3',
    title: 'Staking Ödülleri Güncellendi',
    content: 'Staking ödül mekanizmasını güncelledik. HEZ stake eden vatandaşlar artık her epoch\'ta PEZ token ödülü kazanacak.\n\nMinimum stake: 10 HEZ\nEpoch süresi: 7 gün',
    author: 'Pezkuwi Ekibi',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    likes: 67,
    dislikes: 2,
  },
];

function AnnouncementCard({
  announcement,
  onReact
}: {
  announcement: Announcement;
  onReact: (id: string, reaction: 'like' | 'dislike') => void;
}) {
  const { hapticImpact } = useTelegram();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReact = (reaction: 'like' | 'dislike') => {
    hapticImpact('light');
    onReact(announcement.id, reaction);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Az önce';
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const shouldTruncate = announcement.content.length > 200;
  const displayContent = shouldTruncate && !isExpanded
    ? announcement.content.slice(0, 200) + '...'
    : announcement.content;

  return (
    <Card className={cn(
      "bg-gray-900 border-gray-800",
      announcement.isPinned && "border-l-4 border-l-yellow-500"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              {announcement.authorAvatar ? (
                <img
                  src={announcement.authorAvatar}
                  alt={announcement.author}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="text-white font-medium text-sm">{announcement.author}</p>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{formatDate(announcement.createdAt)}</span>
              </div>
            </div>
          </div>
          {announcement.isPinned && (
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
              <Pin className="w-3 h-3 mr-1" />
              Sabitlendi
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold mb-2">{announcement.title}</h3>

        {/* Content */}
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </p>

        {/* Show more/less button */}
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-yellow-500 text-sm mt-2 hover:text-yellow-400"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Daha az göster
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Devamını göster
              </>
            )}
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
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-800">
          <button
            onClick={() => handleReact('like')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
              announcement.userReaction === 'like'
                ? "bg-green-500/20 text-green-500"
                : "bg-gray-800 text-gray-400 hover:bg-green-500/10 hover:text-green-500"
            )}
          >
            <ThumbsUp className={cn(
              "w-4 h-4",
              announcement.userReaction === 'like' && "fill-current"
            )} />
            <span className="text-sm font-medium">{announcement.likes}</span>
          </button>

          <button
            onClick={() => handleReact('dislike')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
              announcement.userReaction === 'dislike'
                ? "bg-red-500/20 text-red-500"
                : "bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-500"
            )}
          >
            <ThumbsDown className={cn(
              "w-4 h-4",
              announcement.userReaction === 'dislike' && "fill-current"
            )} />
            <span className="text-sm font-medium">{announcement.dislikes}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnnouncementsSection() {
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    setAnnouncements(mockAnnouncements);
    setIsLoading(false);
  };

  // Sort: pinned first, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950">
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-yellow-500" />
            Duyurular
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("w-4 h-4 text-gray-400", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg">
            <Bell className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-300 text-sm">{announcements.length} Duyuru</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg">
            <Pin className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-300 text-sm">
              {announcements.filter(a => a.isPinned).length} Sabitlenmiş
            </span>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="flex-1 p-4 pt-0 space-y-4">
        {isLoading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 bg-gray-800" />
            ))}
          </>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Megaphone className="w-12 h-12 mb-3 opacity-50" />
            <p>Henüz duyuru yok</p>
          </div>
        ) : (
          sortedAnnouncements.map(announcement => (
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

export default AnnouncementsSection;
