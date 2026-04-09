import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useMessaging } from '@/hooks/useMessaging';
import { KeySetup } from '@/components/messaging/KeySetup';
import { InboxMessage } from '@/components/messaging/InboxMessage';
import { ComposeDialog } from '@/components/messaging/ComposeDialog';
import { Loader2 } from 'lucide-react';

export default function WhatsKURDPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();

  const {
    palletReady,
    isKeyRegistered,
    isKeyUnlocked,
    decryptedMessages,
    era,
    sendCount,
    loading,
    sending,
    registering,
    setupKey,
    unlockKey,
    sendMessage,
    refreshInbox,
  } = useMessaging();

  const [composeOpen, setComposeOpen] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);

  useEffect(() => {
    if (!peopleApi || !isPeopleReady) return;
    let unsub: (() => void) | undefined;
    const subscribe = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unsub = await (peopleApi.rpc.chain as any).subscribeNewHeads(
          (header: { number: { toNumber: () => number } }) => {
            setCurrentBlock(header.number.toNumber());
          }
        );
      } catch {
        try {
          const header = await peopleApi.rpc.chain.getHeader();
          setCurrentBlock(header.number.toNumber());
        } catch { /* ignore */ }
      }
    };
    subscribe();
    return () => { unsub?.(); };
  }, [peopleApi, isPeopleReady]);

  const canCompose = isKeyRegistered && isKeyUnlocked && palletReady;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('mobile.section.social', 'Social')}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💬 whatsKURD</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('messaging.title', 'Encrypted Messenger')}</p>
          </div>
          <button
            onClick={refreshInbox}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Loader2 className={`w-5 h-5 text-white ${loading ? 'animate-spin' : 'opacity-70'}`} />
          </button>
        </div>

        {/* Era / stats */}
        {selectedAccount && (
          <div className="mt-3 flex items-center gap-3 text-xs text-white/50">
            <span>Era {era}</span>
            <span>·</span>
            <span>{decryptedMessages.length} {t('messaging.messages', 'messages')}</span>
            <span>·</span>
            <span>{sendCount}/50 {t('messaging.sent', 'sent')}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">

        {/* No wallet */}
        {!selectedAccount && (
          <div className="bg-gray-900 rounded-xl p-6 text-center border border-gray-800">
            <span className="text-4xl block mb-3">👛</span>
            <p className="font-bold text-white mb-1">{t('messaging.connectWallet', 'Connect Wallet')}</p>
            <p className="text-sm text-gray-400">{t('messaging.connectWalletDesc', 'Connect your wallet to use encrypted messaging.')}</p>
          </div>
        )}

        {/* API loading */}
        {selectedAccount && !isPeopleReady && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        )}

        {selectedAccount && isPeopleReady && (
          <>
            {/* Pallet not ready */}
            {!loading && !palletReady && (
              <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-4 flex items-start gap-3">
                <span className="text-orange-400 text-lg flex-shrink-0">⚠️</span>
                <p className="text-sm text-orange-300 leading-relaxed">
                  {t('messaging.palletNotReady', 'Messaging pallet is not yet available on People Chain. A runtime upgrade is required.')}
                </p>
              </div>
            )}

            {/* Key setup */}
            {palletReady && (
              <KeySetup
                isKeyRegistered={isKeyRegistered}
                isKeyUnlocked={isKeyUnlocked}
                registering={registering}
                onSetupKey={setupKey}
                onUnlockKey={unlockKey}
              />
            )}

            {/* Inbox */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
              </div>
            ) : decryptedMessages.length === 0 ? (
              <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800">
                <span className="text-4xl block mb-3">📭</span>
                <p className="text-sm text-gray-500">{t('messaging.emptyInbox', 'No messages yet.')}</p>
                {canCompose && (
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="mt-3 text-green-400 text-sm font-medium"
                  >
                    {t('messaging.sendFirst', 'Send your first message')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {decryptedMessages.map((msg, i) => (
                  <InboxMessage
                    key={`${msg.sender}-${msg.blockNumber}-${i}`}
                    message={msg}
                    currentBlock={currentBlock}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — compose button */}
      {canCompose && (
        <button
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-500 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all active:scale-95 z-40"
        >
          ✏️
        </button>
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSend={sendMessage}
        sending={sending}
      />

      <div className="h-20" />
    </div>
  );
}
