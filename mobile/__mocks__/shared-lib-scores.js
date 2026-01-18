// Mock for shared/lib/scores.ts
module.exports = {
  getTrustScore: jest.fn(() => Promise.resolve(0)),
  getTrustScoreDetails: jest.fn(() => Promise.resolve(null)),
  getReferralScore: jest.fn(() => Promise.resolve(0)),
  getReferralCount: jest.fn(() => Promise.resolve(0)),
  getStakingScoreFromPallet: jest.fn(() => Promise.resolve(0)),
  getTikiScore: jest.fn(() => Promise.resolve(0)),
  getAllScores: jest.fn(() =>
    Promise.resolve({
      trustScore: 0,
      referralScore: 0,
      stakingScore: 0,
      tikiScore: 0,
      totalScore: 0,
    })
  ),
  getScoreColor: jest.fn(() => '#22C55E'),
  getScoreRating: jest.fn(() => 'Good'),
  formatScore: jest.fn((score) => String(score)),
};
