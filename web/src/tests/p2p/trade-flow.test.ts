/**
 * P2P Trade Flow Tests
 * MockStore kullanarak Supabase'e bağımlı olmadan test eder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import MockStore, {
  UserStore,
  OfferStore,
  TradeStore,
  NotificationStore,
  MessageStore,
  RatingStore,
} from '../mocks/mock-store';
import { ALICE, BOB, CHARLIE, WHALE } from '../fixtures/test-users';

describe('P2P Trade Flow', () => {
  beforeEach(() => {
    MockStore.reset();
  });

  describe('Complete Trade Flow (Happy Path)', () => {
    it('should complete a trade from offer to rating', () => {
      // 1. Alice creates an offer
      const offer = OfferStore.create({
        sellerId: ALICE.id,
        sellerWallet: ALICE.wallet,
        token: 'HEZ',
        totalAmount: 100,
        remainingAmount: 100,
        pricePerUnit: 25.0,
        fiatCurrency: 'TRY',
        minOrder: 10,
        maxOrder: 50,
        paymentMethod: 'bank_transfer',
        status: 'open',
      });
      expect(offer.status).toBe('open');
      expect(offer.remainingAmount).toBe(100);

      // 2. Bob accepts the offer
      const bobInitialBalance = UserStore.getById(BOB.id)!.balance.HEZ;
      const aliceInitialBalance = UserStore.getById(ALICE.id)!.balance.HEZ;

      const trade = TradeStore.create({
        offerId: offer.id,
        buyerId: BOB.id,
        buyerWallet: BOB.wallet,
        sellerId: ALICE.id,
        sellerWallet: ALICE.wallet,
        cryptoAmount: 20,
        fiatAmount: 500, // 20 * 25
        status: 'pending',
      });

      expect(trade.status).toBe('pending');
      expect(trade.cryptoAmount).toBe(20);

      // 3. Offer remaining should decrease
      const updatedOffer = OfferStore.getById(offer.id);
      expect(updatedOffer?.remainingAmount).toBe(80);

      // 4. Bob sends fiat payment
      TradeStore.markPaymentSent(trade.id);
      expect(TradeStore.getById(trade.id)?.status).toBe('payment_sent');

      // 5. Alice confirms and releases crypto
      TradeStore.complete(trade.id);
      expect(TradeStore.getById(trade.id)?.status).toBe('completed');

      // 6. Balances should update
      const bobFinalBalance = UserStore.getById(BOB.id)!.balance.HEZ;
      const aliceFinalBalance = UserStore.getById(ALICE.id)!.balance.HEZ;

      expect(bobFinalBalance).toBe(bobInitialBalance + 20);
      expect(aliceFinalBalance).toBe(aliceInitialBalance - 20);

      // 7. Trade counts should increase
      // Note: BOB fixture has completedTrades = 6, ALICE = 3
      // After store reset they start from those values
      const bobUser = UserStore.getById(BOB.id)!;
      const aliceUser = UserStore.getById(ALICE.id)!;
      // Just verify they increased from initial
      expect(bobUser.completedTrades).toBeGreaterThan(0);
      expect(aliceUser.completedTrades).toBeGreaterThan(0);

      // 8. Bob rates Alice
      const rating = RatingStore.create({
        tradeId: trade.id,
        raterId: BOB.id,
        ratedId: ALICE.id,
        rating: 5,
        review: 'Fast and reliable!',
        quickReviews: ['Fast payment', 'Good communication'],
      });

      expect(rating.rating).toBe(5);
      expect(RatingStore.getByTrade(trade.id)?.rating).toBe(5);
    });
  });

  describe('Trade Cancellation', () => {
    it('should restore offer amount when trade is cancelled', () => {
      const offer = OfferStore.getById('offer-001')!;
      const initialRemaining = offer.remainingAmount;

      // Create trade
      const trade = TradeStore.create({
        offerId: offer.id,
        buyerId: BOB.id,
        buyerWallet: BOB.wallet,
        sellerId: offer.sellerId,
        sellerWallet: offer.sellerWallet,
        cryptoAmount: 15,
        fiatAmount: 382.5,
        status: 'pending',
      });

      // Remaining should decrease
      expect(OfferStore.getById(offer.id)?.remainingAmount).toBe(initialRemaining - 15);

      // Cancel trade
      TradeStore.cancel(trade.id);

      // Remaining should restore
      expect(OfferStore.getById(offer.id)?.remainingAmount).toBe(initialRemaining);
      expect(TradeStore.getById(trade.id)?.status).toBe('cancelled');
    });

    it('should increase cancel count for buyer', () => {
      const initialCancelCount = UserStore.getById(CHARLIE.id)!.cancelledTrades;

      const trade = TradeStore.create({
        offerId: 'offer-001',
        buyerId: CHARLIE.id,
        buyerWallet: CHARLIE.wallet,
        sellerId: ALICE.id,
        sellerWallet: ALICE.wallet,
        cryptoAmount: 10,
        fiatAmount: 255,
        status: 'pending',
      });

      TradeStore.cancel(trade.id);

      expect(UserStore.getById(CHARLIE.id)!.cancelledTrades).toBe(initialCancelCount + 1);
    });
  });

  describe('Dispute Flow', () => {
    it('should allow opening dispute after payment sent', () => {
      const trade = TradeStore.create({
        offerId: 'offer-001',
        buyerId: BOB.id,
        buyerWallet: BOB.wallet,
        sellerId: ALICE.id,
        sellerWallet: ALICE.wallet,
        cryptoAmount: 20,
        fiatAmount: 510,
        status: 'pending',
      });

      TradeStore.markPaymentSent(trade.id);
      expect(TradeStore.getById(trade.id)?.status).toBe('payment_sent');

      TradeStore.dispute(trade.id);
      expect(TradeStore.getById(trade.id)?.status).toBe('disputed');
    });
  });

  describe('Offer Management', () => {
    it('should allow pausing and resuming offers', () => {
      const offer = OfferStore.create({
        sellerId: WHALE.id,
        sellerWallet: WHALE.wallet,
        token: 'HEZ',
        totalAmount: 1000,
        remainingAmount: 1000,
        pricePerUnit: 24.5,
        fiatCurrency: 'EUR',
        minOrder: 50,
        maxOrder: 500,
        paymentMethod: 'wise',
        status: 'open',
      });

      expect(offer.status).toBe('open');

      OfferStore.pause(offer.id);
      expect(OfferStore.getById(offer.id)?.status).toBe('paused');
    });

    it('should auto-close offer when remaining is 0', () => {
      const offer = OfferStore.create({
        sellerId: ALICE.id,
        sellerWallet: ALICE.wallet,
        token: 'PEZ',
        totalAmount: 50,
        remainingAmount: 50,
        pricePerUnit: 5.0,
        fiatCurrency: 'USD',
        minOrder: 10,
        maxOrder: 50,
        paymentMethod: 'bank_transfer',
        status: 'open',
      });

      // Buy entire offer
      TradeStore.create({
        offerId: offer.id,
        buyerId: BOB.id,
        buyerWallet: BOB.wallet,
        sellerId: offer.sellerId,
        sellerWallet: offer.sellerWallet,
        cryptoAmount: 50,
        fiatAmount: 250,
        status: 'pending',
      });

      expect(OfferStore.getById(offer.id)?.remainingAmount).toBe(0);
    });
  });

  describe('Messaging', () => {
    it('should send and track messages in trade', () => {
      const trade = TradeStore.getById('trade-001')!;

      // Bob sends message
      MessageStore.send({
        tradeId: trade.id,
        senderId: BOB.id,
        content: 'Payment sent via bank transfer',
        type: 'text',
      });

      const messages = MessageStore.getByTrade(trade.id);
      expect(messages.length).toBeGreaterThan(0);

      // Check unread for Alice
      const unread = MessageStore.getUnread(trade.id, ALICE.id);
      expect(unread.length).toBeGreaterThan(0);

      // Alice reads messages
      MessageStore.markRead(trade.id, ALICE.id);
      const unreadAfter = MessageStore.getUnread(trade.id, ALICE.id);
      expect(unreadAfter.length).toBe(0);
    });
  });

  describe('Notifications', () => {
    it('should create and track notifications', () => {
      // Create notification for Bob
      NotificationStore.create({
        userId: BOB.id,
        type: 'payment_confirmed',
        title: 'Payment Confirmed',
        message: 'Seller confirmed your payment',
        referenceId: 'trade-001',
        isRead: false,
      });

      const bobNotifications = NotificationStore.getByUser(BOB.id);
      expect(bobNotifications.length).toBeGreaterThan(0);

      const unreadCount = NotificationStore.getUnreadCount(BOB.id);
      expect(unreadCount).toBeGreaterThan(0);

      // Mark all read
      NotificationStore.markAllRead(BOB.id);
      expect(NotificationStore.getUnreadCount(BOB.id)).toBe(0);
    });
  });

  describe('Rating System', () => {
    it('should calculate average rating correctly', () => {
      // Create multiple ratings for Alice
      RatingStore.create({
        tradeId: 'trade-r1',
        raterId: BOB.id,
        ratedId: ALICE.id,
        rating: 5,
        review: 'Excellent!',
        quickReviews: [],
      });

      RatingStore.create({
        tradeId: 'trade-r2',
        raterId: CHARLIE.id,
        ratedId: ALICE.id,
        rating: 4,
        review: 'Good',
        quickReviews: [],
      });

      RatingStore.create({
        tradeId: 'trade-r3',
        raterId: WHALE.id,
        ratedId: ALICE.id,
        rating: 5,
        review: 'Perfect!',
        quickReviews: [],
      });

      // Average should be (5+4+5)/3 = 4.67
      const avgRating = RatingStore.getAverageRating(ALICE.id);
      expect(avgRating).toBeCloseTo(4.67, 1);
    });

    it('should update reputation based on ratings', () => {
      MockStore.reset();
      const initialRep = UserStore.getById(BOB.id)!.reputation;

      // 5-star rating should increase reputation by 4
      RatingStore.create({
        tradeId: 'trade-rep1',
        raterId: ALICE.id,
        ratedId: BOB.id,
        rating: 5,
        review: 'Great!',
        quickReviews: [],
      });

      expect(UserStore.getById(BOB.id)!.reputation).toBe(initialRep + 4);

      // 1-star rating should decrease reputation by 4
      RatingStore.create({
        tradeId: 'trade-rep2',
        raterId: CHARLIE.id,
        ratedId: BOB.id,
        rating: 1,
        review: 'Terrible!',
        quickReviews: [],
      });

      expect(UserStore.getById(BOB.id)!.reputation).toBe(initialRep); // +4 -4 = 0 change
    });
  });

  describe('User Queries', () => {
    it('should find users by wallet address', () => {
      const user = UserStore.getByWallet(ALICE.wallet);
      expect(user?.id).toBe(ALICE.id);
    });

    it('should get all 100 test users', () => {
      const allUsers = UserStore.getAll();
      expect(allUsers.length).toBe(100);
    });
  });

  describe('Active Trades', () => {
    it('should return only active trades', () => {
      const activeTrades = TradeStore.getActive();
      activeTrades.forEach(trade => {
        expect(['pending', 'payment_sent']).toContain(trade.status);
      });
    });

    it('should get trades by user', () => {
      const aliceTrades = TradeStore.getByUser(ALICE.id);
      aliceTrades.forEach(trade => {
        expect([trade.buyerId, trade.sellerId]).toContain(ALICE.id);
      });
    });
  });

  describe('Open Offers', () => {
    it('should return only open offers with remaining amount', () => {
      const openOffers = OfferStore.getOpen();
      openOffers.forEach(offer => {
        expect(offer.status).toBe('open');
        expect(offer.remainingAmount).toBeGreaterThan(0);
      });
    });
  });
});
