import type { ApiPromise } from '@pezkuwi/api';
import { hexToBytes, bytesToHex } from './crypto';

export interface EncryptedMessage {
  sender: string;
  blockNumber: number;
  ephemeralPublicKey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

// --- Storage queries ---

export async function getEncryptionKey(
  api: ApiPromise,
  address: string
): Promise<Uint8Array | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (api.query as any).messaging.encryptionKeys(address);
  if (result.isNone || result.isEmpty) return null;
  const hex = result.unwrap().toHex();
  return hexToBytes(hex);
}

export async function getCurrentEra(api: ApiPromise): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const era = await (api.query as any).messaging.currentEra();
  return era.toNumber();
}

export async function getInbox(
  api: ApiPromise,
  era: number,
  address: string
): Promise<EncryptedMessage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (api.query as any).messaging.inbox([era, address]);
  if (result.isEmpty || result.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.map((msg: Record<string, any>) => ({
    sender: msg.sender.toString(),
    blockNumber: msg.blockNumber?.toNumber?.() ?? msg.block_number?.toNumber?.() ?? 0,
    ephemeralPublicKey: hexToBytes(
      msg.ephemeralPublicKey?.toHex?.() ?? msg.ephemeral_public_key?.toHex?.() ?? '0x'
    ),
    nonce: hexToBytes(msg.nonce.toHex()),
    ciphertext: hexToBytes(msg.ciphertext.toHex()),
  }));
}

export async function getSendCount(
  api: ApiPromise,
  era: number,
  address: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await (api.query as any).messaging.sendCount([era, address]);
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
