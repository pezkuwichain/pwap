// ========================================
// Pallet-Tiki Integration
// ========================================
// This file handles all tiki-related blockchain interactions
// Based on: /Pezkuwi-SDK/pezkuwi/pallets/tiki/src/lib.rs

import type { ApiPromise } from '@pezkuwi/api';

// ========================================
// TIKI TYPES (from Rust enum)
// ========================================
// IMPORTANT: Must match /Pezkuwi-SDK/pezkuwi/pallets/tiki/src/lib.rs
export enum Tiki {
  // Otomatik - KYC sonrası
  Welati = 'Welati',

  // Seçilen roller (Elected)
  Parlementer = 'Parlementer',
  SerokiMeclise = 'SerokiMeclise',
  Serok = 'Serok',

  // Atanan roller (Appointed) - Yargı
  EndameDiwane = 'EndameDiwane',
  Dadger = 'Dadger',
  Dozger = 'Dozger',
  Hiquqnas = 'Hiquqnas',
  Noter = 'Noter',

  // Atanan roller - Yürütme
  Wezir = 'Wezir',
  SerokWeziran = 'SerokWeziran',
  WezireDarayiye = 'WezireDarayiye',
  WezireParez = 'WezireParez',
  WezireDad = 'WezireDad',
  WezireBelaw = 'WezireBelaw',
  WezireTend = 'WezireTend',
  WezireAva = 'WezireAva',
  WezireCand = 'WezireCand',

  // Atanan roller - İdari
  Xezinedar = 'Xezinedar',
  Bacgir = 'Bacgir',
  GerinendeyeCavkaniye = 'GerinendeyeCavkaniye',
  OperatorêTorê = 'OperatorêTorê',
  PisporêEwlehiyaSîber = 'PisporêEwlehiyaSîber',
  GerinendeyeDaneye = 'GerinendeyeDaneye',
  Berdevk = 'Berdevk',
  Qeydkar = 'Qeydkar',
  Balyoz = 'Balyoz',
  Navbeynkar = 'Navbeynkar',
  ParêzvaneÇandî = 'ParêzvaneÇandî',
  Mufetîs = 'Mufetîs',
  KalîteKontrolker = 'KalîteKontrolker',

  // Atanan roller - Kültürel/Dini
  Mela = 'Mela',
  Feqî = 'Feqî',
  Perwerdekar = 'Perwerdekar',
  Rewsenbîr = 'Rewsenbîr',
  RêveberêProjeyê = 'RêveberêProjeyê',
  SerokêKomele = 'SerokêKomele',
  ModeratorêCivakê = 'ModeratorêCivakê',

  // Kazanılan roller (Earned)
  Axa = 'Axa',
  Pêseng = 'Pêseng',
  Sêwirmend = 'Sêwirmend',
  Hekem = 'Hekem',
  Mamoste = 'Mamoste',

  // Ekonomik rol
  Bazargan = 'Bazargan',
}

// Role assignment types
export enum RoleAssignmentType {
  Automatic = 'Automatic',
  Appointed = 'Appointed',
  Elected = 'Elected',
  Earned = 'Earned',
}

// Tiki to Display Name mapping (English)
export const TIKI_DISPLAY_NAMES: Record<string, string> = {
  Welati: 'Citizen',
  Parlementer: 'Parliament Member',
  SerokiMeclise: 'Speaker of Parliament',
  Serok: 'President',
  Wezir: 'Minister',
  SerokWeziran: 'Prime Minister',
  WezireDarayiye: 'Minister of Finance',
  WezireParez: 'Minister of Defense',
  WezireDad: 'Minister of Justice',
  WezireBelaw: 'Minister of Education',
  WezireTend: 'Minister of Health',
  WezireAva: 'Minister of Water',
  WezireCand: 'Minister of Culture',
  EndameDiwane: 'Supreme Court Member',
  Dadger: 'Judge',
  Dozger: 'Prosecutor',
  Hiquqnas: 'Lawyer',
  Noter: 'Notary',
  Xezinedar: 'Treasurer',
  Bacgir: 'Tax Collector',
  GerinendeyeCavkaniye: 'Resource Manager',
  OperatorêTorê: 'Network Operator',
  PisporêEwlehiyaSîber: 'Cybersecurity Expert',
  GerinendeyeDaneye: 'Data Manager',
  Berdevk: 'Representative',
  Qeydkar: 'Registrar',
  Balyoz: 'Ambassador',
  Navbeynkar: 'Mediator',
  ParêzvaneÇandî: 'Cultural Guardian',
  Mufetîs: 'Inspector',
  KalîteKontrolker: 'Quality Controller',
  Mela: 'Religious Scholar',
  Feqî: 'Religious Jurist',
  Perwerdekar: 'Educator',
  Rewsenbîr: 'Intellectual',
  RêveberêProjeyê: 'Project Manager',
  SerokêKomele: 'Community Leader',
  ModeratorêCivakê: 'Community Moderator',
  Axa: 'Elder',
  Pêseng: 'Pioneer',
  Sêwirmend: 'Advisor',
  Hekem: 'Expert',
  Mamoste: 'Teacher',
  Bazargan: 'Merchant',
};

