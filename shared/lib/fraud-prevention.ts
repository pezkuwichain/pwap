/**
 * P2P Fraud Prevention System
 * Auto-detection rules and risk scoring
 */

// Risk score thresholds
export const RISK_THRESHOLDS = {
  LOW: 20,
  MEDIUM: 50,
  HIGH: 80,
  CRITICAL: 95
} as const;

// Risk level types
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Fraud indicators
export interface FraudIndicators {
  cancelRate: number;         // Percentage of cancelled trades
  disputeRate: number;        // Percentage of disputed trades
  avgTradeAmount: number;     // Average trade amount
  accountAge: number;         // Account age in days
  completedTrades: number;    // Total completed trades
  recentCancellations: number; // Cancellations in last 24h
  recentDisputes: number;     // Disputes in last 7 days
  paymentNameMismatch: boolean; // Payment account name doesn't match
  rapidTrading: boolean;      // Too many trades in short period
  unusualAmount: boolean;     // Trade amount significantly higher than usual
  newAccountLargeTrade: boolean; // New account with large trade
  multipleAccounts: boolean;  // Suspected multiple accounts
}

// Risk score result
export interface RiskScoreResult {
  score: number;              // 0-100 risk score
  level: RiskLevel;           // Risk level classification
  flags: string[];            // Active fraud flags
  recommendations: string[];  // Recommended actions
  autoBlock: boolean;         // Should auto-block this user/trade
  requiresReview: boolean;    // Should flag for manual review
}

// Fraud detection rules
export interface FraudRule {
  id: string;
  name: string;
  description: string;
  weight: number;             // Score weight (how much this adds to risk)
  check: (indicators: FraudIndicators) => boolean;
  action: 'flag' | 'review' | 'block';
}

// Define fraud detection rules
export const FRAUD_RULES: FraudRule[] = [
  {
    id: 'high_cancel_rate',
    name: 'High Cancellation Rate',
    description: 'User has cancelled more than 30% of their trades',
    weight: 25,
    check: (ind) => ind.cancelRate > 30,
    action: 'review'
  },
  {
    id: 'frequent_disputes',
    name: 'Frequent Disputes',
    description: 'User has dispute rate higher than 20%',
    weight: 30,
    check: (ind) => ind.disputeRate > 20,
    action: 'review'
  },
  {
    id: 'recent_cancellations',
    name: 'Multiple Recent Cancellations',
    description: 'More than 3 cancellations in the last 24 hours',
    weight: 35,
    check: (ind) => ind.recentCancellations > 3,
    action: 'block'
  },
  {
    id: 'new_account_large_trade',
    name: 'New Account Large Trade',
    description: 'Account less than 7 days old attempting trade over $1000',
    weight: 40,
    check: (ind) => ind.newAccountLargeTrade,
    action: 'review'
  },
  {
    id: 'payment_name_mismatch',
    name: 'Payment Name Mismatch',
    description: 'Payment account name does not match user profile',
    weight: 20,
    check: (ind) => ind.paymentNameMismatch,
    action: 'flag'
  },
  {
    id: 'rapid_trading',
    name: 'Rapid Trading Pattern',
    description: 'Unusually high number of trades in a short period',
    weight: 25,
    check: (ind) => ind.rapidTrading,
    action: 'review'
  },
  {
    id: 'unusual_amount',
    name: 'Unusual Trade Amount',
    description: 'Trade amount significantly higher than user average',
    weight: 15,
    check: (ind) => ind.unusualAmount,
    action: 'flag'
  },
  {
    id: 'no_trading_history',
    name: 'No Trading History',
    description: 'User has no completed trades',
    weight: 10,
    check: (ind) => ind.completedTrades === 0,
    action: 'flag'
  },
  {
    id: 'suspected_multi_account',
    name: 'Suspected Multiple Accounts',
    description: 'Pattern suggests user has multiple accounts',
    weight: 50,
    check: (ind) => ind.multipleAccounts,
    action: 'block'
  },
  {
    id: 'very_new_account',
    name: 'Very New Account',
    description: 'Account created less than 24 hours ago',
    weight: 15,
    check: (ind) => ind.accountAge < 1,
    action: 'flag'
  }
];

/**
 * Calculate risk score based on fraud indicators
 */
