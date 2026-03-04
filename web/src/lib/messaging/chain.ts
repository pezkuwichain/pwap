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
  const hex = result.unwrap().toHex();
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
  console.log('[PEZMessage] raw inbox result:', JSON.stringify(result.toHuman?.() ?? result));
  if (result.isEmpty || result.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = result[0];
  if (first) {
    const keys = Object.getOwnPropertyNames(first).filter(k => !k.startsWith('_'));
    const json = first.toJSON?.() ?? {};
    const jsonKeys = Object.keys(json);
    console.log('[PEZMessage] field names:', keys, 'json keys:', jsonKeys, 'json:', JSON.stringify(json));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.map((msg: Record<string, any>) => {
    // Try multiple field name patterns
    const eph = msg.ephemeralPublicKey ?? msg.ephemeral_public_key ?? msg.ephemeralPubKey ?? msg.ephemeral_pub_key;
    const blk = msg.blockNumber ?? msg.block_number ?? msg.blockNum;
    const ct = msg.ciphertext ?? msg.cipher_text;
    return {
      sender: msg.sender.toString(),
      blockNumber: blk?.toNumber?.() ?? 0,
      ephemeralPublicKey: hexToBytes(eph?.toHex?.() ?? '0x'),
      nonce: hexToBytes(msg.nonce?.toHex?.() ?? '0x'),
      ciphertext: hexToBytes(ct?.toHex?.() ?? '0x'),
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
