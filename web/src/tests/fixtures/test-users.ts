/**
 * Test Fixtures - Mock users and data for testing
 * User1-User100 arası sabit test kullanıcıları
 */

// Generate wallet addresses (Substrate format)
function generateWallet(index: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let wallet = '5';
  const seed = `user${index}`;
  for (let i = 0; i < 47; i++) {
    const charIndex = (seed.charCodeAt(i % seed.length) + i * index) % chars.length;
    wallet += chars[charIndex];
  }
  return wallet;
}

// Test User Interface
export interface TestUser {
  id: string;
  email: string;
  wallet: string;
  name: string;
  reputation: number;
  completedTrades: number;
  cancelledTrades: number;
  balance: {
    HEZ: number;
    PEZ: number;
    USDT: number;
  };
}

// Generate 100 test users
export const TEST_USERS: TestUser[] = Array.from({ length: 100 }, (_, i) => {
  const index = i + 1;
  return {
    id: `user-${index.toString().padStart(3, '0')}`,
    email: `user${index}@test.pezkuwichain.io`,
    wallet: generateWallet(index),
    name: `Test User ${index}`,
    reputation: Math.min(100, 50 + Math.floor(index / 2)), // 50-100 arası
    completedTrades: index * 3,
    cancelledTrades: Math.floor(index / 10),
    balance: {
      HEZ: 1000 + index * 100,
      PEZ: 500 + index * 50,
      USDT: 100 + index * 10,
    },
  };
});

// Quick access helpers
export const getUser = (index: number): TestUser => TEST_USERS[index - 1];
export const getUserById = (id: string): TestUser | undefined =>
  TEST_USERS.find(u => u.id === id);
export const getUserByWallet = (wallet: string): TestUser | undefined =>
  TEST_USERS.find(u => u.wallet === wallet);

// Special test users for specific scenarios
export const ALICE = getUser(1);   // Basic user
export const BOB = getUser(2);     // Second basic user
export const CHARLIE = getUser(3); // Third basic user
export const WHALE = getUser(100); // High balance, high reputation
export const NEWBIE = { ...getUser(99), completedTrades: 0, reputation: 0 }; // New user

// Test Offers
export interface TestOffer {
  id: string;
  sellerId: string;
  sellerWallet: string;
  token: 'HEZ' | 'PEZ';
  totalAmount: number;
  remainingAmount: number;
  pricePerUnit: number;
  fiatCurrency: 'TRY' | 'USD' | 'EUR';
  minOrder: number;
  maxOrder: number;
  paymentMethod: string;
  status: 'open' | 'paused' | 'closed';
}

export const TEST_OFFERS: TestOffer[] = [
  {
    id: 'offer-001',
    sellerId: ALICE.id,
    sellerWallet: ALICE.wallet,
    token: 'HEZ',
    totalAmount: 100,
    remainingAmount: 100,
    pricePerUnit: 25.5,
    fiatCurrency: 'TRY',
    minOrder: 10,
    maxOrder: 50,
    paymentMethod: 'bank_transfer',
    status: 'open',
  },
  {
    id: 'offer-002',
    sellerId: BOB.id,
    sellerWallet: BOB.wallet,
    token: 'PEZ',
    totalAmount: 500,
    remainingAmount: 350,
    pricePerUnit: 5.0,
    fiatCurrency: 'USD',
    minOrder: 20,
    maxOrder: 200,
    paymentMethod: 'wise',
    status: 'open',
  },
  {
    id: 'offer-003',
    sellerId: WHALE.id,
    sellerWallet: WHALE.wallet,
    token: 'HEZ',
    totalAmount: 10000,
    remainingAmount: 8500,
    pricePerUnit: 24.0,
    fiatCurrency: 'EUR',
    minOrder: 100,
    maxOrder: 1000,
    paymentMethod: 'bank_transfer',
    status: 'open',
  },
];

// Test Trades
export interface TestTrade {
  id: string;
  offerId: string;
  buyerId: string;
  buyerWallet: string;
  sellerId: string;
  sellerWallet: string;
  cryptoAmount: number;
  fiatAmount: number;
  status: 'pending' | 'payment_sent' | 'completed' | 'cancelled' | 'disputed';
  createdAt: Date;
  paymentDeadline: Date;
}

export const TEST_TRADES: TestTrade[] = [
  {
    id: 'trade-001',
    offerId: 'offer-001',
    buyerId: CHARLIE.id,
    buyerWallet: CHARLIE.wallet,
    sellerId: ALICE.id,
    sellerWallet: ALICE.wallet,
    cryptoAmount: 20,
    fiatAmount: 510, // 20 * 25.5
    status: 'pending',
    createdAt: new Date(),
    paymentDeadline: new Date(Date.now() + 30 * 60 * 1000),
  },
  {
    id: 'trade-002',
    offerId: 'offer-002',
    buyerId: ALICE.id,
    buyerWallet: ALICE.wallet,
    sellerId: BOB.id,
    sellerWallet: BOB.wallet,
    cryptoAmount: 50,
    fiatAmount: 250, // 50 * 5.0
    status: 'payment_sent',
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    paymentDeadline: new Date(Date.now() + 20 * 60 * 1000),
  },
];

// Test Notifications
export interface TestNotification {
  id: string;
  userId: string;
  type: 'new_message' | 'payment_sent' | 'payment_confirmed' | 'trade_cancelled' | 'dispute_opened' | 'new_rating';
  title: string;
  message: string;
  referenceId: string;
  isRead: boolean;
  createdAt: Date;
}

export const TEST_NOTIFICATIONS: TestNotification[] = [
  {
    id: 'notif-001',
    userId: ALICE.id,
    type: 'new_message',
    title: 'New Message',
    message: 'You have a new message from Test User 3',
    referenceId: 'trade-001',
    isRead: false,
    createdAt: new Date(),
  },
  {
    id: 'notif-002',
    userId: BOB.id,
    type: 'payment_sent',
    title: 'Payment Sent',
    message: 'Buyer marked payment as sent',
    referenceId: 'trade-002',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  },
];

// Test Chat Messages
export interface TestMessage {
  id: string;
  tradeId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'system';
  isRead: boolean;
  createdAt: Date;
}

export const TEST_MESSAGES: TestMessage[] = [
  {
    id: 'msg-001',
    tradeId: 'trade-001',
    senderId: CHARLIE.id,
    content: 'Hello, I want to buy 20 HEZ',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'msg-002',
    tradeId: 'trade-001',
    senderId: ALICE.id,
    content: 'Sure, please send payment to IBAN TR123456789',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 60 * 1000),
  },
  {
    id: 'msg-003',
    tradeId: 'trade-001',
    senderId: 'system',
    content: 'Trade created. Payment deadline: 30 minutes',
    type: 'system',
    isRead: true,
    createdAt: new Date(Date.now() - 6 * 60 * 1000),
  },
];

// Test Ratings
export interface TestRating {
  id: string;
  tradeId: string;
  raterId: string;
  ratedId: string;
  rating: number;
  review: string;
  quickReviews: string[];
  createdAt: Date;
}

export const TEST_RATINGS: TestRating[] = [
  {
    id: 'rating-001',
    tradeId: 'trade-completed-001',
    raterId: ALICE.id,
    ratedId: BOB.id,
    rating: 5,
    review: 'Excellent trader, fast payment!',
    quickReviews: ['Fast payment', 'Good communication'],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];
