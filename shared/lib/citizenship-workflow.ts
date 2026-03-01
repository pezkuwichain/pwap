// ========================================
// Citizenship Workflow Library
// ========================================
// Handles citizenship verification, status checks, and workflow logic

import type { ApiPromise } from '@pezkuwi/api';
import { encodeAddress } from '@pezkuwi/util-crypto';
import { getSigner } from '@/lib/get-signer';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';

import type { Signer } from '@pezkuwi/api/types';

type WalletSource = 'extension' | 'walletconnect' | 'native' | null;

interface SignRawPayload {
  address: string;
  data: string;
  type: string;
}

interface SignRawResult {
  signature: string;
}

interface InjectedSigner {
  signRaw?: (payload: SignRawPayload) => Promise<SignRawResult>;
}

// ========================================
// TYPE DEFINITIONS
// ========================================

export type KycStatus = 'NotStarted' | 'PendingReferral' | 'ReferrerApproved' | 'Approved' | 'Revoked';

export type Region =
  | 'bakur'       // North (Turkey)
  | 'basur'       // South (Iraq)
  | 'rojava'      // West (Syria)
  | 'rojhelat'    // East (Iran)
  | 'diaspora'    // Diaspora
  | 'kurdistan_a_sor'; // Red Kurdistan (Armenia/Azerbaijan)

export type MaritalStatus = 'zewici' | 'nezewici'; // Married / Unmarried

export interface ChildInfo {
  name: string;
  birthYear: number;
}

export interface CitizenshipData {
  // Personal Identity
  fullName: string;
  fatherName: string;
  grandfatherName: string;
  motherName: string;

  // Tribal Affiliation
  tribe: string;

  // Family Status
  maritalStatus: MaritalStatus;
  childrenCount?: number;
  children?: ChildInfo[];

  // Geographic Origin
  region: Region;

  // Contact & Profession
  email: string;
  profession: string;

  // Referral
  referralCode?: string;

  // Metadata
  walletAddress: string;
  timestamp: number;
}

export interface CitizenshipCommitment {
  commitmentHash: string;    // SHA256 hash of all data
  nullifierHash: string;      // Prevents double-registration
  ipfsCid: string;            // IPFS CID of encrypted data
  publicKey: string;          // User's encryption public key
  timestamp: number;
}

export interface TikiInfo {
  id: string;
  role: string;
  metadata?: any;
}

export interface CitizenshipStatus {
  kycStatus: KycStatus;
  hasCitizenTiki: boolean;
  tikiNumber?: string;
  stakingScoreTracking: boolean;
  ipfsCid?: string;
  nextAction: 'APPLY_KYC' | 'WAIT_REFERRER' | 'CONFIRM' | 'CLAIM_TIKI' | 'START_TRACKING' | 'COMPLETE';
}

// ========================================
// KYC STATUS CHECKS
// ========================================

/**
 * Get KYC status for a wallet address
 */
export async function getKycStatus(
  api: ApiPromise,
  address: string
): Promise<KycStatus> {
  try {
    if (!api?.query?.identityKyc) {
      if (import.meta.env.DEV) console.log('Identity KYC pallet not available on this chain');
      return 'NotStarted';
    }

    // Check Applications storage (new pallet API)
    if (api.query.identityKyc.applications) {
      const application = await api.query.identityKyc.applications(address);

      if (!application.isEmpty) {
        const appData = application.toJSON() as Record<string, unknown>;
        const status = appData.status as string | undefined;

        if (status === 'PendingReferral') return 'PendingReferral';
        if (status === 'ReferrerApproved') return 'ReferrerApproved';
        if (status === 'Approved') return 'Approved';
        if (status === 'Revoked') return 'Revoked';
      }
    }

    // Fallback: check kycStatuses if applications storage doesn't exist
    if (api.query.identityKyc.kycStatuses) {
      const status = await api.query.identityKyc.kycStatuses(address);
      if (!status.isEmpty) {
        const statusStr = status.toString();
        if (statusStr === 'Approved') return 'Approved';
        if (statusStr === 'PendingReferral') return 'PendingReferral';
        if (statusStr === 'ReferrerApproved') return 'ReferrerApproved';
        if (statusStr === 'Revoked') return 'Revoked';
      }
    }

    return 'NotStarted';
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    return 'NotStarted';
  }
}

