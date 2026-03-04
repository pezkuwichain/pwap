import { useState, useCallback, useEffect, useRef } from 'react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useWallet } from '@/contexts/WalletContext';
import { deriveKeypair, encryptMessage, decryptMessage } from '@/lib/messaging/crypto';
import {
  isPalletAvailable,
  getEncryptionKey,
  getCurrentEra,
  getInbox,
  getSendCount,
  buildRegisterKeyTx,
  buildSendMessageTx,
  buildAcknowledgeTx,
  type EncryptedMessage,
} from '@/lib/messaging/chain';
import { getSigner } from '@/lib/get-signer';
import { toast } from 'sonner';

export interface DecryptedMessage {
  sender: string;
  blockNumber: number;
  plaintext: string | null; // null if decryption failed
  raw: EncryptedMessage;
}

interface MessagingState {
  palletReady: boolean;
  isKeyRegistered: boolean;
  isKeyUnlocked: boolean;
  inbox: EncryptedMessage[];
  decryptedMessages: DecryptedMessage[];
  era: number;
  sendCount: number;
  loading: boolean;
  sending: boolean;
  registering: boolean;
}

export function useMessaging() {
  const { peopleApi, isPeopleReady, selectedAccount, walletSource } = usePezkuwi();
  const { signMessage } = useWallet();

  const [state, setState] = useState<MessagingState>({
    palletReady: false,
    isKeyRegistered: false,
    isKeyUnlocked: false,
    inbox: [],
    decryptedMessages: [],
    era: 0,
    sendCount: 0,
    loading: false,
    sending: false,
    registering: false,
  });

  // Private key stored only in memory (cleared on unmount/page close)
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const publicKeyRef = useRef<Uint8Array | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if messaging pallet exists on chain
  const checkPalletAvailability = useCallback((): boolean => {
    if (!peopleApi || !isPeopleReady) return false;
    const available = isPalletAvailable(peopleApi);
    setState(prev => ({ ...prev, palletReady: available }));
    return available;
  }, [peopleApi, isPeopleReady]);

  // Check if user has a registered encryption key on-chain
  const checkKeyRegistration = useCallback(async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) return;
    if (!isPalletAvailable(peopleApi)) return;

    try {
      const key = await getEncryptionKey(peopleApi, selectedAccount.address);
      setState(prev => ({ ...prev, isKeyRegistered: key !== null }));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to check encryption key:', err);
    }
  }, [peopleApi, isPeopleReady, selectedAccount]);

  // Derive encryption keys from wallet signature and register on-chain
  const setupKey = useCallback(async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      toast.error('Wallet not connected');
      return;
    }

    // Check pallet BEFORE asking for signature
    if (!isPalletAvailable(peopleApi)) {
      toast.error('Messaging pallet is not yet available on this chain. Runtime upgrade required.');
      return;
    }

    setState(prev => ({ ...prev, registering: true }));

    try {
      // 1. Check if key is already registered on-chain (no signing needed)
      const existingKey = await getEncryptionKey(peopleApi, selectedAccount.address);

      // 2. Now sign to derive keys
      const signature = await signMessage('PEZMessage:v1');
      const { publicKey, privateKey } = deriveKeypair(signature);

      // 3. Store keys in memory
      privateKeyRef.current = privateKey;
      publicKeyRef.current = publicKey;

      // 4. If key already matches, just unlock
      const alreadyRegistered = existingKey !== null &&
        existingKey.length === publicKey.length &&
        existingKey.every((b, i) => b === publicKey[i]);

      if (alreadyRegistered) {
        setState(prev => ({
          ...prev,
          isKeyRegistered: true,
          isKeyUnlocked: true,
          registering: false,
        }));
        toast.success('Encryption key unlocked');
        return;
      }

      // 5. Register key on-chain
      const tx = buildRegisterKeyTx(peopleApi, publicKey);
      const injector = await getSigner(selectedAccount.address, walletSource, peopleApi);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ({ status, dispatchError }: { status: any; dispatchError?: any }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                let errorMsg = 'Transaction failed';
                if (dispatchError.isModule) {
                  const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
                  errorMsg = `${decoded.section}.${decoded.name}`;
                }
                reject(new Error(errorMsg));
              } else {
                resolve();
              }
            }
          }
        ).catch(reject);
      });

      setState(prev => ({
        ...prev,
        isKeyRegistered: true,
        isKeyUnlocked: true,
        registering: false,
      }));
      toast.success('Encryption key registered');
    } catch (err) {
      setState(prev => ({ ...prev, registering: false }));
      const msg = err instanceof Error ? err.message : 'Failed to setup key';
      toast.error(msg);
    }
  }, [peopleApi, isPeopleReady, selectedAccount, walletSource, signMessage]);

  // Unlock existing key (re-derive from signature without registering)
  const unlockKey = useCallback(async () => {
    if (!peopleApi || !selectedAccount) return;

    setState(prev => ({ ...prev, registering: true }));
    try {
      const signature = await signMessage('PEZMessage:v1');
      const { publicKey, privateKey } = deriveKeypair(signature);
      privateKeyRef.current = privateKey;
      publicKeyRef.current = publicKey;
      setState(prev => ({ ...prev, isKeyUnlocked: true, registering: false }));
      toast.success('Encryption key unlocked');
    } catch {
      setState(prev => ({ ...prev, registering: false }));
      toast.error('Failed to unlock key');
    }
  }, [peopleApi, selectedAccount, signMessage]);

  // Refresh inbox from chain
  const refreshInbox = useCallback(async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) return;
    if (!isPalletAvailable(peopleApi)) return;

    try {
      const era = await getCurrentEra(peopleApi);
      const [inbox, sendCount] = await Promise.all([
        getInbox(peopleApi, era, selectedAccount.address),
        getSendCount(peopleApi, era, selectedAccount.address),
      ]);

      // Auto-decrypt if private key is available
      let decrypted: DecryptedMessage[] = [];
      if (privateKeyRef.current) {
        decrypted = inbox.map(msg => {
          try {
            const plaintext = decryptMessage(
              privateKeyRef.current!,
              msg.ephemeralPublicKey,
              msg.nonce,
              msg.ciphertext
            );
            return { sender: msg.sender, blockNumber: msg.blockNumber, plaintext, raw: msg };
          } catch (err) {
            console.error('[PEZMessage] decrypt failed:', err,
              'ephPubKey len:', msg.ephemeralPublicKey?.length,
              'nonce len:', msg.nonce?.length,
              'ct len:', msg.ciphertext?.length);
            const errText = err instanceof Error ? err.message : String(err);
            return { sender: msg.sender, blockNumber: msg.blockNumber, plaintext: `[ERR: ${errText}]`, raw: msg };
          }
        });
      } else {
        decrypted = inbox.map(msg => ({
          sender: msg.sender,
          blockNumber: msg.blockNumber,
          plaintext: null,
          raw: msg,
        }));
      }

      setState(prev => ({
        ...prev,
        era,
        inbox,
        sendCount,
        decryptedMessages: decrypted,
      }));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to refresh inbox:', err);
    }
  }, [peopleApi, isPeopleReady, selectedAccount]);

  // Send an encrypted message
  const sendEncryptedMessage = useCallback(async (recipient: string, text: string) => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      toast.error('Wallet not connected');
      return;
    }
    if (!isPalletAvailable(peopleApi)) {
      toast.error('Messaging pallet is not available on this chain');
      return;
    }

    setState(prev => ({ ...prev, sending: true }));

    try {
      // 1. Get recipient's public key
      const recipientPubKey = await getEncryptionKey(peopleApi, recipient);
      if (!recipientPubKey) {
        throw new Error('Recipient has no encryption key registered');
      }

      // 2. Encrypt
      const { ephemeralPublicKey, nonce, ciphertext } = encryptMessage(recipientPubKey, text);

      // 3. Build and send TX
      const tx = buildSendMessageTx(peopleApi, recipient, ephemeralPublicKey, nonce, ciphertext);
      const injector = await getSigner(selectedAccount.address, walletSource, peopleApi);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ({ status, dispatchError }: { status: any; dispatchError?: any }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                let errorMsg = 'Transaction failed';
                if (dispatchError.isModule) {
                  const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
                  errorMsg = `${decoded.section}.${decoded.name}`;
                }
                reject(new Error(errorMsg));
              } else {
                resolve();
              }
            }
          }
        ).catch(reject);
      });

      toast.success('Message sent');
      setState(prev => ({ ...prev, sending: false }));
      // Refresh inbox to show updated send count
      await refreshInbox();
    } catch (err) {
      setState(prev => ({ ...prev, sending: false }));
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(msg);
    }
  }, [peopleApi, isPeopleReady, selectedAccount, walletSource, refreshInbox]);

  // Acknowledge messages (optional, feeless)
  const acknowledge = useCallback(async () => {
    if (!peopleApi || !selectedAccount) return;
    if (!isPalletAvailable(peopleApi)) return;

    try {
      const tx = buildAcknowledgeTx(peopleApi);
      const injector = await getSigner(selectedAccount.address, walletSource, peopleApi);
      await tx.signAndSend(selectedAccount.address, { signer: injector.signer });
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to acknowledge:', err);
    }
  }, [peopleApi, selectedAccount, walletSource]);

  // Initial load + polling
  useEffect(() => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) return;

    setState(prev => ({ ...prev, loading: true }));

    const init = async () => {
      const available = checkPalletAvailability();
      if (available) {
        await checkKeyRegistration();
        await refreshInbox();
      }
      setState(prev => ({ ...prev, loading: false }));
    };
    init();

    // Poll every 12 seconds (1 block interval) - only if pallet exists
    pollIntervalRef.current = setInterval(() => {
      if (isPalletAvailable(peopleApi)) {
        refreshInbox();
      }
    }, 12000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [peopleApi, isPeopleReady, selectedAccount, checkPalletAvailability, checkKeyRegistration, refreshInbox]);

  // Clear private key when account changes
  useEffect(() => {
    privateKeyRef.current = null;
    publicKeyRef.current = null;
    setState(prev => ({ ...prev, isKeyUnlocked: false }));
  }, [selectedAccount?.address]);

  return {
    ...state,
    setupKey,
    unlockKey,
    sendMessage: sendEncryptedMessage,
    refreshInbox,
    acknowledge,
  };
}
