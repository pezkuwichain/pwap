/**
 * P2P Fiat Trading System - Production Grade (OKX-Style Internal Ledger)
 *
 * @module p2p-fiat
 * @description Enterprise-level P2P fiat-to-crypto trading with internal ledger escrow
 *
 * OKX Model Implementation:
 * - Blockchain transactions ONLY occur at deposit/withdraw
 * - P2P trades use internal database balance transfers
 * - No blockchain transactions during actual P2P trading
 */

import { ApiPromise } from '@pezkuwi/api';
import { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface PaymentMethod {
  id: string;
  currency: FiatCurrency;
  country: string;
  method_name: string;
  method_type: 'bank' | 'mobile_payment' | 'cash' | 'crypto_exchange';
  logo_url?: string;
  fields: Record<string, string>;
  validation_rules: Record<string, ValidationRule>;
  min_trade_amount: number;
  max_trade_amount?: number;
  processing_time_minutes: number;
  display_order: number;
}

export interface ValidationRule {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

// Fiat currencies including Kurdish Diaspora countries
export type FiatCurrency =
  | 'TRY'  // Turkish Lira (Turkey - 15M+ Kurds)
  | 'IQD'  // Iraqi Dinar (Kurdistan Region - 6M+ Kurds)
  | 'IRR'  // Iranian Rial (Rojhilat - 8M+ Kurds)
  | 'EUR'  // Euro (Germany, France, Netherlands, Belgium, Austria)
  | 'USD'  // US Dollar
  | 'GBP'  // British Pound (UK - 50K+ Kurds)
  | 'SEK'  // Swedish Krona (Sweden - 100K+ Kurds)
  | 'CHF'  // Swiss Franc (Switzerland - 30K+ Kurds)
  | 'NOK'  // Norwegian Krone (Norway - 30K+ Kurds)
  | 'DKK'  // Danish Krone (Denmark - 25K+ Kurds)
  | 'AUD'  // Australian Dollar (Australia - 20K+ Kurds)
  | 'CAD'; // Canadian Dollar (Canada - 30K+ Kurds)
export type CryptoToken = 'HEZ' | 'PEZ';

export type OfferStatus = 'open' | 'paused' | 'locked' | 'completed' | 'cancelled';
export type TradeStatus = 'pending' | 'payment_sent' | 'completed' | 'cancelled' | 'disputed' | 'refunded';

export interface P2PFiatOffer {
  id: string;
  seller_id: string;
  seller_wallet: string;
  token: CryptoToken;
  amount_crypto: number;
  fiat_currency: FiatCurrency;
  fiat_amount: number;
  price_per_unit: number;
  payment_method_id: string;
  payment_details_encrypted: string;
  min_order_amount?: number;
  max_order_amount?: number;
  time_limit_minutes: number;
  auto_reply_message?: string;
  min_buyer_completed_trades: number;
  min_buyer_reputation: number;
  status: OfferStatus;
  remaining_amount: number;
  escrow_tx_hash?: string;
  created_at: string;
  expires_at: string;
}

export interface P2PFiatTrade {
  id: string;
  offer_id: string;
  seller_id: string;
  buyer_id: string;
  buyer_wallet: string;
  crypto_amount: number;
  fiat_amount: number;
  price_per_unit: number;
  escrow_locked_amount: number;
  buyer_marked_paid_at?: string;
  buyer_payment_proof_url?: string;
  seller_confirmed_at?: string;
  status: TradeStatus;
  payment_deadline: string;
  confirmation_deadline?: string;
  created_at: string;
  completed_at?: string;
}

export interface P2PReputation {
  user_id: string;
  total_trades: number;
  completed_trades: number;
  cancelled_trades: number;
  disputed_trades: number;
  reputation_score: number;
  trust_level: 'new' | 'basic' | 'intermediate' | 'advanced' | 'verified';
  verified_merchant: boolean;
  avg_payment_time_minutes?: number;
  avg_confirmation_time_minutes?: number;
}

export interface CreateOfferParams {
  token: CryptoToken;
  amountCrypto: number;
  fiatCurrency: FiatCurrency;
  fiatAmount: number;
  paymentMethodId: string;
  paymentDetails: Record<string, string>;
  timeLimitMinutes?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  // NOTE: api and account no longer needed - uses internal ledger
}

export interface AcceptOfferParams {
  offerId: string;
  buyerWallet: string;
  amount?: number; // If partial order
  // NOTE: api and account no longer needed - uses internal ledger
}

// =====================================================
// INTERNAL BALANCE TYPES (OKX-Style)
// =====================================================

export interface InternalBalance {
  token: CryptoToken;
  available_balance: number;
  locked_balance: number;
  total_balance: number;
  total_deposited: number;
  total_withdrawn: number;
}

export interface DepositWithdrawRequest {
  id: string;
  user_id: string;
  request_type: 'deposit' | 'withdraw';
  token: CryptoToken;
  amount: number;
  wallet_address: string;
  blockchain_tx_hash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface BalanceTransaction {
  id: string;
  user_id: string;
  token: string;
  transaction_type: 'deposit' | 'withdraw' | 'escrow_lock' | 'escrow_release' | 'escrow_refund' | 'trade_receive' | 'admin_adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const PLATFORM_ESCROW_ADDRESS = '5DFwqK698vL4gXHEcanaewnAqhxJ2rjhAogpSTHw3iwGDwd3';

const ASSET_IDS = {
  HEZ: null, // Native token
  PEZ: 1
} as const;

const DEFAULT_PAYMENT_DEADLINE_MINUTES = 30;
const DEFAULT_CONFIRMATION_DEADLINE_MINUTES = 60;

// =====================================================
// PAYMENT METHODS
// =====================================================

/**
 * Fetch available payment methods for a currency
 */
export async function getPaymentMethods(currency: FiatCurrency): Promise<PaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('currency', currency)
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get payment methods error:', error);
    toast.error('Failed to load payment methods');
    return [];
  }
}

/**
 * Validate payment details against method rules
 */
export function validatePaymentDetails(
  paymentDetails: Record<string, string>,
  validationRules: Record<string, ValidationRule>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(validationRules)) {
    const value = paymentDetails[field] || '';

    if (rules.required && !value) {
      errors[field] = 'This field is required';
      continue;
    }

    if (rules.pattern && value) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors[field] = 'Invalid format';
      }
    }

    if (rules.minLength && value.length < rules.minLength) {
      errors[field] = `Minimum ${rules.minLength} characters`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors[field] = `Maximum ${rules.maxLength} characters`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// =====================================================
// ENCRYPTION (Simple symmetric encryption for demo)
// Production should use PGP or server-side encryption
// =====================================================

function encryptPaymentDetails(details: Record<string, string>): string {
  // TODO: Implement proper encryption (PGP or server-side)
  // For now, base64 encode (NOT SECURE - placeholder only)
  return btoa(JSON.stringify(details));
}

function decryptPaymentDetails(encrypted: string): Record<string, string> {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return {};
  }
}

// =====================================================
// CREATE OFFER
// =====================================================

/**
 * Create a new P2P fiat offer (OKX-Style Internal Ledger)
 *
 * Steps:
 * 1. Lock crypto from internal balance (NO blockchain tx)
 * 2. Create offer record in Supabase
 * 3. Update escrow tracking
 *
 * NOTE: Blockchain transactions only occur at deposit/withdraw
 */
export async function createFiatOffer(params: CreateOfferParams): Promise<string> {
  const {
    token,
    amountCrypto,
    fiatCurrency,
    fiatAmount,
    paymentMethodId,
    paymentDetails,
    timeLimitMinutes = DEFAULT_PAYMENT_DEADLINE_MINUTES,
    minOrderAmount,
    maxOrderAmount
  } = params;

  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    toast.info('Locking crypto from your balance...');

    // 1. Lock crypto from internal balance (NO blockchain tx!)
    const { data: lockResult, error: lockError } = await supabase.rpc('lock_escrow_internal', {
      p_user_id: userId,
      p_token: token,
      p_amount: amountCrypto
    });

    if (lockError) throw lockError;

    // Parse result
    const lockResponse = typeof lockResult === 'string' ? JSON.parse(lockResult) : lockResult;

    if (!lockResponse.success) {
      throw new Error(lockResponse.error || 'Failed to lock balance');
    }

    toast.success('Balance locked successfully');

    // 2. Encrypt payment details
    const encryptedDetails = encryptPaymentDetails(paymentDetails);

    // 3. Create offer in Supabase
    const { data: offer, error: offerError } = await supabase
      .from('p2p_fiat_offers')
      .insert({
        seller_id: userId,
        seller_wallet: '', // No longer needed with internal ledger
        token,
        amount_crypto: amountCrypto,
        fiat_currency: fiatCurrency,
        fiat_amount: fiatAmount,
        price_per_unit: fiatAmount / amountCrypto,
        payment_method_id: paymentMethodId,
        payment_details_encrypted: encryptedDetails,
        min_order_amount: minOrderAmount,
        max_order_amount: maxOrderAmount,
        time_limit_minutes: timeLimitMinutes,
        status: 'open',
        remaining_amount: amountCrypto,
        escrow_locked_at: new Date().toISOString()
        // NOTE: No escrow_tx_hash - internal ledger doesn't use blockchain during trades
      })
      .select()
      .single();

    if (offerError) throw offerError;

    // 4. Update the lock with offer reference
    await supabase.rpc('lock_escrow_internal', {
      p_user_id: userId,
      p_token: token,
      p_amount: 0, // Just updating reference, not locking more
      p_reference_type: 'offer',
      p_reference_id: offer.id
    }).catch(() => {}); // Non-critical, just for tracking

    // 5. Audit log
    await logAction('offer', offer.id, 'create_offer', {
      token,
      amount_crypto: amountCrypto,
      fiat_currency: fiatCurrency,
      fiat_amount: fiatAmount,
      escrow_type: 'internal_ledger'
    });

    toast.success(`Offer created! Selling ${amountCrypto} ${token} for ${fiatAmount} ${fiatCurrency}`);

    return offer.id;
  } catch (error: unknown) {
    console.error('Create offer error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create offer';
    toast.error(message);
    throw error;
  }
}

// =====================================================
// ACCEPT OFFER
// =====================================================

/**
 * Accept a P2P fiat offer (buyer)
 */
export async function acceptFiatOffer(params: AcceptOfferParams): Promise<string> {
  const { account, offerId, amount } = params;

  try {
    // 1. Get current user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Not authenticated');

    // 2. Get offer to determine amount if not specified
    const { data: offer, error: offerError } = await supabase
      .from('p2p_fiat_offers')
      .select('remaining_amount, min_buyer_completed_trades, min_buyer_reputation')
      .eq('id', offerId)
      .single();

    if (offerError) throw offerError;
    if (!offer) throw new Error('Offer not found');

    const tradeAmount = amount || offer.remaining_amount;

    // 3. Check buyer reputation requirements
    if (offer.min_buyer_completed_trades > 0 || offer.min_buyer_reputation > 0) {
      const { data: reputation } = await supabase
        .from('p2p_reputation')
        .select('completed_trades, reputation_score')
        .eq('user_id', user.user.id)
        .single();

      if (!reputation) {
        throw new Error('Seller requires experienced buyers');
      }
      if (reputation.completed_trades < offer.min_buyer_completed_trades) {
        throw new Error(`Minimum ${offer.min_buyer_completed_trades} completed trades required`);
      }
      if (reputation.reputation_score < offer.min_buyer_reputation) {
        throw new Error(`Minimum reputation score ${offer.min_buyer_reputation} required`);
      }
    }

    // 4. Call atomic database function (prevents race condition)
    // This uses FOR UPDATE lock to ensure only one buyer can claim the amount
    const { data: result, error: rpcError } = await supabase.rpc('accept_p2p_offer', {
      p_offer_id: offerId,
      p_buyer_id: user.user.id,
      p_buyer_wallet: account.address,
      p_amount: tradeAmount
    });

    if (rpcError) throw rpcError;

    // Parse result (may be string or object depending on Supabase version)
    const response = typeof result === 'string' ? JSON.parse(result) : result;

    if (!response.success) {
      throw new Error(response.error || 'Failed to accept offer');
    }

    // 5. Audit log
    await logAction('trade', response.trade_id, 'accept_offer', {
      offer_id: offerId,
      crypto_amount: response.crypto_amount,
      fiat_amount: response.fiat_amount
    });

    toast.success('Trade started! Send payment within time limit.');

    return response.trade_id;
  } catch (error: unknown) {
    console.error('Accept offer error:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept offer';
    toast.error(message);
    throw error;
  }
}

// =====================================================
// MARK PAYMENT SENT (Buyer)
// =====================================================

/**
 * Buyer marks payment as sent
 */
export async function markPaymentSent(
  tradeId: string,
  paymentProofFile?: File
): Promise<void> {
  try {
    let paymentProofUrl: string | undefined;

    // 1. Upload payment proof to IPFS if provided
    if (paymentProofFile) {
      const { uploadToIPFS } = await import('./ipfs');
      paymentProofUrl = await uploadToIPFS(paymentProofFile);
    }

    // 2. Update trade
    const confirmationDeadline = new Date(Date.now() + DEFAULT_CONFIRMATION_DEADLINE_MINUTES * 60 * 1000);

    const { error } = await supabase
      .from('p2p_fiat_trades')
      .update({
        buyer_marked_paid_at: new Date().toISOString(),
        buyer_payment_proof_url: paymentProofUrl,
        status: 'payment_sent',
        confirmation_deadline: confirmationDeadline.toISOString()
      })
      .eq('id', tradeId);

    if (error) throw error;

    // 3. Notify seller (push notification would go here)

    // 4. Audit log
    await logAction('trade', tradeId, 'mark_payment_sent', {
      payment_proof_url: paymentProofUrl
    });

    toast.success('Payment marked as sent. Waiting for seller confirmation...');
  } catch (error: any) {
    console.error('Mark payment sent error:', error);
    toast.error(error.message || 'Failed to mark payment as sent');
    throw error;
  }
}

// =====================================================
// CONFIRM PAYMENT RECEIVED (Seller)
// =====================================================

/**
 * Seller confirms payment received and releases crypto (OKX-Style Internal Ledger)
 *
 * This function transfers crypto from seller's locked balance to buyer's available balance.
 * NO blockchain transaction occurs - just database update.
 *
 * Buyer can later withdraw to external wallet if needed (separate blockchain tx).
 */
export async function confirmPaymentReceived(tradeId: string): Promise<void> {
  try {
    // 1. Get current user (seller)
    const { data: userData } = await supabase.auth.getUser();
    const sellerId = userData.user?.id;
    if (!sellerId) throw new Error('Not authenticated');

    // 2. Get trade details
    const { data: trade, error: tradeError } = await supabase
      .from('p2p_fiat_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError) throw tradeError;
    if (!trade) throw new Error('Trade not found');

    // Verify caller is the seller
    if (trade.seller_id !== sellerId) {
      throw new Error('Only seller can confirm payment');
    }

    if (trade.status !== 'payment_sent') {
      throw new Error('Payment has not been marked as sent');
    }

    // 3. Get offer to get token type
    const { data: offer } = await supabase
      .from('p2p_fiat_offers')
      .select('token')
      .eq('id', trade.offer_id)
      .single();

    if (!offer) throw new Error('Offer not found');

    toast.info('Releasing crypto to buyer...');

    // 4. Release escrow internally (NO blockchain tx!)
    // This transfers from seller's locked_balance to buyer's available_balance
    const { data: releaseResult, error: releaseError } = await supabase.rpc('release_escrow_internal', {
      p_from_user_id: trade.seller_id,
      p_to_user_id: trade.buyer_id,
      p_token: offer.token,
      p_amount: trade.crypto_amount,
      p_reference_type: 'trade',
      p_reference_id: tradeId
    });

    if (releaseError) throw releaseError;

    // Parse result
    const releaseResponse = typeof releaseResult === 'string' ? JSON.parse(releaseResult) : releaseResult;

    if (!releaseResponse.success) {
      throw new Error(releaseResponse.error || 'Failed to release escrow');
    }

    // 5. Update trade status
    const { error: updateError } = await supabase
      .from('p2p_fiat_trades')
      .update({
        seller_confirmed_at: new Date().toISOString(),
        escrow_released_at: new Date().toISOString(),
        status: 'completed',
        completed_at: new Date().toISOString()
        // NOTE: No escrow_release_tx_hash - internal ledger doesn't use blockchain during trades
      })
      .eq('id', tradeId);

    if (updateError) throw updateError;

    // 6. Update reputations
    await updateReputations(trade.seller_id, trade.buyer_id, tradeId);

    // 7. Audit log
    await logAction('trade', tradeId, 'confirm_payment', {
      released_amount: trade.crypto_amount,
      token: offer.token,
      escrow_type: 'internal_ledger'
    });

    toast.success('Payment confirmed! Crypto released to buyer\'s balance.');
  } catch (error: unknown) {
    console.error('Confirm payment error:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm payment';
    toast.error(message);
    throw error;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function signAndSendTx(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  tx: any
): Promise<string> {
  // Get signer from Polkadot.js extension
  const { web3FromSource } = await import('@pezkuwi/extension-dapp');
  const injector = await web3FromSource(account.meta.source);

  return new Promise((resolve, reject) => {
    let unsub: () => void;

    tx.signAndSend(
      account.address,
      { signer: injector.signer },
      ({ status, txHash, dispatchError }: any) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsub) unsub();
          return;
        }

        if (status.isInBlock || status.isFinalized) {
          resolve(txHash.toString());
          if (unsub) unsub();
        }
      }
    ).then((unsubscribe: () => void) => {
      unsub = unsubscribe;
    }).catch(reject);
  });
}

// NOTE: signAndSendWithPlatformKey removed - OKX-style internal ledger
// doesn't need blockchain transactions during P2P trades.
// Blockchain transactions only occur at deposit/withdraw via backend service.

async function updateReputations(sellerId: string, buyerId: string, tradeId: string): Promise<void> {
  await supabase.rpc('update_p2p_reputation', {
    p_seller_id: sellerId,
    p_buyer_id: buyerId,
    p_trade_id: tradeId
  });
}

async function logAction(
  entityType: string,
  entityId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  
  await supabase.from('p2p_audit_log').insert({
    user_id: user.user?.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details
  });
}

// =====================================================
// QUERY FUNCTIONS
// =====================================================

export async function getActiveOffers(
  currency?: FiatCurrency,
  token?: CryptoToken
): Promise<P2PFiatOffer[]> {
  try {
    let query = supabase
      .from('p2p_fiat_offers')
      .select('*')
      .eq('status', 'open')
      .gt('remaining_amount', 0)
      .gt('expires_at', new Date().toISOString())
      .order('price_per_unit');

    if (currency) query = query.eq('fiat_currency', currency);
    if (token) query = query.eq('token', token);

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Get active offers error:', error);
    return [];
  }
}

export async function getUserTrades(userId: string): Promise<P2PFiatTrade[]> {
  try {
    const { data, error } = await supabase
      .from('p2p_fiat_trades')
      .select('*')
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get user trades error:', error);
    return [];
  }
}

export async function getUserReputation(userId: string): Promise<P2PReputation | null> {
  try {
    const { data, error } = await supabase
      .from('p2p_reputation')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get user reputation error:', error);
    return null;
  }
}

/**
 * Get a specific trade by ID
 */
export async function getTradeById(tradeId: string): Promise<P2PFiatTrade | null> {
  try {
    const { data, error } = await supabase
      .from('p2p_fiat_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get trade by ID error:', error);
    return null;
  }
}

/**
 * Cancel a trade (buyer only, before payment sent)
 */
export async function cancelTrade(
  tradeId: string,
  cancelledBy: string,
  reason?: string
): Promise<void> {
  try {
    // 1. Get trade details
    const { data: trade, error: tradeError } = await supabase
      .from('p2p_fiat_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError) throw tradeError;
    if (!trade) throw new Error('Trade not found');

    // Only allow cancellation if pending
    if (trade.status !== 'pending') {
      throw new Error('Trade cannot be cancelled at this stage');
    }

    // 2. Update trade status
    const { error: updateError } = await supabase
      .from('p2p_fiat_trades')
      .update({
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancel_reason: reason,
      })
      .eq('id', tradeId);

    if (updateError) throw updateError;

    // 3. Restore offer remaining amount
    const { data: offer } = await supabase
      .from('p2p_fiat_offers')
      .select('remaining_amount')
      .eq('id', trade.offer_id)
      .single();

    if (offer) {
      await supabase
        .from('p2p_fiat_offers')
        .update({
          remaining_amount: offer.remaining_amount + trade.crypto_amount,
          status: 'open',
        })
        .eq('id', trade.offer_id);
    }

    // 4. Audit log
    await logAction('trade', tradeId, 'cancel_trade', {
      cancelled_by: cancelledBy,
      reason,
    });

    toast.success('Trade cancelled successfully');
  } catch (error: unknown) {
    console.error('Cancel trade error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel trade';
    toast.error(message);
    throw error;
  }
}

/**
 * Update user reputation after trade completion
 */
export async function updateUserReputation(
  userId: string,
  tradeCompleted: boolean
): Promise<void> {
  try {
    // Get current reputation
    const { data: currentRep } = await supabase
      .from('p2p_reputation')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentRep) {
      // Update existing reputation
      await supabase
        .from('p2p_reputation')
        .update({
          total_trades: currentRep.total_trades + 1,
          completed_trades: tradeCompleted
            ? currentRep.completed_trades + 1
            : currentRep.completed_trades,
          cancelled_trades: tradeCompleted
            ? currentRep.cancelled_trades
            : currentRep.cancelled_trades + 1,
          reputation_score: tradeCompleted
            ? Math.min(100, currentRep.reputation_score + 1)
            : Math.max(0, currentRep.reputation_score - 2),
        })
        .eq('user_id', userId);
    } else {
      // Create new reputation record
      await supabase.from('p2p_reputation').insert({
        user_id: userId,
        total_trades: 1,
        completed_trades: tradeCompleted ? 1 : 0,
        cancelled_trades: tradeCompleted ? 0 : 1,
        reputation_score: tradeCompleted ? 50 : 48,
        trust_level: 'new',
        verified_merchant: false,
        fast_trader: false,
      });
    }
  } catch (error) {
    console.error('Update reputation error:', error);
  }
}

// =====================================================
// INTERNAL BALANCE FUNCTIONS (OKX-Style)
// =====================================================

/**
 * Get user's internal balances for P2P trading
 */
export async function getInternalBalances(): Promise<InternalBalance[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_user_internal_balance', {
      p_user_id: userId
    });

    if (error) throw error;

    // Parse the JSON result
    const balances = typeof data === 'string' ? JSON.parse(data) : data;
    return balances || [];
  } catch (error) {
    console.error('Get internal balances error:', error);
    return [];
  }
}

/**
 * Get user's internal balance for a specific token
 */
export async function getInternalBalance(token: CryptoToken): Promise<InternalBalance | null> {
  const balances = await getInternalBalances();
  return balances.find(b => b.token === token) || null;
}

/**
 * Request a withdrawal from internal balance to external wallet
 * This creates a pending request that will be processed by backend service
 */
export async function requestWithdraw(
  token: CryptoToken,
  amount: number,
  walletAddress: string
): Promise<string> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    // Validate amount
    if (amount <= 0) throw new Error('Amount must be greater than 0');

    // Validate wallet address (basic check)
    if (!walletAddress || walletAddress.length < 40) {
      throw new Error('Invalid wallet address');
    }

    toast.info('Processing withdrawal request...');

    // Call the database function
    const { data, error } = await supabase.rpc('request_withdraw', {
      p_user_id: userId,
      p_token: token,
      p_amount: amount,
      p_wallet_address: walletAddress
    });

    if (error) throw error;

    // Parse result
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      throw new Error(result.error || 'Withdrawal request failed');
    }

    toast.success(`Withdrawal request submitted! ${amount} ${token} will be sent to your wallet.`);

    return result.request_id;
  } catch (error: unknown) {
    console.error('Request withdraw error:', error);
    const message = error instanceof Error ? error.message : 'Withdrawal request failed';
    toast.error(message);
    throw error;
  }
}

