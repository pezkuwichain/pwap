import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { isMobileApp, getNativeWalletAddress, getNativeAccountName } from '@/lib/mobile-bridge';
import { getCaptchaToken } from '@/lib/captcha';

// Session timeout configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
const REMEMBER_ME_KEY = 'remember_me';
const TWO_FACTOR_VERIFIED_KEY = 'two_factor_verified_user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** Signed in, has 2FA enabled, and has not passed it yet in this browser session. */
  twoFactorPending: boolean;
  markTwoFactorVerified: () => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string, referralCode?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkAdminStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  // ========================================
  // SESSION TIMEOUT MANAGEMENT
  // ========================================

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
     
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // sessionStorage, not localStorage: 2FA is asked once per browser session and
  // again after the tab is closed. Persisting it would mean enabling 2FA once and
  // never being challenged again on that device.
  const clearTwoFactorVerification = () => {
    try {
      sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
    } catch {
      // private mode / storage disabled — the pending flag simply stays in memory
    }
  };

  /**
   * Whether this user still owes a 2FA challenge.
   *
   * 2FA is optional, so a user without it enabled is never blocked. A failure to
   * ask is treated as "not required": a transient error while checking must not
   * turn into a login wall for people who never enabled 2FA in the first place.
   */
  const refreshTwoFactorState = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setTwoFactorPending(false);
      return;
    }

    try {
      if (sessionStorage.getItem(TWO_FACTOR_VERIFIED_KEY) === currentUser.id) {
        setTwoFactorPending(false);
        return;
      }
    } catch {
      // storage unavailable; fall through and ask again
    }

    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'check' },
      });
      setTwoFactorPending(!error && Boolean(data?.enabled));
    } catch {
      setTwoFactorPending(false);
    }
  }, []);

  const markTwoFactorVerified = useCallback(() => {
    try {
      if (user) sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, user.id);
    } catch {
      // storage unavailable — the in-memory flag below still unblocks this session
    }
    setTwoFactorPending(false);
  }, [user]);

  const signOut = useCallback(async () => {
    setIsAdmin(false);
    setUser(null);
    setTwoFactorPending(false);
    clearTwoFactorVerification();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    await supabase.auth.signOut();
  }, []);

  // Check if session has timed out
  const checkSessionTimeout = useCallback(async () => {
    if (!user) return;

    // Skip timeout check if "Remember Me" is enabled
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY);
    if (rememberMe === 'true') {
      return; // Don't timeout if user chose to be remembered
    }

    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) {
      updateLastActivity();
      return;
    }

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();
    const inactiveTime = now - lastActivityTime;

    if (inactiveTime >= SESSION_TIMEOUT_MS) {
      if (import.meta.env.DEV) console.log('⏱️ Session timeout - logging out due to inactivity');
      await signOut();
    }
  }, [user, updateLastActivity, signOut]);

  // Setup activity listeners
  useEffect(() => {
    if (!user) return;

    // Update activity on user interactions
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateLastActivity();
     
     
    };

    // Register event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Initial activity timestamp
    updateLastActivity();
     
     

    // Check for timeout periodically
    const timeoutChecker = setInterval(checkSessionTimeout, ACTIVITY_CHECK_INTERVAL_MS);

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(timeoutChecker);
    };
  }, [user, updateLastActivity, checkSessionTimeout]);


  const checkAdminStatus = useCallback(async () => {
    // ============================================================
    // COSMETIC ONLY — NOT an authorization boundary.
    // ------------------------------------------------------------
    // This flag is derived from a localStorage wallet value and can be trivially
    // forged in DevTools. It ONLY controls whether admin UI is shown. Every
    // privileged operation MUST be verified server-side:
    //   - Dispute claim/resolve -> `resolve-dispute` edge function verifies a
    //     wallet SIGNATURE against the server-side admin wallet set before doing
    //     anything (see supabase/functions/resolve-dispute + _shared/identity-auth).
    // Do NOT add fund-moving or state-changing logic gated solely on isAdmin.
    // ============================================================
    // Admin wallet whitelist (blockchain-based auth)
    const ADMIN_WALLETS = [
      '5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF', // Founder
      '5EhCpn82QtdU53MF6PoNFrKHgSrsfcAxFTMwrn3JYf9dioQw', // Treasury admin
      '5ELgySrX5ZyK7EWXjj6bAedyTCcTNWDANbiiipsT5gnpoCEp', // Admin
    ];

    try {
      // PRIMARY: Check wallet-based admin (blockchain auth)
      const connectedWallet = localStorage.getItem('selectedWallet');
      if (import.meta.env.DEV) console.log('🔍 Admin check - Connected wallet:', connectedWallet);
      if (import.meta.env.DEV) console.log('🔍 Admin check - Whitelist:', ADMIN_WALLETS);

      if (connectedWallet && ADMIN_WALLETS.includes(connectedWallet)) {
        if (import.meta.env.DEV) console.log('✅ Admin access granted (wallet-based)');
        setIsAdmin(true);
        return true;
      }

      // SECONDARY: Supabase admin_roles check disabled (table may not exist)
      // Admin access is primarily wallet-based via the whitelist above

      if (import.meta.env.DEV) console.log('❌ Admin access denied (wallet not in whitelist)');
      setIsAdmin(false);
      return false;
    } catch (err) {
      if (import.meta.env.DEV) console.error('Admin check error:', err);
      setIsAdmin(false);
      return false;
    }
  }, []);

  // Setup native mobile wallet if running in mobile app
  const setupMobileWallet = useCallback(() => {
    if (isMobileApp()) {
      const nativeAddress = getNativeWalletAddress();
      const nativeAccountName = getNativeAccountName();

      if (nativeAddress) {
        // Store native wallet address for admin checks and wallet operations
        localStorage.setItem('selectedWallet', nativeAddress);
        if (nativeAccountName) {
          localStorage.setItem('selectedWalletName', nativeAccountName);
        }
        if (import.meta.env.DEV) {
          console.log('[Mobile] Native wallet detected:', nativeAddress);
        }
        // Dispatch wallet change event
        window.dispatchEvent(new Event('walletChanged'));
      }
    }
  }, []);

  useEffect(() => {
    // Setup mobile wallet first
    setupMobileWallet();

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdminStatus(); // Check admin status regardless of Supabase session
      refreshTwoFactorState(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      // If Supabase is not available, still check wallet-based admin
      checkAdminStatus();
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      refreshTwoFactorState(session?.user ?? null);
      checkAdminStatus(); // Check admin status on auth change
      setLoading(false);
    });

    // Listen for wallet changes (from PezkuwiContext or native bridge)
    const handleWalletChange = () => {
      checkAdminStatus();
    };
    window.addEventListener('walletChanged', handleWalletChange);

    // Listen for native bridge ready event (mobile app)
    const handleNativeReady = () => {
      if (import.meta.env.DEV) {
        console.log('[Mobile] Native bridge ready');
      }
      setupMobileWallet();
      checkAdminStatus();
    };
    window.addEventListener('pezkuwi-native-ready', handleNativeReady);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('walletChanged', handleWalletChange);
      window.removeEventListener('pezkuwi-native-ready', handleNativeReady);
    };
  }, [checkAdminStatus, setupMobileWallet, refreshTwoFactorState]);

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      // GoTrue enforces the captcha on /token with grant_type=password, so a
      // password login needs a token like signup does. Refresh-token calls are
      // exempt, which is why existing sessions keep working on their own.
      const captchaToken = await getCaptchaToken();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });

      if (!error && data.user) {
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, 'true');
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
        await checkAdminStatus();
      }

      return { error };
    } catch {
      return {
        error: {
          message: 'Authentication service unavailable. Please try again later.'
        }
      };
    }
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    try {
      const captchaToken = await getCaptchaToken();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
          data: {
            username,
            referral_code: referralCode || null,
          },
        },
      });

      if (!error && data.user) {
        // Create profile in profiles table with referral code
        await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          email,
          referred_by: referralCode || null,
        });
        
        // If there&apos;s a referral code, track it
        if (referralCode) {
          // You can add logic here to reward the referrer
          // For example, update their referral count or add rewards
          if (import.meta.env.DEV) console.log(`User registered with referral code: ${referralCode}`);
        }
      }

      return { error };
    } catch {
      return { 
        error: { 
          message: 'Registration service unavailable. Please try again later.' 
        } 
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin,
      twoFactorPending,
      markTwoFactorVerified,
      signIn,
      signUp,
      signOut,
      checkAdminStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};