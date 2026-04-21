import client from './client';

export interface ReferralStats {
  code: string;
  stats: {
    points_balance: number;
    total_referrals: number;
    completed_referrals: number;
    total_earned: number;
    total_spent: number;
    next_signup_points: number;
  };
}

export interface ReferralHistoryItem {
  referred_name: string;
  status: string; // 'registered' | 'first_purchase'
  points_earned: number;
  created_at: string;
}

export async function getReferralStats(): Promise<ReferralStats> {
  const {data} = await client.get<ReferralStats>('/referral/stats');
  return data;
}

export async function getReferralHistory(): Promise<ReferralHistoryItem[]> {
  const {data} = await client.get<ReferralHistoryItem[]>('/referral/history');
  return data;
}
