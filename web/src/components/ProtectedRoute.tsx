import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isMultisigMember, BRIDGE_MULTISIG_SPECIFIC_ADDRESSES } from '@pezkuwi/lib/multisig';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowTelegramSession?: boolean;
  /** Gates access to the connected account being one of the 5 real USDT bridge multisig
   *  signatories (checked live against chain state, not a decorative badge like the
   *  isMultisigMember usage elsewhere in the app before this). */
  requireMultisigMember?: boolean;
}

// Check if valid telegram session exists
function getTelegramSession(): { telegram_id: string; wallet_address: string; username: string } | null {
  try {
    const session = localStorage.getItem('telegram_session');
    if (!session) return null;

    const parsed = JSON.parse(session);
    // Session expires after 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('telegram_session');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  allowTelegramSession = false,
  requireMultisigMember = false
}) => {
  const { user, loading, isAdmin } = useAuth();
  const { api, isApiReady, selectedAccount, connectWallet } = usePezkuwi();
  const [walletRestoreChecked, setWalletRestoreChecked] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [multisigCheckDone, setMultisigCheckDone] = useState(false);
  const [isSigner, setIsSigner] = useState(false);
  const telegramSession = allowTelegramSession ? getTelegramSession() : null;

  // Live on-chain check - this is a REAL gate (unlike the isMultisigMember badge elsewhere in
  // the app, which is purely decorative and gates nothing).
  useEffect(() => {
    if (!requireMultisigMember) return;
    if (!api || !isApiReady || !selectedAccount) {
      setMultisigCheckDone(false);
      return;
    }

    let cancelled = false;
    setMultisigCheckDone(false);

    isMultisigMember(api, selectedAccount.address, BRIDGE_MULTISIG_SPECIFIC_ADDRESSES)
      .then((result) => {
        if (!cancelled) {
          setIsSigner(result);
          setMultisigCheckDone(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSigner(false);
          setMultisigCheckDone(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requireMultisigMember, api, isApiReady, selectedAccount]);

  // Listen for wallet changes
  useEffect(() => {
    const handleWalletChange = () => {
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('walletChanged', handleWalletChange);
    return () => window.removeEventListener('walletChanged', handleWalletChange);
  }, []);

  // Wait for wallet restoration (max 3 seconds)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setWalletRestoreChecked(true);
    }, 3000);

    // If wallet restored earlier, clear timeout
    if (selectedAccount) {
      setWalletRestoreChecked(true);
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [selectedAccount, forceUpdate]);

  // Show loading while:
  // 1. Auth is loading, OR
  // 2. Wallet restoration not checked yet
  if (loading || !walletRestoreChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-400">
            {!walletRestoreChecked ? 'Restoring wallet connection...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // For admin/multisig-gated routes, require wallet connection
  if ((requireAdmin || requireMultisigMember) && !selectedAccount) {
    const handleConnect = async () => {
      await connectWallet();
      // Event is automatically dispatched by handleSetSelectedAccount wrapper
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <Wallet className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            {requireMultisigMember
              ? 'This page requires connecting one of the USDT bridge multisig signer accounts.'
              : 'Admin panel requires wallet authentication. Please connect your wallet to continue.'}
          </p>
          <Button onClick={handleConnect} size="lg" className="bg-green-600 hover:bg-green-700">
            <Wallet className="mr-2 h-5 w-5" />
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  // Allow access if user is logged in OR has valid telegram session
  if (!user && !telegramSession) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⛔</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            Your wallet ({selectedAccount?.address.slice(0, 8)}...) does not have admin privileges.
          </p>
          <p className="text-sm text-gray-500">
            Only founder and commission members can access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (requireMultisigMember) {
    if (!multisigCheckDone) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-4" />
            <p className="text-gray-400">Verifying multisig signer status on-chain...</p>
          </div>
        </div>
      );
    }

    if (!isSigner) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-6xl mb-4">⛔</div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-4">
              Your wallet ({selectedAccount?.address.slice(0, 8)}...) is not one of the 5 USDT
              bridge multisig signatories.
            </p>
            <p className="text-sm text-gray-500">
              Only Serok, SerokiMeclise, Xezinedar, Noter, and Berdevk can access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};