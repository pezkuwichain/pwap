import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2, Unlock } from 'lucide-react';

interface KeySetupProps {
  isKeyRegistered: boolean;
  isKeyUnlocked: boolean;
  registering: boolean;
  onSetupKey: () => void;
  onUnlockKey: () => void;
}

export function KeySetup({
  isKeyRegistered,
  isKeyUnlocked,
  registering,
  onSetupKey,
  onUnlockKey,
}: KeySetupProps) {
  const { t } = useTranslation();

  if (isKeyRegistered && isKeyUnlocked) return null;

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              {isKeyRegistered ? (
                <Unlock className="w-5 h-5 text-yellow-400" />
              ) : (
                <KeyRound className="w-5 h-5 text-yellow-400" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              {isKeyRegistered
                ? t('messaging.unlockTitle', 'Unlock Your Messages')
                : t('messaging.setupTitle', 'Set Up Encryption Key')}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {isKeyRegistered
                ? t('messaging.unlockDesc', 'Sign with your wallet to unlock message decryption for this session.')
                : t('messaging.setupDesc', 'Register your encryption key on-chain to start sending and receiving encrypted messages.')}
            </p>
          </div>
          <Button
            onClick={isKeyRegistered ? onUnlockKey : onSetupKey}
            disabled={registering}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium flex-shrink-0"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('messaging.signing', 'Signing...')}
              </>
            ) : isKeyRegistered ? (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                {t('messaging.unlock', 'Unlock')}
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 mr-2" />
                {t('messaging.setupKey', 'Setup Key')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
