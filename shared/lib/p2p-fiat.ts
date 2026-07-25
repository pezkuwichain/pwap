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
  userId: string;
  /** Citizen/visa identity id (needed to authorize the escrow lock) */
  identityId: string;
  sellerWallet: string;
  token: CryptoToken;
  amountCrypto: number;
  fiatCurrency: FiatCurrency;
  fiatAmount: number;
  paymentMethodId: string;
  paymentDetails: Record<string, string>;
  timeLimitMinutes?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  adType?: 'buy' | 'sell';
  /** Signs a message with the wallet that owns `identityId` (signRaw) */
  signMessage: (message: string) => Promise<string>;
}

export interface AcceptOfferParams {
  offerId: string;
  buyerUserId: string;
  buyerWallet: string;
  amount?: number; // If partial order
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

const PLATFORM_ESCROW_ADDRESS = '5H18ZZBU4LwPYbeEZ1JBGvibCU2edhhM8HNUtFi7GgC36CgS';

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
// ENCRYPTION (AES-256-GCM - OKX-Level Security)
// =====================================================

const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from a password/secret
 * In production, this should use a server-side secret
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Use a combination of user-specific and app-wide secret
  // In production, this should be fetched from secure storage
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('p2p-payment-encryption-v1-pezkuwi'),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('pezkuwi-p2p-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt payment details using AES-256-GCM
 */
async function encryptPaymentDetails(details: Record<string, string>): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(details));

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    // Fallback to base64 for backwards compatibility (temporary)
    return btoa(JSON.stringify(details));
  }
}

/**
 * Decrypt payment details using AES-256-GCM
 */