/**
 * Check if user has pending KYC application
 */
export async function hasPendingApplication(
  api: ApiPromise,
  address: string
): Promise<boolean> {
  try {
    if (api?.query?.identityKyc?.applications) {
      const application = await api.query.identityKyc.applications(address);
      if (!application.isEmpty) {
        const appData = application.toJSON() as Record<string, unknown>;
        const status = appData.status as string | undefined;
        return status === 'PendingReferral' || status === 'ReferrerApproved';
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking pending application:', error);
    return false;
  }
}

// ========================================
// TIKI / CITIZENSHIP CHECKS
// ========================================

/**
 * Get all Tiki roles for a user
 */
// Tiki enum mapping from pallet-tiki
// IMPORTANT: Must match exact order in /Pezkuwi-SDK/pezkuwi/pallets/tiki/src/lib.rs
const TIKI_ROLES = [
  'Welati', 'Parlementer', 'SerokiMeclise', 'Serok', 'Wezir', 'EndameDiwane', 'Dadger',
  'Dozger', 'Hiquqnas', 'Noter', 'Xezinedar', 'Bacgir', 'GerinendeyeCavkaniye', 'OperatorêTorê',
  'PisporêEwlehiyaSîber', 'GerinendeyeDaneye', 'Berdevk', 'Qeydkar', 'Balyoz', 'Navbeynkar',
  'ParêzvaneÇandî', 'Mufetîs', 'KalîteKontrolker', 'Mela', 'Feqî', 'Perwerdekar', 'Rewsenbîr',
  'RêveberêProjeyê', 'SerokêKomele', 'ModeratorêCivakê', 'Axa', 'Pêseng', 'Sêwirmend', 'Hekem', 'Mamoste',
  'Bazargan',
  'SerokWeziran', 'WezireDarayiye', 'WezireParez', 'WezireDad', 'WezireBelaw', 'WezireTend', 'WezireAva', 'WezireCand'
];

export async function getUserTikis(
  api: ApiPromise,
  address: string
): Promise<TikiInfo[]> {
  try {
    if (!api?.query?.tiki?.userTikis) {
      if (import.meta.env.DEV) console.log('Tiki pallet not available on this chain');
      return [];
    }

    const tikis = await api.query.tiki.userTikis(address);

    if (tikis.isEmpty) {
      return [];
    }

    // userTikis returns a BoundedVec of Tiki enum values (as indices)
    const tikiIndices = tikis.toJSON() as number[];

    return tikiIndices.map((index, i) => ({
      id: `${index}`,
      role: TIKI_ROLES[index] || `Unknown Role (${index})`,
      metadata: {}
    }));
  } catch (error) {
    console.error('Error fetching user tikis:', error);
    return [];
  }
}

/**
 * Check if user has Welati (Citizen) Tiki
 * Blockchain uses "Welati" as the actual role name
 */
export async function hasCitizenTiki(
  api: ApiPromise,
  address: string
): Promise<{ hasTiki: boolean; tikiNumber?: string }> {
  try {
    const tikis = await getUserTikis(api, address);

    const citizenTiki = tikis.find(t =>
      t.role.toLowerCase() === 'welati' ||
      t.role.toLowerCase() === 'citizen'
    );

    return {
      hasTiki: !!citizenTiki,
      tikiNumber: citizenTiki?.id
    };
  } catch (error) {
    console.error('Error checking citizen tiki:', error);
    return { hasTiki: false };
  }
}

/**
 * Verify NFT ownership by NFT number
 */
export async function verifyNftOwnership(
  api: ApiPromise,
  nftNumber: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const tikis = await getUserTikis(api, walletAddress);

    return tikis.some(tiki =>
      tiki.id === nftNumber &&
      (
        tiki.role.toLowerCase() === 'welati' ||
        tiki.role.toLowerCase() === 'citizen'
      )
    );
  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    return false;
  }
}

// ========================================
// STAKING SCORE TRACKING
// ========================================

/**
 * Check if staking score tracking has been started
 */
export async function isStakingScoreTracking(
  api: ApiPromise,
  address: string
): Promise<boolean> {
  try {
    if (!api?.query?.stakingScore?.stakingStartBlock) {
      if (import.meta.env.DEV) console.log('Staking score pallet not available on this chain');
      return false;
    }

    const startBlock = await api.query.stakingScore.stakingStartBlock(address) as any;
    return !startBlock.isNone;
  } catch (error) {
    console.error('Error checking staking score tracking:', error);
    return false;
  }
}

/**
 * Check if user is staking
 */
export async function isStaking(
  api: ApiPromise,
  address: string
): Promise<boolean> {
  try {
    if (!api?.query?.staking?.ledger) {
      return false;
    }

    const ledger = await api.query.staking.ledger(address) as any;
    return !ledger.isNone;
  } catch (error) {
    console.error('Error checking staking status:', error);
    return false;
  }
}

// ========================================
// COMPREHENSIVE CITIZENSHIP STATUS
// ========================================

/**
 * Get complete citizenship status and next action needed
 */
export async function getCitizenshipStatus(
  api: ApiPromise,
  address: string
): Promise<CitizenshipStatus> {
  try {
    if (!api || !address) {
      return {
        kycStatus: 'NotStarted',
        hasCitizenTiki: false,
        stakingScoreTracking: false,
        nextAction: 'APPLY_KYC'
      };
    }

    // Fetch all status in parallel
    const [kycStatus, citizenCheck, stakingTracking] = await Promise.all([
      getKycStatus(api, address),
      hasCitizenTiki(api, address),
      isStakingScoreTracking(api, address)
    ]);

    const hasTiki = citizenCheck.hasTiki;

    // Determine next action based on workflow state
    let nextAction: CitizenshipStatus['nextAction'];

    if (kycStatus === 'NotStarted' || kycStatus === 'Revoked') {
      nextAction = 'APPLY_KYC';
    } else if (kycStatus === 'PendingReferral') {
      nextAction = 'WAIT_REFERRER';
    } else if (kycStatus === 'ReferrerApproved') {
      nextAction = 'CONFIRM';
    } else if (kycStatus === 'Approved' && !hasTiki) {
      nextAction = 'CLAIM_TIKI';
    } else if (!stakingTracking) {
      nextAction = 'START_TRACKING';
    } else {
      nextAction = 'COMPLETE';
    }

    return {
      kycStatus,
      hasCitizenTiki: hasTiki,
      tikiNumber: citizenCheck.tikiNumber,
      stakingScoreTracking: stakingTracking,
      nextAction
    };
  } catch (error) {
    console.error('Error fetching citizenship status:', error);
    return {
      kycStatus: 'NotStarted',
      hasCitizenTiki: false,
      stakingScoreTracking: false,
      nextAction: 'APPLY_KYC'
    };
  }
}

// ========================================
// IPFS COMMITMENT RETRIEVAL
// ========================================

/**
 * Get IPFS CID for citizen data
 */
export async function getCitizenDataCid(
  api: ApiPromise,
  address: string
): Promise<string | null> {
  try {
    if (!api?.query?.identityKyc?.identities) {
      return null;
    }

    // Try to get from identity storage
    // This assumes the pallet stores IPFS CID somewhere
    // Adjust based on actual pallet storage structure
    const identity = await api.query.identityKyc.identities(address) as any;

    if (identity.isNone) {
      return null;
    }

    const identityData = identity.unwrap().toJSON() as any;

    // Try different possible field names
    return identityData.ipfsCid ||
           identityData.cid ||
           identityData.dataCid ||
           null;
  } catch (error) {
    console.error('Error fetching citizen data CID:', error);
    return null;
  }
}

// ========================================
// REFERRAL VALIDATION
// ========================================

/**
 * Validate referral code
 */
export async function validateReferralCode(
  api: ApiPromise,
  referralCode: string
): Promise<boolean> {
  try {
    if (!referralCode || referralCode.trim() === '') {
      return true; // Empty is valid (will use founder)
    }

    // Check if referral code exists in trust pallet
    if (!api?.query?.trust?.referrals) {
      return false;
    }

    // Referral code could be an address or custom code
    // For now, check if it's a valid address format
    // TODO: Implement proper referral code lookup

    return referralCode.length > 0;
  } catch (error) {
    console.error('Error validating referral code:', error);
    return false;
  }
}

// ========================================
// BLOCKCHAIN TRANSACTIONS
// ========================================

/**
 * Submit citizenship application to blockchain
 * Single call: applyForCitizenship(identity_hash, referrer)
 * Requires 1 HEZ deposit (reserved by pallet automatically)
 */
export async function submitKycApplication(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  identityHash: string,
  referrerAddress?: string,
  walletSource?: WalletSource
): Promise<{ success: boolean; error?: string; blockHash?: string }> {
  try {
    if (!api?.tx?.identityKyc?.applyForCitizenship) {
      return { success: false, error: 'Identity KYC pallet not available' };
    }

    // Check if user already has a pending application
    const hasPending = await hasPendingApplication(api, account.address);
    if (hasPending) {
      return {
        success: false,
        error: 'You already have a pending citizenship application. Please wait for referrer approval.'
      };
    }

    // Check if user is already approved
    const currentStatus = await getKycStatus(api, account.address);
    if (currentStatus === 'Approved') {
      return {
        success: false,
        error: 'Your citizenship application is already approved!'
      };
    }

    const injector = await getSigner(account.address, walletSource ?? 'extension', api);

    if (import.meta.env.DEV) {
      console.log('=== submitKycApplication Debug ===');
      console.log('account.address:', account.address);
      console.log('identityHash:', identityHash);
      console.log('referrerAddress:', referrerAddress || '(default referrer)');
      console.log('===================================');
    }

    // Single call: applyForCitizenship(identity_hash, referrer)
    // referrer is Option<AccountId> - null means pallet uses DefaultReferrer
    const referrerParam = referrerAddress || null;

    const result = await new Promise<{ success: boolean; error?: string; blockHash?: string }>((resolve, reject) => {
      api.tx.identityKyc
        .applyForCitizenship(identityHash, referrerParam)
        .signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError, events }) => {
          if (import.meta.env.DEV) console.log('Transaction status:', status.type);

          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              if (import.meta.env.DEV) console.error('Transaction error:', errorMessage);
              resolve({ success: false, error: errorMessage });
              return;
            }

            const appliedEvent = events.find(({ event }: any) =>
              event.section === 'identityKyc' && event.method === 'CitizenshipApplied'
            );

            if (appliedEvent) {
              if (import.meta.env.DEV) console.log('Citizenship application submitted successfully');
            }

            resolve({
              success: true,
              blockHash: status.isInBlock ? status.asInBlock.toString() : undefined
            });
          }
        })
        .catch((error: any) => {
          if (import.meta.env.DEV) console.error('Failed to sign and send transaction:', error);
          reject(error);
        });
    });

    return result;
  } catch (error: any) {
    console.error('Error submitting citizenship application:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit citizenship application'
    };
  }
}

