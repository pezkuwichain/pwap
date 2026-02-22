import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWallet } from '@/contexts/WalletContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'send' | 'vote' | 'delegate';
  data?: Record<string, unknown>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  type
}) => {
  const { signTransaction, signMessage } = useWallet();
  const { t } = useTranslation();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendTransaction = async () => {
    if (!recipient || !amount) {
      setError(t('txModal.fillAllFields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = {
        to: recipient,
        value: '0x' + (parseFloat(amount) * 1e18).toString(16),
        data: '0x',
      };

      const hash = await signTransaction(tx);
      setTxHash(hash);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignMessage = async () => {
    if (!message) {
      setError(t('txModal.enterMessage'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signature = await signMessage(message);
      setTxHash(signature);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRecipient('');
    setAmount('');
    setMessage('');
    setTxHash(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetForm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-kesk" />
            {type === 'send' ? t('txModal.sendHez') : type === 'vote' ? t('txModal.castVote') : t('txModal.delegateVoting')}
          </DialogTitle>
          <DialogDescription>
            {type === 'send'
              ? t('txModal.sendHezDesc')
              : type === 'vote'
              ? t('txModal.voteDesc')
              : t('txModal.delegateDesc')}
          </DialogDescription>
        </DialogHeader>

        {!txHash ? (
          <div className="space-y-4">
            {type === 'send' && (
              <>
                <div>
                  <Label htmlFor="recipient">{t('txModal.recipientAddress')}</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">{t('txModal.amountHez')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </>
            )}

            {type === 'vote' && (
              <div>
                <Label htmlFor="message">{t('txModal.voteMessage')}</Label>
                <Textarea
                  id="message"
                  placeholder={t('txModal.votePlaceholder')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={type === 'send' ? handleSendTransaction : handleSignMessage}
                disabled={loading}
                className="flex-1 bg-kesk hover:bg-kesk/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('txModal.processing')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {type === 'send' ? t('txModal.sendTransaction') : t('txModal.signSubmit')}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={loading}>
                {t('txModal.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="border-kesk/20">
              <CheckCircle className="h-4 w-4 text-kesk" />
              <AlertDescription>
                {t('txModal.txSubmitted')}
              </AlertDescription>
            </Alert>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">{t('txModal.txHash')}</div>
              <div className="font-mono text-xs break-all">{txHash}</div>
            </div>
            <Button onClick={resetForm} className="w-full">
              {t('txModal.close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};