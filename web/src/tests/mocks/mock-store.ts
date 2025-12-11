/**
 * In-Memory Mock Store - Supabase yerine kullanılır
 * Test sırasında tüm data burada tutulur
 */

import {
  TEST_USERS,
  TEST_OFFERS,
  TEST_TRADES,
  TEST_NOTIFICATIONS,
  TEST_MESSAGES,
  TEST_RATINGS,
  type TestOffer,
  type TestTrade,
  type TestNotification,
  type TestMessage,
  type TestRating,
} from '../fixtures/test-users';

// Store state - mutable copies of test data
let users = [...TEST_USERS];
let offers = [...TEST_OFFERS];
let trades = [...TEST_TRADES];
let notifications = [...TEST_NOTIFICATIONS];
let messages = [...TEST_MESSAGES];
let ratings = [...TEST_RATINGS];

// Reset store to initial state
export function resetStore() {
  users = [...TEST_USERS];
  offers = [...TEST_OFFERS];
  trades = [...TEST_TRADES];
  notifications = [...TEST_NOTIFICATIONS];
  messages = [...TEST_MESSAGES];
  ratings = [...TEST_RATINGS];
}

// User operations
export const UserStore = {
  getAll: () => [...users],
  getById: (id: string) => users.find(u => u.id === id),
  getByWallet: (wallet: string) => users.find(u => u.wallet === wallet),
  updateBalance: (id: string, token: 'HEZ' | 'PEZ' | 'USDT', amount: number) => {
    const user = users.find(u => u.id === id);
    if (user) {
      user.balance[token] += amount;
    }
    return user;
  },
  updateReputation: (id: string, change: number) => {
    const user = users.find(u => u.id === id);
    if (user) {
      user.reputation = Math.max(0, Math.min(100, user.reputation + change));
    }
    return user;
  },
};

// Offer operations
export const OfferStore = {
  getAll: () => [...offers],
  getById: (id: string) => offers.find(o => o.id === id),
  getOpen: () => offers.filter(o => o.status === 'open' && o.remainingAmount > 0),
  getBySeller: (sellerId: string) => offers.filter(o => o.sellerId === sellerId),
  create: (offer: Omit<TestOffer, 'id'>) => {
    const newOffer = { ...offer, id: `offer-${Date.now()}` };
    offers.push(newOffer);
    return newOffer;
  },
  updateRemaining: (id: string, amount: number) => {
    const offer = offers.find(o => o.id === id);
    if (offer) {
      offer.remainingAmount = amount;
      if (amount <= 0) offer.status = 'closed';
    }
    return offer;
  },
  pause: (id: string) => {
    const offer = offers.find(o => o.id === id);
    if (offer) offer.status = 'paused';
    return offer;
  },
  close: (id: string) => {
    const offer = offers.find(o => o.id === id);
    if (offer) offer.status = 'closed';
    return offer;
  },
};

