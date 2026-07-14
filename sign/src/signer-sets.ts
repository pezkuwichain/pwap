import { BRIDGE_MULTISIG_SPECIFIC_ADDRESSES } from '@pezkuwi/lib/multisig';

export interface SignerSet {
  name: string;
  specificAddresses: Record<string, string>;
}

/**
 * Every known multisig this site gates access for. The connected wallet is authorized if it's
 * a member of ANY set below - add new entries here as new signing needs come up (this is the
 * single registry the login gate checks against, per the design decision to keep one dedicated
 * portal for all future signing needs rather than a bespoke UI per multisig).
 */
export const SIGNER_SETS: SignerSet[] = [
  { name: 'USDT Bridge Treasury', specificAddresses: BRIDGE_MULTISIG_SPECIFIC_ADDRESSES },
];
