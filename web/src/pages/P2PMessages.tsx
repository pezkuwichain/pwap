import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { supabase } from '@/lib/supabase';

interface TradeConversation {
  tradeId: string;
  counterpartyId: string;
  counterpartyWallet: string;
  lastMessage: string;
  lastMessageType: 'text' | 'image' | 'system';
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
  tradeStatus: string;
}

export default function P2PMessages() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userId } = useP2PIdentity();

  const [conversations, setConversations] = useState<TradeConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Get all trades where user is buyer or seller
      const { data: trades, error: tradesError } = await supabase
        .from('p2p_fiat_trades')
        .select('id, seller_id, buyer_id, buyer_wallet, offer_id, status')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (tradesError) throw tradesError;
      if (!trades || trades.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const tradeIds = trades.map(t => t.id);

      // 2. Get all messages for these trades
      const { data: messages, error: msgsError } = await supabase
        .from('p2p_messages')
        .select('id, trade_id, sender_id, message, message_type, is_read, created_at')
        .in('trade_id', tradeIds)
        .order('created_at', { ascending: false });

      if (msgsError) throw msgsError;

      // 3. Get offer data for seller_wallet resolution
      const offerIds = [...new Set(trades.map(t => t.offer_id))];
      const { data: offers } = await supabase
        .from('p2p_fiat_offers')
        .select('id, seller_wallet')
        .in('id', offerIds);

      const offerMap = new Map(offers?.map(o => [o.id, o.seller_wallet]) || []);

      // 4. Group messages by trade_id and build conversation list
      const convos: TradeConversation[] = [];

      for (const trade of trades) {
        const tradeMessages = messages?.filter(m => m.trade_id === trade.id) || [];
        if (tradeMessages.length === 0) continue; // Skip trades with no messages

        const lastMsg = tradeMessages[0]; // Already sorted desc
        const unreadCount = tradeMessages.filter(
          m => m.sender_id !== userId && !m.is_read
        ).length;

        // Resolve counterparty
        const isBuyer = trade.buyer_id === userId;
        const counterpartyId = isBuyer ? trade.seller_id : trade.buyer_id;
        const counterpartyWallet = isBuyer
          ? (offerMap.get(trade.offer_id) || '???')
          : trade.buyer_wallet;

        convos.push({
          tradeId: trade.id,
          counterpartyId,
          counterpartyWallet,
          lastMessage: lastMsg.message,
          lastMessageType: lastMsg.message_type,
          lastMessageAt: lastMsg.created_at,
          lastMessageSenderId: lastMsg.sender_id,
          unreadCount,
          tradeStatus: trade.status,
        });
      }

      // Sort by last message time (newest first)
      convos.sort((a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convos);
    } catch (error) {
      console.error('Fetch conversations error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('p2p-messages-inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'p2p_messages',
        },
        () => {
          // Refetch conversations when any new message arrives
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return t('p2p.justNow');
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString();
  };

  const truncateWallet = (wallet: string) => {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getMessagePreview = (convo: TradeConversation) => {
    const isOwn = convo.lastMessageSenderId === userId;
    const prefix = isOwn ? `${t('p2pMessages.you')}: ` : '';

    if (convo.lastMessageType === 'image') {
      return `${prefix}${t('p2pMessages.sentImage')}`;
    }

    const msg = convo.lastMessage.length > 40
      ? convo.lastMessage.slice(0, 40) + '...'
      : convo.lastMessage;
    return `${prefix}${msg}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/p2p')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('p2pMessages.title')}</h1>
          <p className="text-sm text-gray-400">{t('p2pMessages.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <MessageSquare className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">{t('p2pMessages.noConversations')}</p>
          <p className="text-sm">{t('p2pMessages.noConversationsHint')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((convo) => (
            <button
              key={convo.tradeId}
              onClick={() => navigate(`/p2p/trade/${convo.tradeId}`)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/60 transition-colors text-left"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-gray-700 text-sm">
                  {convo.counterpartyWallet.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {truncateWallet(convo.counterpartyWallet)}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatRelativeTime(convo.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={`text-xs truncate ${convo.unreadCount > 0 ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                    {convo.lastMessageType === 'image' && (
                      <ImageIcon className="w-3 h-3 inline mr-1" />
                    )}
                    {getMessagePreview(convo)}
                  </span>
                  {convo.unreadCount > 0 && (
                    <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center shrink-0">
                      {convo.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