/**
 * Subscribe to citizenship-related events for an address
 * Listens for ReferralApproved and CitizenshipConfirmed
 */
export function subscribeToKycApproval(
  api: ApiPromise,
  address: string,
  onApproved: () => void,
  onError?: (error: string) => void,
  onReferralApproved?: () => void
): () => void {
  try {
    if (!api?.query?.system?.events) {
      console.error('Cannot subscribe to events: system.events not available');
      if (onError) onError('Event subscription not available');
      return () => {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = api.query.system.events((events: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events.forEach((record: any) => {
        const { event } = record;

        // Referrer approved the application
        if (event.section === 'identityKyc' && event.method === 'ReferralApproved') {
          const [applicantAddress] = event.data;
          if (applicantAddress.toString() === address) {
            if (import.meta.env.DEV) console.log('Referral approved for:', address);
            if (onReferralApproved) onReferralApproved();
          }
        }

        // Citizenship fully confirmed (NFT minted)
        if (event.section === 'identityKyc' && event.method === 'CitizenshipConfirmed') {
          const [confirmedAddress] = event.data;
          if (confirmedAddress.toString() === address) {
            if (import.meta.env.DEV) console.log('Citizenship confirmed for:', address);
            onApproved();
          }
        }
      });
    });

    return unsubscribe as unknown as () => void;
  } catch (error: any) {
    console.error('Error subscribing to citizenship events:', error);
    if (onError) onError(error.message || 'Failed to subscribe to events');
    return () => {};
  }
}

// ========================================
// REFERRER ACTIONS
// ========================================

/**
 * Approve a referral as a referrer
 * Called by the referrer to vouch for an applicant
 */
export async function approveReferral(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  applicantAddress: string,
  walletSource?: WalletSource
): Promise<{ success: boolean; error?: string; blockHash?: string }> {
  try {
    if (!api?.tx?.identityKyc?.approveReferral) {
      return { success: false, error: 'Identity KYC pallet not available' };
    }

    const injector = await getSigner(account.address, walletSource ?? 'extension', api);

    const result = await new Promise<{ success: boolean; error?: string; blockHash?: string }>((resolve, reject) => {
      api.tx.identityKyc
        .approveReferral(applicantAddress)
        .signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError, events }) => {
          if (import.meta.env.DEV) console.log('Approve referral tx status:', status.type);

          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              resolve({ success: false, error: errorMessage });
              return;
            }

            resolve({
              success: true,
              blockHash: status.isInBlock ? status.asInBlock.toString() : undefined
            });
          }
        })
        .catch((error: any) => reject(error));
    });

    return result;
  } catch (error: any) {
    console.error('Error approving referral:', error);
    return { success: false, error: error.message || 'Failed to approve referral' };
  }
}