// Tiki scores (from get_bonus_for_tiki function)
export const TIKI_SCORES: Record<string, number> = {
  Axa: 250,
  RêveberêProjeyê: 250,
  ModeratorêCivakê: 200,
  Serok: 200,
  EndameDiwane: 175,
  Dadger: 150,
  SerokiMeclise: 150,
  SerokWeziran: 125,
  Dozger: 120,
  Wezir: 100,
  WezireDarayiye: 100,
  WezireParez: 100,
  WezireDad: 100,
  WezireBelaw: 100,
  WezireTend: 100,
  WezireAva: 100,
  WezireCand: 100,
  SerokêKomele: 100,
  Xezinedar: 100,
  PisporêEwlehiyaSîber: 100,
  Parlementer: 100,
  Mufetîs: 90,
  Balyoz: 80,
  Hiquqnas: 75,
  Berdevk: 70,
  Mamoste: 70,
  Bazargan: 60,
  OperatorêTorê: 60,
  Mela: 50,
  Feqî: 50,
  Noter: 50,
  Bacgir: 50,
  Perwerdekar: 40,
  Rewsenbîr: 40,
  GerinendeyeCavkaniye: 40,
  GerinendeyeDaneye: 40,
  KalîteKontrolker: 30,
  Navbeynkar: 30,
  Hekem: 30,
  Qeydkar: 25,
  ParêzvaneÇandî: 25,
  Sêwirmend: 20,
  Welati: 10,
  Pêseng: 5, // Default for unlisted
};

// ========================================
// ROLE CATEGORIZATION
// ========================================

export const ROLE_CATEGORIES: Record<string, string[]> = {
  Government: ['Serok', 'SerokWeziran', 'Wezir', 'WezireDarayiye', 'WezireParez', 'WezireDad', 'WezireBelaw', 'WezireTend', 'WezireAva', 'WezireCand'],
  Legislature: ['Parlementer', 'SerokiMeclise'],
  Judiciary: ['EndameDiwane', 'Dadger', 'Dozger', 'Hiquqnas', 'Noter'],
  Administration: ['Xezinedar', 'Bacgir', 'Berdevk', 'Qeydkar', 'Balyoz', 'Mufetîs'],
  Technical: ['OperatorêTorê', 'PisporêEwlehiyaSîber', 'GerinendeyeDaneye', 'GerinendeyeCavkaniye'],
  Cultural: ['Mela', 'Feqî', 'ParêzvaneÇandî'],
  Education: ['Mamoste', 'Perwerdekar', 'Rewsenbîr'],
  Community: ['SerokêKomele', 'ModeratorêCivakê', 'Axa', 'Navbeynkar', 'Sêwirmend', 'Hekem'],
  Economic: ['Bazargan'],
  Leadership: ['RêveberêProjeyê', 'Pêseng'],
  Quality: ['KalîteKontrolker'],
  Citizen: ['Welati'],
};

// ========================================
// TIKI QUERY FUNCTIONS
// ========================================

/**
 * Fetch user's tiki roles from blockchain
 * @param api - Polkadot API instance
 * @param address - User's substrate address
 * @returns Array of tiki role strings
 */
