import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useMessaging } from '@/hooks/useMessaging';
import { KeySetup } from '@/components/messaging/KeySetup';
import { InboxMessage } from '@/components/messaging/InboxMessage';
import { ComposeDialog } from '@/components/messaging/ComposeDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Loader2,
  Wallet,
  Inbox,
} from 'lucide-react';

export default function Messaging() {
  const { t } = useTranslation();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();
  const {
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

  // Get current block number for time-ago display
  useEffect(() => {
    if (!peopleApi || !isPeopleReady) return;

    let unsub: (() => void) | undefined;

    const subscribe = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unsub = await (peopleApi.rpc.chain as any).subscribeNewHeads((header: { number: { toNumber: () => number } }) => {
          setCurrentBlock(header.number.toNumber());
        });
      } catch {
        // Fallback: single query
        try {
          const header = await peopleApi.rpc.chain.getHeader();
          setCurrentBlock(header.number.toNumber());
        } catch {
          // ignore
        }
      }
    };

    subscribe();
    return () => { unsub?.(); };
  }, [peopleApi, isPeopleReady]);

  // No wallet connected
  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 sm:pt-[8.5rem]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="w-12 h-12 text-gray-600 mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">
                {t('messaging.connectWallet', 'Connect Wallet')}
              </h2>
              <p className="text-sm text-gray-400">
                {t('messaging.connectWalletDesc', 'Connect your wallet to use encrypted messaging.')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // API not ready
  if (!isPeopleReady) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 sm:pt-[8.5rem]">
        <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-20 sm:pt-[8.5rem]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-green-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {t('messaging.title', 'PEZMessage')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshInbox}
              disabled={loading}
              className="border-gray-700 text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {isKeyRegistered && isKeyUnlocked && (
              <Button
                size="sm"
                onClick={() => setComposeOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('messaging.newMessage', 'New')}
              </Button>
            )}
          </div>
        </div>

        {/* Key Setup Banner */}
        <div className="mb-4">
          <KeySetup
            isKeyRegistered={isKeyRegistered}
            isKeyUnlocked={isKeyUnlocked}
            registering={registering}
            onSetupKey={setupKey}
            onUnlockKey={unlockKey}
          />
        </div>

        {/* Era / Stats bar */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4 px-1">
          <span>Era {era}</span>
          <span className="text-gray-700">·</span>
          <span>
            {decryptedMessages.length} {t('messaging.messages', 'messages')}
          </span>
          <span className="text-gray-700">·</span>
          <span>{sendCount}/50 {t('messaging.sent', 'sent')}</span>
        </div>

        {/* Inbox */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
          </div>
        ) : decryptedMessages.length === 0 ? (
          <Card className="border-gray-800 bg-gray-900/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">
                {t('messaging.emptyInbox', 'No messages yet.')}
              </p>
              {isKeyRegistered && isKeyUnlocked && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setComposeOpen(true)}
                  className="text-green-400 mt-2"
                >
                  {t('messaging.sendFirst', 'Send your first message')}
                </Button>
              )}
            </CardContent>
          </Card>
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
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSend={sendMessage}
        sending={sending}
      />
    </div>
  );
}