/**
 * Get user's deposit/withdraw request history
 */
export async function getDepositWithdrawHistory(): Promise<DepositWithdrawRequest[]> {
  try {
    const { data, error } = await supabase
      .from('p2p_deposit_withdraw_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get deposit/withdraw history error:', error);
    return [];
  }
}

/**
 * Get user's balance transaction history
 */
export async function getBalanceTransactionHistory(limit: number = 50): Promise<BalanceTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('p2p_balance_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get balance transaction history error:', error);
    return [];
  }
}

/**
 * Get platform escrow wallet address (for deposits)
 */
export async function getPlatformWalletAddress(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('p2p_config')
      .select('value')
      .eq('key', 'platform_escrow_wallet')
      .single();

    if (error) throw error;
    return data?.value || PLATFORM_ESCROW_ADDRESS;
  } catch (error) {
    console.error('Get platform wallet address error:', error);
    return PLATFORM_ESCROW_ADDRESS;
  }
}

/**
 * Verify a deposit transaction and credit internal balance
 * NOTE: In production, this should be called by backend service after verifying on-chain
 */
export async function verifyDeposit(
  txHash: string,
  token: CryptoToken,
  amount: number
): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    toast.info('Verifying deposit...');

    // Call the database function
    const { data, error } = await supabase.rpc('process_deposit', {
      p_user_id: userId,
      p_token: token,
      p_amount: amount,
      p_tx_hash: txHash
    });

    if (error) throw error;

    // Parse result
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      throw new Error(result.error || 'Deposit verification failed');
    }

    toast.success(`Deposit verified! ${amount} ${token} added to your balance.`);

    return true;
  } catch (error: unknown) {
    console.error('Verify deposit error:', error);
    const message = error instanceof Error ? error.message : 'Deposit verification failed';
    toast.error(message);
    return false;
  }
}
