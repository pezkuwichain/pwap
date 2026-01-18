// Mock for shared/lib/referral.ts
module.exports = {
  initiateReferral: jest.fn(() => Promise.resolve()),
  getPendingReferral: jest.fn(() => Promise.resolve(null)),
  getReferralCount: jest.fn(() => Promise.resolve(0)),
  getReferralInfo: jest.fn(() => Promise.resolve(null)),
  calculateReferralScore: jest.fn(() => 0),
  getReferralStats: jest.fn(() => Promise.resolve({ totalReferred: 0, pendingCount: 0, confirmedCount: 0 })),
  getMyReferrals: jest.fn(() => Promise.resolve([])),
  subscribeToReferralEvents: jest.fn(() => jest.fn()),
};
