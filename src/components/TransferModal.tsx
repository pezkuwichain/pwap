import React, { useState } from 'react';
import { usePolkadot } from '@/contexts/PolkadotContext';
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
import { ArrowRight, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose }) => {
  const { api, isApiReady, selectedAccount } = usePolkadot();
  const { toast } = useToast();
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');

  const handleTransfer = async () => {
    if (!api || !isApiReady || !selectedAccount) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return;
    }

    if (!recipient || !amount) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    setTxStatus('signing');

    try {
      // Import web3FromAddress to get the injector
      const { web3FromAddress } = await import('@polkadot/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      // Convert amount to plancks (12 decimals)
      const decimals = 12;
      const amountInPlancks = BigInt(parseFloat(amount) * Math.pow(10, decimals));

      // Create transfer transaction
      const transfer = api.tx.balances.transferKeepAlive(recipient, amountInPlancks.toString());

      setTxStatus('pending');

      // Sign and send transaction
      const unsub = await transfer.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events, dispatchError }) => {
          if (status.isInBlock) {
            console.log(`Transaction included in block: ${status.asInBlock}`);
            setTxHash(status.asInBlock.toHex());
          }

          if (status.isFinalized) {
            console.log(`Transaction finalized: ${status.asFinalized}`);
            
            // Check for errors
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              }

              setTxStatus('error');
              toast({
                title: "Transfer Failed",
                description: errorMessage,
                variant: "destructive",
              });
            } else {
              setTxStatus('success');
              toast({
                title: "Transfer Successful!",
                description: `Sent ${amount} HEZ to ${recipient.slice(0, 8)}...${recipient.slice(-6)}`,
              });

              // Reset form after 2 seconds
              setTimeout(() => {
                setRecipient('');
                setAmount('');
                setTxStatus('idle');
                setTxHash('');
                onClose();
              }, 2000);
            }

            setIsTransferring(false);
            unsub();
          }
        }
      );
    } catch (error: any) {
      console.error('Transfer error:', error);
      setTxStatus('error');
      setIsTransferring(false);
      
      toast({
        title: "Transfer Failed",
        description: error.message || "An error occurred during transfer",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isTransferring) {
      setRecipient('');
      setAmount('');
      setTxStatus('idle');
      setTxHash('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white">Send HEZ</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfer HEZ tokens to another account
          </DialogDescription>
        </DialogHeader>

        {txStatus === 'success' ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Transfer Successful!</h3>
            <p className="text-gray-400 mb-4">Your transaction has been finalized</p>
            {txHash && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Transaction Hash</div>
                <div className="text-white font-mono text-xs break-all">
                  {txHash}
                </div>
              </div>
            )}
          </div>
        ) : txStatus === 'error' ? (
          <div className="py-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Transfer Failed</h3>
            <p className="text-gray-400">Please try again</p>
            <Button
              onClick={() => setTxStatus('idle')}
              className="mt-4 bg-gray-800 hover:bg-gray-700"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient" className="text-white">Recipient Address</Label>
              <Input
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                className="bg-gray-800 border-gray-700 text-white mt-2"
                disabled={isTransferring}
              />
            </div>

            <div>
              <Label htmlFor="amount" className="text-white">Amount (HEZ)</Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                className="bg-gray-800 border-gray-700 text-white mt-2"
                disabled={isTransferring}
              />
            </div>

            {txStatus === 'signing' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  Please sign the transaction in your Polkadot.js extension
                </p>
              </div>
            )}

            {txStatus === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transaction pending... Waiting for finalization
                </p>
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={isTransferring || !recipient || !amount}
              className="w-full bg-gradient-to-r from-green-600 to-yellow-400 hover:from-green-700 hover:to-yellow-500"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {txStatus === 'signing' ? 'Waiting for signature...' : 'Processing...'}
                </>
              ) : (
                <>
                  Send
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