async function decryptPaymentDetails(encrypted: string): Promise<Record<string, string>> {
  try {
    const key = await getEncryptionKey();

    // Decode base64
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    // Fallback: try to decode as plain base64 (for old data)
    try {
      return JSON.parse(atob(encrypted));
    } catch {
      return {};
    }
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
/**
 * Canonical lock-escrow challenge. MUST be byte-identical to the server
 * buildLockEscrowChallenge (web/supabase/functions/_shared/identity-auth.ts).
 */
export function buildLockEscrowChallenge(p: {
  identityId: string;
  token: string;
  amount: number;
  signerAddress: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    'Pezkuwi P2P Lock Escrow',
    `identity:${p.identityId}`,
    `token:${p.token}`,
    `amount:${p.amount}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n');
}

/**
 * Canonical confirm-payment challenge. MUST be byte-identical to the server
 * buildConfirmPaymentChallenge (web/supabase/functions/_shared/identity-auth.ts).
 */
export function buildConfirmPaymentChallenge(p: {
  tradeId: string;
  sellerIdentity: string;
  signerAddress: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    'Pezkuwi P2P Confirm Payment',
    `trade:${p.tradeId}`,
    `identity:${p.sellerIdentity}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n');
}

export async function createFiatOffer(params: CreateOfferParams): Promise<string> {
  const {
    userId,
    identityId,
    sellerWallet,
    token,
    amountCrypto,
    fiatCurrency,
    fiatAmount,
    paymentMethodId,
    paymentDetails,
    timeLimitMinutes = DEFAULT_PAYMENT_DEADLINE_MINUTES,
    minOrderAmount,
    maxOrderAmount,
    adType = 'sell',
    signMessage
  } = params;

  try {
    if (!userId) throw new Error('Identity required for P2P trading');
    if (!identityId) throw new Error('Identity required for P2P trading');
    if (!sellerWallet) throw new Error('Connect a wallet to create an offer');

    // 1. Lock crypto from internal balance via the authorized edge function.
    //    lock_escrow_internal is no longer callable with the anon key; the
    //    seller must sign a challenge proving they own the identity being locked.
    const lockTimestamp = Date.now();
    const lockNonce = `lk-${lockTimestamp}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const lockChallenge = buildLockEscrowChallenge({
      identityId,
      token,
      amount: amountCrypto,
      signerAddress: sellerWallet,
      timestamp: lockTimestamp,
      nonce: lockNonce,
    });

    toast.info('Sign to lock crypto from your balance...');
    const lockSignature = await signMessage(lockChallenge);

    const { data: lockResult, error: lockError } = await supabase.functions.invoke('lock-escrow', {
      body: {
        identityId,
        token,
        amount: amountCrypto,
        signerAddress: sellerWallet,
        signature: lockSignature,
        timestamp: lockTimestamp,
        nonce: lockNonce,
      },
    });

    if (lockError) throw lockError;

    // Parse result
    const lockResponse = typeof lockResult === 'string' ? JSON.parse(lockResult) : lockResult;

    if (!lockResponse?.success) {
      throw new Error(lockResponse?.error || 'Failed to lock balance');
    }

    toast.success('Balance locked successfully');

    // 2. Encrypt payment details (AES-256-GCM)
    const encryptedDetails = await encryptPaymentDetails(paymentDetails);

    // 3. Create offer in Supabase
    const { data: offer, error: offerError } = await supabase
      .from('p2p_fiat_offers')
      .insert({
        seller_id: userId,
        seller_wallet: sellerWallet,
        ad_type: adType,
        token,
        amount_crypto: amountCrypto,
        fiat_currency: fiatCurrency,
        fiat_amount: fiatAmount,
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

    // (Removed) The previous amount=0 lock_escrow_internal "reference update" call
    // was a no-op that only logged a zero-amount ledger row. lock_escrow_internal
    // is now service-role only, so this cosmetic call is dropped entirely.

    // 5. Audit log
    await logAction('offer', offer.id, 'create_offer', {
      token,
      amount_crypto: amountCrypto,
      fiat_currency: fiatCurrency,
      fiat_amount: fiatAmount,
      escrow_type: 'internal_ledger'
    }, userId);

    toast.success(`Offer created! Selling ${amountCrypto} ${token} for ${fiatAmount} ${fiatCurrency}`);

    return offer.id;
  } catch (error: unknown) {
    console.error('Create offer error:', error);
    const message = error instanceof Error ? error.message : (error as any)?.message || (error as any)?.details || 'Failed to create offer';
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
  const { offerId, buyerUserId, buyerWallet, amount } = params;

  try {
    if (!buyerUserId) throw new Error('Identity required for P2P trading');

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
        .eq('user_id', buyerUserId)
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
      p_buyer_id: buyerUserId,
      p_buyer_wallet: buyerWallet,
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
    }, buyerUserId);

    toast.success('Trade started! Send payment within time limit.');

    return response.trade_id;
  } catch (error: unknown) {
    console.error('Accept offer error:', error);
    const message = error instanceof Error
      ? error.message
      : (error as any)?.message || (error as any)?.details || JSON.stringify(error) || 'Failed to accept offer';
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

    // 1. Upload payment proof to Supabase Storage (auto-expires in 1 day)
    if (paymentProofFile) {
      const fileName = `payment-proofs/${tradeId}/${Date.now()}-${paymentProofFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('p2p-payment-proofs')
        .upload(fileName, paymentProofFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('p2p-payment-proofs')
        .getPublicUrl(uploadData.path);

      paymentProofUrl = urlData.publicUrl;
    }

    // 2. Update trade (proof expires in 1 day unless disputed)
    const confirmationDeadline = new Date(Date.now() + DEFAULT_CONFIRMATION_DEADLINE_MINUTES * 60 * 1000);
    const proofExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

    const { error } = await supabase
      .from('p2p_fiat_trades')
      .update({
        buyer_marked_paid_at: new Date().toISOString(),
        buyer_payment_proof_url: paymentProofUrl,
        proof_expires_at: paymentProofUrl ? proofExpiresAt.toISOString() : null,
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
export async function confirmPaymentReceived(
  tradeId: string,
  sellerIdentity: string,
  signerAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<void> {
  try {
    if (!sellerIdentity) throw new Error('Identity required for P2P trading');
    if (!signerAddress) throw new Error('Connect a wallet to release escrow');

    // Release is a money-OUT action: it is authorized ONLY via the confirm-payment
    // edge function, which verifies the seller's wallet signature + identity
    // ownership before calling release_escrow_internal with the service role.
    // release_escrow_internal is no longer callable with the anon key.
    const timestamp = Date.now();
    const nonce = `cp-${timestamp}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const challenge = buildConfirmPaymentChallenge({
      tradeId,
      sellerIdentity,
      signerAddress,
      timestamp,
      nonce,
    });

    toast.info('Sign to release crypto to the buyer...');
    const signature = await signMessage(challenge);

    const { data, error } = await supabase.functions.invoke('confirm-payment', {
      body: { tradeId, sellerIdentity, signerAddress, signature, timestamp, nonce },
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to release escrow');
    }

    // Non-financial follow-ups (best effort). The escrow move + trade status
    // change already happened atomically server-side.
    try {
      await updateReputations(data.sellerId, data.buyerId, tradeId);
      await logAction('trade', tradeId, 'confirm_payment', {
        released_amount: data.amount,
        token: data.token,
        escrow_type: 'internal_ledger'
      }, data.sellerId);
    } catch (followupErr) {
      console.error('Post-release follow-up failed (non-critical):', followupErr);
    }

    toast.success('Payment confirmed! Crypto released to buyer\'s balance.');
  } catch (error: unknown) {
    console.error('Confirm payment error:', error);
    const message = error instanceof Error ? error.message : (error as any)?.message || (error as any)?.details || 'Failed to confirm payment';
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
  details: Record<string, any>,
  userId?: string
): Promise<void> {
  await supabase.from('p2p_audit_log').insert({
    user_id: userId || null,
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
        cancellation_reason: reason,
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
    }, cancelledBy);

    toast.success('Trade cancelled successfully');
  } catch (error: unknown) {
    console.error('Cancel trade error:', error);
    const message = error instanceof Error ? error.message : (error as any)?.message || (error as any)?.details || 'Failed to cancel trade';
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
export async function getInternalBalances(userId: string): Promise<InternalBalance[]> {
  try {
    if (!userId) throw new Error('Identity required for P2P trading');

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
export async function getInternalBalance(userId: string, token: CryptoToken): Promise<InternalBalance | null> {
  const balances = await getInternalBalances(userId);
  return balances.find(b => b.token === token) || null;
}

/**
 * Canonical withdrawal challenge string. MUST be byte-identical to the server's
 * buildWithdrawChallenge (web/supabase/functions/_shared/identity-auth.ts).
 */
export function buildWithdrawChallenge(p: {
  identityId: string;
  token: string;
  amount: number;
  destination: string;
  signerAddress: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    'Pezkuwi P2P Withdrawal',
    `identity:${p.identityId}`,
    `token:${p.token}`,
    `amount:${p.amount}`,
    `destination:${p.destination}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n');
}

/**
 * Request a withdrawal from internal balance to external wallet.
 *
 * AUTHORIZATION: the caller must prove ownership of the P2P identity by signing
 * a challenge with the wallet that owns it (citizen NFT / visa). The edge
 * function derives the user_id server-side from `identityId` after verifying the
 * signature and identity ownership — a client-supplied user_id is never trusted.
 *
 * @param identityId    Citizen number (#42-<item>-<6d>) or visa number (V-XXXXXX)
 * @param signerAddress The connected wallet (must own the identity)
 * @param signMessage   Signs a message with the connected wallet (signRaw)
 */
export async function requestWithdraw(
  identityId: string,
  token: CryptoToken,
  amount: number,
  walletAddress: string,
  signerAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<string> {
  try {
    if (!identityId) throw new Error('Identity required for P2P trading');
    if (!signerAddress) throw new Error('Connect a wallet to withdraw');

    // Validate amount
    if (amount <= 0) throw new Error('Amount must be greater than 0');

    // Validate wallet address (basic check)
    if (!walletAddress || walletAddress.length < 40) {
      throw new Error('Invalid wallet address');
    }

    // Build + sign the authorization challenge binding the full withdrawal intent.
    const timestamp = Date.now();
    const nonce = `wd-${timestamp}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const challenge = buildWithdrawChallenge({
      identityId,
      token,
      amount,
      destination: walletAddress,
      signerAddress,
      timestamp,
      nonce,
    });

    toast.info('Sign the request in your wallet to authorize the withdrawal...');
    const signature = await signMessage(challenge);

    toast.info('Processing withdrawal...');

    const { data, error, response } = await supabase.functions.invoke('process-withdraw', {
      body: { identityId, token, amount, walletAddress, signerAddress, signature, timestamp, nonce }
    });

    // Supabase client wraps non-2xx as generic FunctionsHttpError (data=null).
    // Extract the actual error from the unread response body.
    if (error) {
      let errorMessage = 'Withdrawal failed';
      if (response) {
        try {
          const body = await response.json();
          errorMessage = body?.error || errorMessage;
        } catch { /* response body already consumed or not JSON */ }
      }
      throw new Error(errorMessage);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Withdrawal failed');
    }

    toast.success(`${amount} ${token} sent to your wallet! TX: ${data.txHash?.slice(0, 10)}...`);

    return data.txHash || '';
  } catch (error: unknown) {
    console.error('Request withdraw error:', error);
    const message = error instanceof Error ? error.message : (error as any)?.message || (error as any)?.details || 'Withdrawal failed';
    toast.error(message);
    throw error;
  }
}

/**
 * Get user's deposit/withdraw request history
 */
export async function getDepositWithdrawHistory(userId: string): Promise<DepositWithdrawRequest[]> {
  try {
    if (!userId) throw new Error('Identity required for P2P trading');

    // Scoped SECURITY DEFINER RPC (direct table SELECT is no longer world-open).
    const { data, error } = await supabase.rpc('get_user_deposit_withdraw_requests', {
      p_user_id: userId,
      p_limit: 50,
    });

    if (error) throw error;
    return (data as DepositWithdrawRequest[]) || [];
  } catch (error) {
    console.error('Get deposit/withdraw history error:', error);
    return [];
  }
}

/**
 * Get user's balance transaction history
 */
export async function getBalanceTransactionHistory(userId: string, limit: number = 50): Promise<BalanceTransaction[]> {
  try {
    if (!userId) throw new Error('Identity required for P2P trading');

    // Scoped SECURITY DEFINER RPC — returns only this user's ledger rows
    // (the previous unfiltered SELECT * exposed every user's transactions).
    const { data, error } = await supabase.rpc('get_user_balance_transactions', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) throw error;
    return (data as BalanceTransaction[]) || [];
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
 * @deprecated DO NOT USE - Use Edge Function 'verify-deposit' instead
 *
 * This function is DISABLED for security reasons.
 * Deposits must be verified through the backend Edge Function which:
 * 1. Verifies the transaction exists on-chain
 * 2. Confirms the recipient is the platform wallet
 * 3. Validates the amount matches
 * 4. Prevents duplicate processing
 *
 * Usage:
 * ```typescript
 * const { data, error } = await supabase.functions.invoke('verify-deposit', {
 *   body: { txHash, token, expectedAmount }
 * });
 * ```
 */
export async function verifyDeposit(
  _txHash: string,
  _token: CryptoToken,
  _amount: number
): Promise<boolean> {
  console.error(
    '[SECURITY] verifyDeposit() is disabled. Use Edge Function "verify-deposit" instead.'
  );
  toast.error('Please use the secure verification method. Contact support if this persists.');
  return false;
}