// Trade operations
export const TradeStore = {
  getAll: () => [...trades],
  getById: (id: string) => trades.find(t => t.id === id),
  getByUser: (userId: string) => trades.filter(t => t.buyerId === userId || t.sellerId === userId),
  getActive: () => trades.filter(t => ['pending', 'payment_sent'].includes(t.status)),
  create: (trade: Omit<TestTrade, 'id' | 'createdAt' | 'paymentDeadline'>) => {
    const newTrade: TestTrade = {
      ...trade,
      id: `trade-${Date.now()}`,
      createdAt: new Date(),
      paymentDeadline: new Date(Date.now() + 30 * 60 * 1000),
    };
    trades.push(newTrade);

    // Update offer remaining amount
    const offer = offers.find(o => o.id === trade.offerId);
    if (offer) {
      offer.remainingAmount -= trade.cryptoAmount;
    }

    return newTrade;
  },
  updateStatus: (id: string, status: TestTrade['status']) => {
    const trade = trades.find(t => t.id === id);
    if (trade) {
      trade.status = status;

      // If cancelled, restore offer amount
      if (status === 'cancelled') {
        const offer = offers.find(o => o.id === trade.offerId);
        if (offer) {
          offer.remainingAmount += trade.cryptoAmount;
        }
      }
    }
    return trade;
  },
  markPaymentSent: (id: string) => TradeStore.updateStatus(id, 'payment_sent'),
  complete: (id: string) => {
    const trade = TradeStore.updateStatus(id, 'completed');
    if (trade) {
      // Transfer crypto from seller to buyer
      UserStore.updateBalance(trade.sellerId, 'HEZ', -trade.cryptoAmount);
      UserStore.updateBalance(trade.buyerId, 'HEZ', trade.cryptoAmount);

      // Update trade counts
      const seller = users.find(u => u.id === trade.sellerId);
      const buyer = users.find(u => u.id === trade.buyerId);
      if (seller) seller.completedTrades++;
      if (buyer) buyer.completedTrades++;
    }
    return trade;
  },
  cancel: (id: string) => {
    const trade = TradeStore.updateStatus(id, 'cancelled');
    if (trade) {
      const canceller = users.find(u => u.id === trade.buyerId);
      if (canceller) canceller.cancelledTrades++;
    }
    return trade;
  },
  dispute: (id: string) => TradeStore.updateStatus(id, 'disputed'),
};

// Notification operations
export const NotificationStore = {
  getAll: () => [...notifications],
  getByUser: (userId: string) => notifications.filter(n => n.userId === userId),
  getUnread: (userId: string) => notifications.filter(n => n.userId === userId && !n.isRead),
  getUnreadCount: (userId: string) => NotificationStore.getUnread(userId).length,
  create: (notification: Omit<TestNotification, 'id' | 'createdAt'>) => {
    const newNotif: TestNotification = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date(),
    };
    notifications.push(newNotif);
    return newNotif;
  },
  markRead: (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
    return notif;
  },
  markAllRead: (userId: string) => {
    notifications.filter(n => n.userId === userId).forEach(n => n.isRead = true);
  },
};

// Message operations
export const MessageStore = {
  getAll: () => [...messages],
  getByTrade: (tradeId: string) => messages.filter(m => m.tradeId === tradeId),
  getUnread: (tradeId: string, userId: string) =>
    messages.filter(m => m.tradeId === tradeId && m.senderId !== userId && !m.isRead),
  send: (message: Omit<TestMessage, 'id' | 'createdAt' | 'isRead'>) => {
    const newMsg: TestMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      createdAt: new Date(),
      isRead: false,
    };
    messages.push(newMsg);
    return newMsg;
  },
  markRead: (tradeId: string, userId: string) => {
    messages
      .filter(m => m.tradeId === tradeId && m.senderId !== userId)
      .forEach(m => m.isRead = true);
  },
};

// Rating operations
export const RatingStore = {
  getAll: () => [...ratings],
  getByUser: (userId: string) => ratings.filter(r => r.ratedId === userId),
  getByTrade: (tradeId: string) => ratings.find(r => r.tradeId === tradeId),
  getAverageRating: (userId: string) => {
    const userRatings = RatingStore.getByUser(userId);
    if (userRatings.length === 0) return 0;
    return userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length;
  },
  create: (rating: Omit<TestRating, 'id' | 'createdAt'>) => {
    const newRating: TestRating = {
      ...rating,
      id: `rating-${Date.now()}`,
      createdAt: new Date(),
    };
    ratings.push(newRating);

    // Update user reputation based on rating
    const change = (rating.rating - 3) * 2; // 5 stars = +4, 1 star = -4
    UserStore.updateReputation(rating.ratedId, change);

    return newRating;
  },
};

// Export all stores
export const MockStore = {
  users: UserStore,
  offers: OfferStore,
  trades: TradeStore,
  notifications: NotificationStore,
  messages: MessageStore,
  ratings: RatingStore,
  reset: resetStore,
};

export default MockStore;