export const fetchUserTikis = async (
  api: ApiPromise,
  address: string
): Promise<string[]> => {
  try {
    if (!api || !api.query.tiki) {
      console.warn('Tiki pallet not available on this chain');
      return [];
    }

    // Query UserTikis storage
    const tikis = await api.query.tiki.userTikis(address);
    const tikisArray = tikis.toJSON() as any[];

    if (!tikisArray || tikisArray.length === 0) {
      return [];
    }

    // Convert from enum index to string names
    return tikisArray.map((tikiIndex: any) => {
      // Tikis are stored as enum variants
      if (typeof tikiIndex === 'string') {
        return tikiIndex;
      } else if (typeof tikiIndex === 'object' && tikiIndex !== null) {
        // Handle object variant format {variantName: null}
        return Object.keys(tikiIndex)[0];
      }
      return 'Unknown';
    }).filter((t: string) => t !== 'Unknown');

  } catch (error) {
    console.error('Error fetching user tikis:', error);
    return [];
  }
};

/**
 * Check if user is a citizen (has Welati tiki)
 * @param api - Polkadot API instance
 * @param address - User's substrate address
 * @returns boolean
 */
export const isCitizen = async (
  api: ApiPromise,
  address: string
): Promise<boolean> => {
  try {
    if (!api || !api.query.tiki) {
      return false;
    }

    const citizenNft = await api.query.tiki.citizenNft(address);
    return !citizenNft.isEmpty;
  } catch (error) {
    console.error('Error checking citizenship:', error);
    return false;
  }
};

/**
 * Calculate total tiki score for a user
 * @param tikis - Array of tiki strings
 * @returns Total score
 */
export const calculateTikiScore = (tikis: string[]): number => {
  return tikis.reduce((total, tiki) => {
    return total + (TIKI_SCORES[tiki] || 5);
  }, 0);
};

/**
 * Get primary role (highest scoring) from tikis
 * @param tikis - Array of tiki strings
 * @returns Primary role string
 */
export const getPrimaryRole = (tikis: string[]): string => {
  if (!tikis || tikis.length === 0) {
    return 'Member';
  }

  // Find highest scoring role
  let primaryRole = tikis[0];
  let highestScore = TIKI_SCORES[tikis[0]] || 5;

  for (const tiki of tikis) {
    const score = TIKI_SCORES[tiki] || 5;
    if (score > highestScore) {
      highestScore = score;
      primaryRole = tiki;
    }
  }

  return primaryRole;
};

/**
 * Get display name for a tiki
 * @param tiki - Tiki string
 * @returns Display name
 */
export const getTikiDisplayName = (tiki: string): string => {
  return TIKI_DISPLAY_NAMES[tiki] || tiki;
};

/**
 * Get all role categories for user's tikis
 * @param tikis - Array of tiki strings
 * @returns Array of category names
 */
export const getUserRoleCategories = (tikis: string[]): string[] => {
  const categories = new Set<string>();

  for (const tiki of tikis) {
    for (const [category, roles] of Object.entries(ROLE_CATEGORIES)) {
      if (roles.includes(tiki)) {
        categories.add(category);
      }
    }
  }

  return Array.from(categories);
};

/**
 * Check if user has a specific tiki
 * @param tikis - Array of tiki strings
 * @param tiki - Tiki to check
 * @returns boolean
 */
export const hasTiki = (tikis: string[], tiki: string): boolean => {
  return tikis.includes(tiki);
};

// ========================================
// DISPLAY HELPERS
// ========================================

/**
 * Get color for a tiki role
 * @param tiki - Tiki string
 * @returns Tailwind color class
 */
export const getTikiColor = (tiki: string): string => {
  const score = TIKI_SCORES[tiki] || 5;

  if (score >= 200) return 'text-purple-500';
  if (score >= 150) return 'text-pink-500';
  if (score >= 100) return 'text-blue-500';
  if (score >= 70) return 'text-cyan-500';
  if (score >= 40) return 'text-teal-500';
  if (score >= 20) return 'text-green-500';
  return 'text-gray-500';
};

/**
 * Get emoji icon for a tiki category
 * @param tiki - Tiki string
 * @returns Emoji string
 */
export const getTikiEmoji = (tiki: string): string => {
  for (const [category, roles] of Object.entries(ROLE_CATEGORIES)) {
    if (roles.includes(tiki)) {
      switch (category) {
        case 'Government': return '👑';
        case 'Legislature': return '🏛️';
        case 'Judiciary': return '⚖️';
        case 'Administration': return '📋';
        case 'Technical': return '💻';
        case 'Cultural': return '📿';
        case 'Education': return '👨‍🏫';
        case 'Community': return '🤝';
        case 'Economic': return '💰';
        case 'Leadership': return '⭐';
        case 'Quality': return '✅';
        case 'Citizen': return '👤';
      }
    }
  }
  return '👤';
};