/**
 * Cancel a pending citizenship application
 * Called by the applicant to withdraw and get deposit back
 */
export async function cancelApplication(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  walletSource?: WalletSource
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!api?.tx?.identityKyc?.cancelApplication) {
      return { success: false, error: 'Identity KYC pallet not available' };
    }

    const injector = await getSigner(account.address, walletSource ?? 'extension', api);

    const result = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
      api.tx.identityKyc
        .cancelApplication()
        .signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              resolve({ success: false, error: errorMessage });
              return;
            }
            resolve({ success: true });
          }
        })
        .catch((error: any) => reject(error));
    });

    return result;
  } catch (error: any) {
    console.error('Error canceling application:', error);
    return { success: false, error: error.message || 'Failed to cancel application' };
  }
}

/**
 * Confirm citizenship after referrer approval
 * Called by the applicant to mint the Welati Tiki NFT
 */
export async function confirmCitizenship(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  walletSource?: WalletSource
): Promise<{ success: boolean; error?: string; blockHash?: string }> {
  try {
    if (!api?.tx?.identityKyc?.confirmCitizenship) {
      return { success: false, error: 'Identity KYC pallet not available' };
    }

    const injector = await getSigner(account.address, walletSource ?? 'extension', api);

    const result = await new Promise<{ success: boolean; error?: string; blockHash?: string }>((resolve, reject) => {
      api.tx.identityKyc
        .confirmCitizenship()
        .signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError, events }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              resolve({ success: false, error: errorMessage });
              return;
            }

            resolve({
              success: true,
              blockHash: status.isInBlock ? status.asInBlock.toString() : undefined
            });
          }
        })
        .catch((error: any) => reject(error));
    });

    return result;
  } catch (error: any) {
    console.error('Error confirming citizenship:', error);
    return { success: false, error: error.message || 'Failed to confirm citizenship' };
  }
}

