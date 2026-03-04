import type { ApiPromise } from '@pezkuwi/api';
import { hexToBytes, bytesToHex } from './crypto';

export interface EncryptedMessage {
  sender: string;
  blockNumber: number;
  ephemeralPublicKey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

/**
 * Check if the messaging pallet exists in the runtime metadata.
 * Must be called before any other chain function.
 */
export function isPalletAvailable(api: ApiPromise): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(api.query as any).messaging;
  } catch {
    return false;
  }
}

// --- Storage queries ---

export async function getEncryptionKey(
  api: ApiPromise,
  address: string
): Promise<Uint8Array | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messaging = (api.query as any).messaging;
  if (!messaging?.encryptionKeys) return null;
  const result = await messaging.encryptionKeys(address);
  if (result.isNone || result.isEmpty) return null;
  // Handle both Option<[u8;32]> (needs unwrap) and direct [u8;32]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = typeof (result as any).unwrap === 'function' ? (result as any).unwrap() : result;
  const hex = inner.toHex();
  console.log(`[PEZMessage] getEncryptionKey(${address.slice(0, 8)}…) = ${hex.slice(0, 18)}…`);
  return hexToBytes(hex);
}

export async function getCurrentEra(api: ApiPromise): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messaging = (api.query as any).messaging;
  if (!messaging?.currentEra) return 0;
  const era = await messaging.currentEra();
  return era.toNumber();
}

export async function getInbox(
  api: ApiPromise,
  era: number,
  address: string
): Promise<EncryptedMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messaging = (api.query as any).messaging;
  if (!messaging?.inbox) return [];
  const result = await messaging.inbox(era, address);

  // Debug: log raw result type and content
  const human = result.toHuman?.() ?? result;
  console.log(`[PEZMessage] getInbox(era=${era}, addr=${address.slice(0, 8)}…) isEmpty=${result.isEmpty} length=${result.length} raw:`, JSON.stringify(human));

  if (result.isEmpty || result.length === 0) return [];

  const first = result[0];
  if (first) {
    // Log all available field access patterns
    const ownKeys = Object.getOwnPropertyNames(first).filter(k => !k.startsWith('_'));
    const json = first.toJSON?.() ?? {};
    const jsonKeys = Object.keys(json);
    console.log('[PEZMessage] struct field names (own):', ownKeys, '(json):', jsonKeys);
    console.log('[PEZMessage] first message json:', JSON.stringify(json));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.map((msg: Record<string, any>, idx: number) => {
    // Try codec accessors first (camelCase), then snake_case, then toJSON fallback
    let eph = msg.ephemeralPublicKey ?? msg.ephemeral_public_key;
    let blk = msg.blockNumber ?? msg.block_number;
    let ct = msg.ciphertext ?? msg.cipher_text;
    const nonce = msg.nonce;
    const sender = msg.sender;

    // Fallback: use toJSON() if codec accessors returned undefined
    if (!eph || !nonce || !ct) {
      const json = msg.toJSON?.() ?? {};
      console.warn(`[PEZMessage] msg[${idx}] codec accessors incomplete, using toJSON fallback:`, JSON.stringify(json));
      if (!eph) eph = json.ephemeralPublicKey ?? json.ephemeral_public_key;
      if (!blk && blk !== 0) blk = json.blockNumber ?? json.block_number;
      if (!ct) ct = json.ciphertext ?? json.cipher_text;
    }

    // Convert to bytes - handle both codec objects (.toHex()) and raw hex strings
    const toBytes = (val: unknown, label: string, expectedLen?: number): Uint8Array => {
      if (!val) {
        console.error(`[PEZMessage] msg[${idx}].${label} is null/undefined`);
        return new Uint8Array(expectedLen ?? 0);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hex = typeof (val as any).toHex === 'function' ? (val as any).toHex() : typeof val === 'string' ? val : '0x';
      const bytes = hexToBytes(hex);
      if (expectedLen && bytes.length !== expectedLen) {
        console.warn(`[PEZMessage] msg[${idx}].${label} expected ${expectedLen} bytes, got ${bytes.length}`);
      }
      return bytes;
    };

    return {
      sender: sender?.toString?.() ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockNumber: typeof blk === 'number' ? blk : (blk as any)?.toNumber?.() ?? 0,
      ephemeralPublicKey: toBytes(eph, 'ephemeralPublicKey', 32),
      nonce: toBytes(nonce, 'nonce', 24),
      ciphertext: toBytes(ct, 'ciphertext'),
    };
  });
}

export async function getSendCount(
  api: ApiPromise,
  era: number,
  address: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messaging = (api.query as any).messaging;
  if (!messaging?.sendCount) return 0;
  const count = await messaging.sendCount(era, address);
  return count.toNumber();
}

// --- TX builders ---

export function buildRegisterKeyTx(api: ApiPromise, publicKey: Uint8Array) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.tx as any).messaging.registerEncryptionKey(bytesToHex(publicKey));
}

export function buildSendMessageTx(
  api: ApiPromise,
  recipient: string,
  ephemeralPubKey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.tx as any).messaging.sendMessage(
    recipient,
    bytesToHex(ephemeralPubKey),
    bytesToHex(nonce),
    bytesToHex(ciphertext)
  );
}

export function buildAcknowledgeTx(api: ApiPromise) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.tx as any).messaging.acknowledgeMessages();
}