/**
 * Get badge variant for a tiki
 * @param tiki - Tiki string
 * @returns Badge variant string
 */
export const getTikiBadgeVariant = (tiki: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const score = TIKI_SCORES[tiki] || 5;

  if (score >= 150) return 'default'; // Purple/blue for high ranks
  if (score >= 70) return 'secondary'; // Gray for mid ranks
  return 'outline'; // Outline for low ranks
};

// ========================================
// NFT DETAILS FUNCTIONS
// ========================================

/**
 * Tiki NFT Details interface
 */
export interface TikiNFTDetails {
  collectionId: number;
  itemId: number;
  owner: string;
  tikiRole: string;
  tikiDisplayName: string;
  tikiScore: number;
  tikiColor: string;
  tikiEmoji: string;
  mintedAt?: number;
  metadata?: any;
}

/**
 * Fetch detailed NFT information for a user's tiki roles
 * @param api - Polkadot API instance
 * @param address - User's substrate address
 * @returns Array of TikiNFTDetails
 */
export const fetchUserTikiNFTs = async (
  api: ApiPromise,
  address: string
): Promise<TikiNFTDetails[]> => {
  try {
    if (!api || !api.query.tiki) {
      console.warn('Tiki pallet not available on this chain');
      return [];
    }

    // Query UserTikis storage - returns list of role enums
    const userTikis = await api.query.tiki.userTikis(address);

    if (!userTikis || userTikis.isEmpty) {
      return [];
    }

    const tikisArray = userTikis.toJSON() as string[];
    const nftDetails: TikiNFTDetails[] = [];

    // UserTikis doesn't store NFT IDs, only roles
    // We return role information here but without actual NFT collection/item IDs
    for (const tikiRole of tikisArray) {
      nftDetails.push({
        collectionId: 42, // Tiki collection is always 42
        itemId: 0, // We don't have individual item IDs from UserTikis storage
        owner: address,
        tikiRole,
        tikiDisplayName: getTikiDisplayName(tikiRole),
        tikiScore: TIKI_SCORES[tikiRole] || 5,
        tikiColor: getTikiColor(tikiRole),
        tikiEmoji: getTikiEmoji(tikiRole),
        metadata: null
      });
    }

    return nftDetails;

  } catch (error) {
    console.error('Error fetching user tiki NFTs:', error);
    return [];
  }
};

/**
 * Fetch citizen NFT details for a user
 * @param api - Polkadot API instance
 * @param address - User's substrate address
 * @returns TikiNFTDetails for citizen NFT or null
 */
export const getCitizenNFTDetails = async (
  api: ApiPromise,
  address: string
): Promise<TikiNFTDetails | null> => {
  try {
    if (!api || !api.query.tiki) {
      return null;
    }

    // Query CitizenNft storage - returns only item ID (u32)
    const citizenNft = await api.query.tiki.citizenNft(address);

    if (citizenNft.isEmpty) {
      return null;
    }

    // CitizenNft returns just the item ID (u32), collection is always 42
    const itemId = citizenNft.toJSON() as number;
    const collectionId = 42; // Tiki collection is hardcoded as 42

    if (typeof itemId !== 'number') {
      return null;
    }

    // Try to fetch metadata
    let metadata: any = null;
    try {
      const nftMetadata = await api.query.nfts.item(collectionId, itemId);
      if (nftMetadata && !nftMetadata.isEmpty) {
        metadata = nftMetadata.toJSON();
      }
    } catch (e) {
      console.warn('Could not fetch citizen NFT metadata:', e);
    }

    return {
      collectionId,
      itemId,
      owner: address,
      tikiRole: 'Welati',
      tikiDisplayName: getTikiDisplayName('Welati'),
      tikiScore: TIKI_SCORES['Welati'] || 10,
      tikiColor: getTikiColor('Welati'),
      tikiEmoji: getTikiEmoji('Welati'),
      metadata
    };

  } catch (error) {
    console.error('Error fetching citizen NFT details:', error);
    return null;
  }
};

/**
 * Fetch all NFT details including collection and item IDs
 * @param api - Polkadot API instance
 * @param address - User's substrate address
 * @returns Complete NFT details with collection/item IDs
 */
