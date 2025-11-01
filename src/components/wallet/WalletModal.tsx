import React, { useState, useEffect } from 'react';
import { Wallet, Chrome, ExternalLink, Copy, Check, LogOut, Award } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { formatAddress } from '@/lib/wallet';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    connectWallet,
    disconnectWallet,
    api,
    isApiReady,
    error
  } = usePolkadot();

  const [copied, setCopied] = useState(false);
  const [trustScore, setTrustScore] = useState<string>('-');

  const handleCopyAddress = () => {
    if (selectedAccount?.address) {
      navigator.clipboard.writeText(selectedAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async () => {
    await connectWallet();
  };

  const handleSelectAccount = (account: typeof accounts[0]) => {
    setSelectedAccount(account);
    onClose();
  };

  const handleDisconnect = () => {
    disconnectWallet();
    onClose();
  };

  // Fetch trust score from blockchain
  useEffect(() => {
    const fetchTrustScore = async () => {
      if (!api || !isApiReady || !selectedAccount?.address) {
        setTrustScore('-');
        return;
      }

      try {
        const score = await api.query.trust.trustScores(selectedAccount.address);
        setTrustScore(score.toString());
        console.log('✅ Trust score fetched:', score.toString());
      } catch (err) {
        console.warn('Failed to fetch trust score:', err);
        setTrustScore('-');
      }
    };

    fetchTrustScore();
  }, [api, isApiReady, selectedAccount]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-400" />
            {selectedAccount ? 'Wallet Connected' : 'Connect Wallet'}
          </DialogTitle>
          <DialogDescription>
            {selectedAccount 
              ? 'Manage your Polkadot account' 
              : 'Connect your Polkadot.js extension to interact with PezkuwiChain'}
          </DialogDescription>
        </DialogHeader>

        {/* No Extension Error */}
        {error && error.includes('extension') && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-300">
                Polkadot.js extension not detected. Please install it to continue.
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="https://polkadot.js.org/extension/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  <Chrome className="mr-2 h-4 w-4" />
                  Install Extension
                </Button>
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center">
              After installing, refresh the page and try again
            </p>
          </div>
        )}

        {/* Connected State */}
        {selectedAccount && !error && (
          <div className="space-y-4">
            {/* Account Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Account Name</div>
                <div className="font-medium">{selectedAccount.meta.name || 'Unnamed Account'}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Address</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-gray-300 truncate">
                    {formatAddress(selectedAccount.address)}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopyAddress}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Trust Score</div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-400" />
                  <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    {trustScore}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Source</div>
                <div className="text-sm text-gray-300">
                  {selectedAccount.meta.source || 'polkadot-js'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944#/explorer`, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Explorer
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>

            {/* Switch Account */}
            {accounts.length > 1 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Switch Account</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {accounts.map((account) => (
                    <button
                      key={account.address}
                      onClick={() => handleSelectAccount(account)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        account.address === selectedAccount.address
                          ? 'bg-purple-500/20 border-purple-500/50'
                          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {account.meta.name || 'Unnamed'}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formatAddress(account.address)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Not Connected State */}
        {!selectedAccount && !error && (
          <div className="space-y-4">
            {accounts.length > 0 ? (
              // Has accounts, show selection
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Select an account to connect:</div>
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.address}
                      onClick={() => handleSelectAccount(account)}
                      className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-purple-500/50 hover:bg-gray-800 transition-all text-left"
                    >
                      <div className="font-medium mb-1">
                        {account.meta.name || 'Unnamed Account'}
                      </div>
                      <div className="text-sm text-gray-400 font-mono">
                        {account.address}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // No accounts, show connect button
              <div className="space-y-4">
                <Button
                  onClick={handleConnect}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-400 hover:from-purple-700 hover:to-cyan-500"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Polkadot.js
                </Button>
                
                <div className="text-sm text-gray-400 text-center">
                  Don't have Polkadot.js?{' '}
                  <a
                    href="https://polkadot.js.org/extension/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    Download here
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};