export interface PendingApproval {
  applicantAddress: string;
  identityHash: string;
}

/**
 * Get pending approvals where current user is the referrer
 */
export async function getPendingApprovalsForReferrer(
  api: ApiPromise,
  referrerAddress: string
): Promise<PendingApproval[]> {
  try {
    if (!api?.query?.identityKyc?.applications) {
      return [];
    }

    const entries = await api.query.identityKyc.applications.entries();
    const pending: PendingApproval[] = [];

    for (const [key, value] of entries) {
      const applicantAddress = key.args[0].toString();
      const appData = (value as any).toJSON() as Record<string, unknown>;

      // Application struct has { identityHash, referrer } - no status field.
      // An application is "pending" if it exists in applications but is NOT yet
      // approved in kycStatuses. Check referrer matches current user, or current
      // user is the founder (can approve any application).
      // Note: toJSON() returns hex for AccountId fields, convert to SS58 for comparison
      let referrerSS58 = '';
      try {
        if (appData.referrer) {
          const ss58Prefix = api.registry.chainSS58 ?? 42;
          referrerSS58 = encodeAddress(appData.referrer as string, ss58Prefix);
        }
      } catch {
        referrerSS58 = appData.referrer?.toString() ?? '';
      }
      const isReferrer = referrerSS58 === referrerAddress;
      const isFounder = referrerAddress === FOUNDER_ADDRESS;
      const hasNoReferrer = !appData.referrer || referrerSS58 === '';

      if (isReferrer || (isFounder && hasNoReferrer)) {
        // Check if already approved via kycStatuses
        const kycStatus = await api.query.identityKyc.kycStatuses(applicantAddress);

        if (kycStatus.isEmpty) {
          // No status at all — truly pending
          pending.push({
            applicantAddress,
            identityHash: (appData.identityHash as string) || ''
          });
          continue;
        }

        // Parse status — toJSON() can return string, object, or number:
        //   string: "PendingReferral" / "pendingReferral"
        //   object: { "pendingReferral": null }
        //   number: enum index (0=NotStarted, 1=PendingReferral, 2=ReferrerApproved, 3=Approved, 4=Revoked)
        const statusJson = kycStatus.toJSON?.() ?? kycStatus.toString();
        let statusKey = '';
        if (typeof statusJson === 'string') {
          statusKey = statusJson.toLowerCase();
        } else if (typeof statusJson === 'object' && statusJson !== null) {
          statusKey = Object.keys(statusJson)[0]?.toLowerCase() ?? '';
        } else if (typeof statusJson === 'number') {
          const enumMap: Record<number, string> = { 0: 'notstarted', 1: 'pendingreferral', 2: 'referrerapproved', 3: 'approved', 4: 'revoked' };
          statusKey = enumMap[statusJson] ?? '';
        }

        // Only show as pending if status is actually PendingReferral
        const isPending = statusKey === 'pendingreferral';
        if (isPending) {
          pending.push({
            applicantAddress,
            identityHash: (appData.identityHash as string) || ''
          });
        }
      }
    }

    return pending;
  } catch (error) {
    console.error('Error fetching pending approvals for referrer:', error);
    return [];
  }
}

