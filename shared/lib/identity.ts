// Identity verification types and utilities

// UUID v5 namespace (RFC 4122 DNS namespace)
const UUID_V5_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Convert a Citizen Number or Visa Number to a deterministic UUID v5.
 * Uses SHA-1 hashing per RFC 4122. Works in both browser and Deno.
 *
 * @param identityId - Citizen number (e.g. "#42-0-832967") or Visa number (e.g. "V-123456")
 * @returns Deterministic UUID v5 string
 */
export async function identityToUUID(identityId: string): Promise<string> {
  const namespaceHex = UUID_V5_NAMESPACE.replace(/-/g, '');
  const namespaceBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    namespaceBytes[i] = parseInt(namespaceHex.substr(i * 2, 2), 16);
  }

  const nameBytes = new TextEncoder().encode(identityId);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes);
  combined.set(nameBytes, namespaceBytes.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const h = new Uint8Array(hashBuffer);

  // Set version 5 and RFC 4122 variant
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;

  const hex = Array.from(h.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export interface IdentityProfile {
  address: string;
  verificationLevel: 'none' | 'basic' | 'advanced' | 'verified';
  kycStatus: 'pending' | 'approved' | 'rejected' | 'none';
  reputationScore: number;
  badges: Badge[];
  roles: Role[];
  verificationDate?: Date;
  privacySettings: PrivacySettings;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedDate: Date;
  category: 'governance' | 'contribution' | 'verification' | 'achievement';
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  assignedDate: Date;
  expiryDate?: Date;
}

export interface PrivacySettings {
  showRealName: boolean;
  showEmail: boolean;
  showCountry: boolean;
  useZKProof: boolean;
}

export interface KYCData {
  firstName?: string;
  lastName?: string;
  email?: string;
  country?: string;
  documentType?: 'passport' | 'driver_license' | 'national_id';
  documentHash?: string;
  zkProof?: string;
}

export const VERIFICATION_LEVELS = {
  none: { label: 'Unverified', color: 'gray', minScore: 0 },
  basic: { label: 'Basic', color: 'blue', minScore: 100 },
  advanced: { label: 'Advanced', color: 'purple', minScore: 500 },
  verified: { label: 'Verified', color: 'green', minScore: 1000 }
};

export const DEFAULT_BADGES: Badge[] = [
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined during genesis phase',
    icon: '🚀',
    color: 'purple',
    earnedDate: new Date(),
    category: 'achievement'
  },
  {
    id: 'governance_participant',
    name: 'Active Voter',
    description: 'Participated in 10+ proposals',
    icon: '🗳️',
    color: 'blue',
    earnedDate: new Date(),
    category: 'governance'
  }
];

export const ROLES = {
  validator: {
    id: 'validator',
    name: 'Validator',
    permissions: ['validate_blocks', 'propose_blocks', 'vote_proposals']
  },
  council_member: {
    id: 'council_member',
    name: 'Council Member',
    permissions: ['create_proposals', 'fast_track_proposals', 'emergency_actions']
  },
  verified_user: {
    id: 'verified_user',
    name: 'Verified User',
    permissions: ['vote_proposals', 'create_basic_proposals']
  }
};

export function calculateReputationScore(
  activities: any[],
  verificationLevel: string,
  badges: Badge[]
): number {
  let score = 0;
  
  // Base score from verification
  switch (verificationLevel) {
    case 'basic': score += 100; break;
    case 'advanced': score += 500; break;
    case 'verified': score += 1000; break;
  }
  
  // Score from badges
  score += badges.length * 50;
  
  // Score from activities (placeholder)
  score += activities.length * 10;
  
  return Math.min(score, 2000); // Cap at 2000
}

export function generateZKProof(data: KYCData): string {
  // Simplified ZK proof generation (in production, use actual ZK library)
  const hash = btoa(JSON.stringify({
    ...data,
    timestamp: Date.now(),
    nonce: Math.random()
  }));
  return `zk_${hash.substring(0, 32)}`;
}

export function verifyZKProof(proof: string, expectedData?: any): boolean {
  // Simplified verification (in production, use actual ZK verification)
  return proof.startsWith('zk_') && proof.length > 32;
}