export const getAllTikiNFTDetails = async (
  api: ApiPromise,
  address: string
): Promise<{
  citizenNFT: TikiNFTDetails | null;
  roleNFTs: TikiNFTDetails[];
  totalNFTs: number;
}> => {
  try {
    // Only fetch citizen NFT because it's the only one with stored item ID
    // Role assignments in UserTikis don't have associated NFT item IDs
    const citizenNFT = await getCitizenNFTDetails(api, address);

    return {
      citizenNFT,
      roleNFTs: [], // Don't show role NFTs because UserTikis doesn't store item IDs
      totalNFTs: citizenNFT ? 1 : 0
    };

  } catch (error) {
    console.error('Error fetching all tiki NFT details:', error);
    return {
      citizenNFT: null,
      roleNFTs: [],
      totalNFTs: 0
    };
  }
};

/**
 * Generates a deterministic 6-digit Citizen Number
 * Formula: Based on owner address + collection ID + item ID
 * Always returns the same number for the same inputs (deterministic)
 */
export const generateCitizenNumber = (
  ownerAddress: string,
  collectionId: number,
  itemId: number
): string => {
  // Create a simple hash from the inputs
  let hash = 0;

  // Hash the address
  for (let i = 0; i < ownerAddress.length; i++) {
    hash = ((hash << 5) - hash) + ownerAddress.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Add collection ID and item ID to the hash
  hash += collectionId * 1000 + itemId;

  // Ensure positive number
  hash = Math.abs(hash);

  // Get last 6 digits and pad with zeros if needed
  const sixDigit = (hash % 1000000).toString().padStart(6, '0');

  return sixDigit;
};

/**
 * Verifies Citizen Number by checking if it matches the user's NFT data
 * Format: #collectionId-itemId-6digitNumber
 * Example: #42-0-123456
 */
export const verifyCitizenNumber = async (
  api: any,
  citizenNumber: string,
  walletAddress: string
): Promise<boolean> => {
  try {
    console.log('🔍 Verifying Citizen Number...');
    console.log('  Input:', citizenNumber);
    console.log('  Wallet:', walletAddress);

    // Parse citizen number: #42-0-123456
    const cleanNumber = citizenNumber.trim().replace('#', '');
    const parts = cleanNumber.split('-');
    console.log('  Parsed parts:', parts);

    if (parts.length !== 3) {
      console.error('❌ Invalid citizen number format. Expected: #collectionId-itemId-6digits');
      return false;
    }

    const collectionId = parseInt(parts[0]);
    const itemId = parseInt(parts[1]);
    const providedSixDigit = parts[2];
    console.log('  Collection ID:', collectionId);
    console.log('  Item ID:', itemId);
    console.log('  Provided 6-digit:', providedSixDigit);

    // Validate parts
    if (isNaN(collectionId) || isNaN(itemId) || providedSixDigit.length !== 6) {
      console.error('❌ Invalid citizen number format');
      return false;
    }

    // Get user's NFT data from blockchain
    console.log('  Querying blockchain for wallet:', walletAddress);
    const itemIdResult = await api.query.tiki.citizenNft(walletAddress);
    console.log('  Blockchain query result:', itemIdResult.toString());
    console.log('  Blockchain query result (JSON):', itemIdResult.toJSON());

    if (itemIdResult.isEmpty) {
      console.error('❌ No citizen NFT found for this address');
      return false;
    }

    // Handle Option<u32> type - check if it's Some or None
    const actualItemId = itemIdResult.isSome ? itemIdResult.unwrap().toNumber() : null;

    if (actualItemId === null) {
      console.error('❌ No citizen NFT found for this address (None value)');
      return false;
    }

    console.log('  Actual Item ID from blockchain:', actualItemId);

    // Check if collection and item IDs match
    if (collectionId !== 42 || itemId !== actualItemId) {
      console.error(`❌ NFT mismatch. Provided: #${collectionId}-${itemId}, Blockchain has: #42-${actualItemId}`);
      return false;
    }

    // Generate expected citizen number
    const expectedSixDigit = generateCitizenNumber(walletAddress, collectionId, itemId);
    console.log('  Expected 6-digit:', expectedSixDigit);
    console.log('  Provided 6-digit:', providedSixDigit);

    // Compare provided vs expected
    if (providedSixDigit !== expectedSixDigit) {
      console.error(`❌ Citizen number mismatch. Expected: ${expectedSixDigit}, Got: ${providedSixDigit}`);
      return false;
    }

    console.log('✅ Citizen Number verified successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error verifying citizen number:', error);
    return false;
  }
};