// ========================================
// FOUNDER ADDRESS
// ========================================

export const FOUNDER_ADDRESS = '5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF'; // Satoshi Qazi Muhammed

export interface AuthChallenge {
  message: string;
  nonce: string;
  timestamp: number;
}

/**
 * Generate authentication challenge for existing citizens
 */
export function generateAuthChallenge(tikiNumber: string): AuthChallenge {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  const message = `Sign this message to prove you own Citizen #${tikiNumber}`;

  return {
    message,
    nonce: `pezkuwi-auth-${tikiNumber}-${timestamp}-${nonce}`,
    timestamp
  };
}

/**
 * Sign challenge with user's account
 */
export async function signChallenge(
  account: InjectedAccountWithMeta,
  challenge: AuthChallenge,
  walletSource?: WalletSource,
  api?: ApiPromise | null
): Promise<string> {
  try {
    const injector = await getSigner(account.address, walletSource ?? 'extension', api);

    if (!injector?.signer?.signRaw) {
      throw new Error('Signer not available');
    }

    // Sign the challenge nonce
    const signResult = await injector.signer.signRaw({
      address: account.address,
      data: challenge.nonce,
      type: 'bytes'
    });

    return signResult.signature;
  } catch (error) {
    console.error('Failed to sign challenge:', error);
    throw error;
  }
}

