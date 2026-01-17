/**
 * Mobile-specific citizenship workflow utilities
 * Uses native keyPair signing instead of browser extension
 */
import type { ApiPromise } from '@pezkuwi/api';
import type { KeyringPair } from '@pezkuwi/keyring/types';

export interface CitizenshipResult {
  success: boolean;
  error?: string;
  blockHash?: string;
}

/**
 * Submit KYC application using native keyPair (mobile)
 */
export async function submitKycApplicationMobile(
  api: ApiPromise,
  keyPair: KeyringPair,
  name: string,
  email: string,
  ipfsCid: string,
  notes: string = 'Citizenship application via mobile'
): Promise<CitizenshipResult> {
  try {
    if (!api?.tx?.identityKyc?.setIdentity || !api?.tx?.identityKyc?.applyForKyc) {
      return { success: false, error: 'Identity KYC pallet not available' };
    }

    const address = keyPair.address;

    // Check if user already has a pending KYC application
    const pendingApp = await api.query.identityKyc.pendingKycApplications(address);
    if (!pendingApp.isEmpty) {
      return {
        success: false,
        error: 'You already have a pending citizenship application. Please wait for approval.'
      };
    }

    // Check if user is already approved
    const kycStatus = await api.query.identityKyc.kycStatuses(address);
    if (kycStatus.toString() === 'Approved') {
      return {
        success: false,
        error: 'Your citizenship application is already approved!'
      };
    }

    const cidString = String(ipfsCid);
    if (!cidString || cidString === 'undefined' || cidString === '[object Object]') {
      return { success: false, error: `Invalid IPFS CID: ${cidString}` };
    }

    if (__DEV__) {
      console.warn('[Citizenship] Submitting for:', address);
    }

    // Step 1: Set identity
    const identityResult = await new Promise<CitizenshipResult>((resolve) => {
      api.tx.identityKyc
        .setIdentity(name, email)
        .signAndSend(keyPair, { nonce: -1 }, ({ status, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Identity transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}`;
              }
              resolve({ success: false, error: errorMessage });
              return;
            }
            resolve({ success: true });
          }
        })
        .catch((error) => resolve({ success: false, error: error.message }));
    });

    if (!identityResult.success) {
      return identityResult;
    }

    // Step 2: Apply for KYC
    const kycResult = await new Promise<CitizenshipResult>((resolve) => {
      api.tx.identityKyc
        .applyForKyc(cidString, notes)
        .signAndSend(keyPair, { nonce: -1 }, ({ status, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'KYC application failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}`;
              }
              resolve({ success: false, error: errorMessage });
              return;
            }
            const blockHash = status.isFinalized
              ? status.asFinalized?.toString()
              : status.asInBlock?.toString();
            resolve({ success: true, blockHash });
          }
        })
        .catch((error) => resolve({ success: false, error: error.message }));
    });

    return kycResult;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