export function calculateRiskScore(indicators: FraudIndicators): RiskScoreResult {
  let score = 0;
  const flags: string[] = [];
  const recommendations: string[] = [];
  let autoBlock = false;
  let requiresReview = false;

  // Check each rule
  for (const rule of FRAUD_RULES) {
    if (rule.check(indicators)) {
      score += rule.weight;
      flags.push(rule.name);

      if (rule.action === 'block') {
        autoBlock = true;
        recommendations.push(`Block: ${rule.description}`);
      } else if (rule.action === 'review') {
        requiresReview = true;
        recommendations.push(`Review: ${rule.description}`);
      } else {
        recommendations.push(`Monitor: ${rule.description}`);
      }
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine risk level
  let level: RiskLevel;
  if (score >= RISK_THRESHOLDS.CRITICAL) {
    level = 'critical';
    autoBlock = true;
  } else if (score >= RISK_THRESHOLDS.HIGH) {
    level = 'high';
    requiresReview = true;
  } else if (score >= RISK_THRESHOLDS.MEDIUM) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score,
    level,
    flags,
    recommendations,
    autoBlock,
    requiresReview
  };
}

/**
 * Trade limits based on user trust level
 */
export const TRADE_LIMITS = {
  new: {
    maxTradeAmount: 100,     // Max $100 per trade
    maxDailyTrades: 3,       // Max 3 trades per day
    maxDailyVolume: 200,     // Max $200 daily volume
    paymentDeadlineMinutes: 30,
    requiresVerification: false
  },
  basic: {
    maxTradeAmount: 500,
    maxDailyTrades: 5,
    maxDailyVolume: 1000,
    paymentDeadlineMinutes: 30,
    requiresVerification: false
  },
  intermediate: {
    maxTradeAmount: 2000,
    maxDailyTrades: 10,
    maxDailyVolume: 5000,
    paymentDeadlineMinutes: 45,
    requiresVerification: true
  },
  advanced: {
    maxTradeAmount: 10000,
    maxDailyTrades: 20,
    maxDailyVolume: 25000,
    paymentDeadlineMinutes: 60,
    requiresVerification: true
  },
  verified: {
    maxTradeAmount: 50000,
    maxDailyTrades: 50,
    maxDailyVolume: 100000,
    paymentDeadlineMinutes: 120,
    requiresVerification: true
  }
} as const;

export type TrustLevel = keyof typeof TRADE_LIMITS;

/**
 * Check if a trade is within user's limits
 */
export function checkTradeWithinLimits(
  tradeAmount: number,
  trustLevel: TrustLevel,
  todayTradeCount: number,
  todayVolume: number
): { allowed: boolean; reason?: string } {
  const limits = TRADE_LIMITS[trustLevel];

  if (tradeAmount > limits.maxTradeAmount) {
    return {
      allowed: false,
      reason: `Trade amount exceeds your limit of $${limits.maxTradeAmount}. Upgrade your trust level for higher limits.`
    };
  }

  if (todayTradeCount >= limits.maxDailyTrades) {
    return {
      allowed: false,
      reason: `You've reached your daily trade limit of ${limits.maxDailyTrades} trades.`
    };
  }

  if (todayVolume + tradeAmount > limits.maxDailyVolume) {
    return {
      allowed: false,
      reason: `This trade would exceed your daily volume limit of $${limits.maxDailyVolume}.`
    };
  }

  return { allowed: true };
}

/**
 * Analyze trade for fraud patterns
 */
export function analyzeTradeForFraud(
  tradeAmount: number,
  userAvgTradeAmount: number,
  accountAgeDays: number,
  completedTrades: number
): Pick<FraudIndicators, 'unusualAmount' | 'newAccountLargeTrade'> {
  // Check if amount is unusual (3x average)
  const unusualAmount = userAvgTradeAmount > 0 && tradeAmount > userAvgTradeAmount * 3;

  // Check new account with large trade
  const newAccountLargeTrade = accountAgeDays < 7 && tradeAmount > 1000;

  return {
    unusualAmount,
    newAccountLargeTrade
  };
}

/**
 * Cooldown periods after suspicious activity
 */
export const COOLDOWN_PERIODS = {
  afterCancellation: 5 * 60 * 1000,      // 5 minutes after cancelling a trade
  afterDispute: 24 * 60 * 60 * 1000,     // 24 hours after a dispute
  afterBlock: 7 * 24 * 60 * 60 * 1000,   // 7 days after being blocked
  betweenTrades: 1 * 60 * 1000           // 1 minute between accepting trades
} as const;

/**
 * Check if user is in cooldown period
 */
export function isInCooldown(
  lastCancellation: Date | null,
  lastDispute: Date | null,
  lastTrade: Date | null
): { inCooldown: boolean; reason?: string; remainingMs?: number } {
  const now = Date.now();

  if (lastCancellation) {
    const timeSince = now - lastCancellation.getTime();
    if (timeSince < COOLDOWN_PERIODS.afterCancellation) {
      return {
        inCooldown: true,
        reason: 'Please wait before creating a new trade after cancellation',
        remainingMs: COOLDOWN_PERIODS.afterCancellation - timeSince
      };
    }
  }

  if (lastDispute) {
    const timeSince = now - lastDispute.getTime();
    if (timeSince < COOLDOWN_PERIODS.afterDispute) {
      return {
        inCooldown: true,
        reason: 'Trading restricted due to recent dispute',
        remainingMs: COOLDOWN_PERIODS.afterDispute - timeSince
      };
    }
  }

  if (lastTrade) {
    const timeSince = now - lastTrade.getTime();
    if (timeSince < COOLDOWN_PERIODS.betweenTrades) {
      return {
        inCooldown: true,
        reason: 'Please wait a moment before accepting another trade',
        remainingMs: COOLDOWN_PERIODS.betweenTrades - timeSince
      };
    }
  }

  return { inCooldown: false };
}

/**
 * Reputation penalties for different infractions
 */
export const REPUTATION_PENALTIES = {
  tradeCancellation: -5,           // Cancelled a trade
  disputeLost: -15,                // Lost a dispute
  fraudConfirmed: -50,             // Confirmed fraud
  paymentTimeout: -10,             // Failed to pay in time
  confirmationTimeout: -3,         // Late confirmation (seller)
  reportedByOthers: -8             // Reported by multiple users
} as const;

/**
 * Reputation rewards for good behavior
 */
export const REPUTATION_REWARDS = {
  tradeCompleted: 5,               // Successfully completed trade
  disputeWon: 10,                  // Won a dispute (vindicated)
  fastPayment: 2,                  // Paid within 5 minutes
  fastConfirmation: 2,             // Confirmed within 10 minutes
  milestone10Trades: 25,           // Completed 10 trades
  milestone50Trades: 50,           // Completed 50 trades
  milestone100Trades: 100,         // Completed 100 trades
  verifiedMerchant: 200            // Achieved verified merchant status
} as const;