/**
 * Verify signature (simplified - in production, verify on backend)
 */
export async function verifySignature(
  signature: string,
  challenge: AuthChallenge,
  address: string
): Promise<boolean> {
  try {
    // For now, just check that signature exists and is valid hex
    // In production, you would verify the signature cryptographically
    if (!signature || signature.length < 10) {
      return false;
    }

    // Basic validation: signature should be hex string starting with 0x
    const isValidHex = /^0x[0-9a-fA-F]+$/.test(signature);

    return isValidHex;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export interface CitizenSession {
  tikiNumber: string;
  walletAddress: string;
  sessionToken: string;
  lastAuthenticated: number;
  expiresAt: number;
}

/**
 * Save citizen session (new format)
 */
export function saveCitizenSession(tikiNumber: string, address: string): void;
export function saveCitizenSession(session: CitizenSession): void;
export function saveCitizenSession(tikiNumberOrSession: string | CitizenSession, address?: string): void {
  if (typeof tikiNumberOrSession === 'string') {
    // Old format for backward compatibility
    localStorage.setItem('pezkuwi_citizen_session', JSON.stringify({
      tikiNumber: tikiNumberOrSession,
      address,
      timestamp: Date.now()
    }));
  } else {
    // New format with full session data
    localStorage.setItem('pezkuwi_citizen_session', JSON.stringify(tikiNumberOrSession));
  }
}

/**
 * Get citizen session
 */
export async function getCitizenSession(): Promise<CitizenSession | null> {
  try {
    const sessionData = localStorage.getItem('pezkuwi_citizen_session');
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);

    // Check if it's the new format with expiresAt
    if (session.expiresAt) {
      return session as CitizenSession;
    }

    // Old format - return null to force re-authentication
    return null;
  } catch (error) {
    console.error('Error retrieving citizen session:', error);
    return null;
  }
}

/**
 * Encrypt sensitive data for storage
 */
export function encryptData(data: any): string {
  // In production, use proper encryption
  // For now, base64 encode
  return btoa(JSON.stringify(data));
}

/**
 * Decrypt data
 */
export function decryptData(encrypted: string): any {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return null;
  }
}

/**
 * Generate commitment hash for citizenship data
 */
export function generateCommitmentHash(data: any): string {
  const str = JSON.stringify(data);
  // Simple hash for now - in production use proper cryptographic hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Generate nullifier hash
 */
export function generateNullifierHash(data: any): string {
  const str = JSON.stringify(data) + Date.now();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'nullifier_' + hash.toString(16);
}

/**
 * Save citizenship data to local storage
 */
export function saveLocalCitizenshipData(data: any): void {
  const encrypted = encryptData(data);
  localStorage.setItem('pezkuwi_citizenship_data', encrypted);
}

/**
 * Get local citizenship data
 */
export function getLocalCitizenshipData(): any {
  const encrypted = localStorage.getItem('pezkuwi_citizenship_data');
  if (!encrypted) return null;
  return decryptData(encrypted);
}

/**
 * Upload data to IPFS
 */
export async function uploadToIPFS(data: any): Promise<string> {
  // In production, use Pinata or other IPFS service
  // For now, return mock CID
  const mockCID = 'Qm' + Math.random().toString(36).substring(2, 15);
  console.log('Mock IPFS upload:', mockCID, data);
  return mockCID;
}
