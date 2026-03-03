import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/utils.js';

/**
 * Derive a deterministic x25519 keypair from a wallet signature.
 * User signs "PEZMessage:v1" → SHA-256 of signature → x25519 seed.
 */
export function deriveKeypair(signatureHex: string): {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
} {
  // Remove 0x prefix if present
  const hex = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  const sigBytes = hexToBytes(hex);
  const privateKey = sha256(sigBytes);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Encrypt a message for a recipient using their x25519 public key.
 * Generates an ephemeral keypair, computes ECDH shared secret,
 * then encrypts with XChaCha20-Poly1305.
 */
export function encryptMessage(
  recipientPublicKey: Uint8Array,
  plaintext: string
): {
  ephemeralPublicKey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
} {
  // Generate ephemeral x25519 keypair
  const ephemeralPrivate = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivate);

  // ECDH: ephemeral_private × recipient_public → shared_secret
  const rawShared = x25519.getSharedSecret(ephemeralPrivate, recipientPublicKey);
  const sharedKey = sha256(rawShared);

  // Encrypt with XChaCha20-Poly1305
  const nonce = randomBytes(24);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = xchacha20poly1305(sharedKey, nonce);
  const ciphertext = cipher.encrypt(plaintextBytes);

  return { ephemeralPublicKey, nonce, ciphertext };
}

/**
 * Decrypt a message using own private key and the sender's ephemeral public key.
 * Recomputes ECDH shared secret, then decrypts with XChaCha20-Poly1305.
 */
export function decryptMessage(
  privateKey: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
): string {
  // ECDH: my_private × ephemeral_public → shared_secret
  const rawShared = x25519.getSharedSecret(privateKey, ephemeralPublicKey);
  const sharedKey = sha256(rawShared);

  // Decrypt with XChaCha20-Poly1305
  const cipher = xchacha20poly1305(sharedKey, nonce);
  const plaintextBytes = cipher.decrypt(ciphertext);

  return new TextDecoder().decode(plaintextBytes);
}

// --- Utility helpers ---

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function u8aToHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}
