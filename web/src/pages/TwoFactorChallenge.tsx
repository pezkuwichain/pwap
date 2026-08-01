import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import { Loader2 } from 'lucide-react';

/**
 * The 2FA challenge shown after a correct password when the account has 2FA on.
 *
 * TwoFactorVerify already existed but was referenced from nowhere, so enabling
 * 2FA protected nothing — the setup screen worked and login never asked. This
 * page is what connects the two.
 *
 * Deliberately outside ProtectedRoute: that route redirects here whenever a
 * challenge is pending, so guarding this page with it would loop.
 *
 * Scope, stated plainly: this is a client-side gate. It stops someone who has
 * the password from reaching the app in a browser, which is what 2FA is for
 * here. It is not server-side enforcement — privileged operations verify
 * authority independently (wallet signature for admin actions, JWT for the
 * account's own data), and that is what actually protects funds and state.
 */
export default function TwoFactorChallenge() {
  const { user, loading, twoFactorPending, markTwoFactorVerified, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  useEffect(() => {
    if (loading) return;
    // Nothing to challenge: either signed out, or already past it.
    if (!user) navigate('/login', { replace: true });
    else if (!twoFactorPending) navigate(returnTo, { replace: true });
  }, [loading, user, twoFactorPending, navigate, returnTo]);

  if (loading || !user || !twoFactorPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <TwoFactorVerify
        userId={user.id}
        onSuccess={() => {
          markTwoFactorVerified();
          navigate(returnTo, { replace: true });
        }}
        // Backing out of the challenge has to end the session. Leaving the user
        // signed in but unchallenged would defeat the point of asking.
        onCancel={async () => {
          await signOut();
          navigate('/login', { replace: true });
        }}
      />
    </div>
  );
}
