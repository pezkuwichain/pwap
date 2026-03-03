import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Loader2, AlertTriangle } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { getEncryptionKey } from '@/lib/messaging/chain';

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (recipient: string, message: string) => Promise<void>;
  sending: boolean;
}

const MAX_MESSAGE_BYTES = 512;

export function ComposeDialog({ open, onOpenChange, onSend, sending }: ComposeDialogProps) {
  const { t } = useTranslation();
  const { peopleApi, isPeopleReady } = usePezkuwi();

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [checkingRecipient, setCheckingRecipient] = useState(false);

  const messageBytes = new TextEncoder().encode(message).length;
  const isOverLimit = messageBytes > MAX_MESSAGE_BYTES;

  const checkRecipientKey = useCallback(async (address: string) => {
    if (!peopleApi || !isPeopleReady || !address || address.length < 40) {
      setRecipientError(null);
      return;
    }

    setCheckingRecipient(true);
    try {
      const key = await getEncryptionKey(peopleApi, address);
      if (!key) {
        setRecipientError(t('messaging.noRecipientKey', 'Recipient has no encryption key registered'));
      } else {
        setRecipientError(null);
      }
    } catch {
      setRecipientError(null);
    } finally {
      setCheckingRecipient(false);
    }
  }, [peopleApi, isPeopleReady, t]);

  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    setRecipientError(null);
    // Debounced check
    const trimmed = value.trim();
    if (trimmed.length >= 40) {
      checkRecipientKey(trimmed);
    }
  };

  const handleSend = async () => {
    const trimmedRecipient = recipient.trim();
    const trimmedMessage = message.trim();

    if (!trimmedRecipient || !trimmedMessage) return;

    await onSend(trimmedRecipient, trimmedMessage);

    // Clear form on success
    setRecipient('');
    setMessage('');
    setRecipientError(null);
    onOpenChange(false);
  };

  const canSend = !sending &&
    !checkingRecipient &&
    !recipientError &&
    recipient.trim().length >= 40 &&
    message.trim().length > 0 &&
    !isOverLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {t('messaging.compose', 'New Message')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('messaging.composeDesc', 'Send an end-to-end encrypted message on-chain.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient */}
          <div className="space-y-2">
            <Label className="text-gray-300">
              {t('messaging.recipient', 'Recipient Address')}
            </Label>
            <Input
              value={recipient}
              onChange={(e) => handleRecipientChange(e.target.value)}
              placeholder="5Cyu..."
              className="bg-gray-800 border-gray-700 text-white font-mono text-sm"
              disabled={sending}
            />
            {recipientError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{recipientError}</AlertDescription>
              </Alert>
            )}
            {checkingRecipient && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('messaging.checkingKey', 'Checking encryption key...')}
              </p>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">
                {t('messaging.message', 'Message')}
              </Label>
              <span className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                {messageBytes}/{MAX_MESSAGE_BYTES} bytes
              </span>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('messaging.typePlaceholder', 'Type your message...')}
              className="bg-gray-800 border-gray-700 text-white min-h-[120px] resize-none"
              disabled={sending}
            />
            {isOverLimit && (
              <p className="text-xs text-red-400">
                {t('messaging.tooLong', 'Message exceeds maximum size (512 bytes)')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="border-gray-700 text-gray-300"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('messaging.sending', 'Sending...')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t('messaging.send', 'Send')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
