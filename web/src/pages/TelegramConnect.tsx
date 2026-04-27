/**
 * Telegram Mini App Connect Page
 * Handles authentication from Telegram mini app and redirects to P2P
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { identityToUUID } from '@shared/lib/identity';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Status = 'loading' | 'connecting' | 'success' | 'error';

export default function TelegramConnect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState(t('telegramConnect.connecting'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        // Get params from URL
        const telegramId = searchParams.get('tg_id');
        const walletAddress = searchParams.get('wallet');
        const timestamp = searchParams.get('ts');
        const from = searchParams.get('from');

        // Validate params
        if (!telegramId || from !== 'miniapp') {
          setStatus('error');
          setError(t('telegramConnect.invalidParams'));
          return;
        }

        // Check timestamp (allow 5 minutes)
        if (timestamp) {
          const ts = parseInt(timestamp, 10);
          const now = Date.now();
          if (now - ts > 5 * 60 * 1000) {
            setStatus('error');
            setError(t('telegramConnect.linkExpired'));
            return;
          }
        }

        setStatus('connecting');
        setMessage(t('telegramConnect.authenticating'));

        // Find user by telegram_id
        const { data: userData, error: userError } = await supabase
          .from('tg_users')
          .select('id, telegram_id, wallet_address, p2p_user_id')
          .eq('telegram_id', parseInt(telegramId, 10))
          .single();

        if (userError || !userData) {
          setStatus('error');
          setError(t('telegramConnect.userNotFound'));
          return;
        }

        // Update wallet address and resolve p2p_user_id if not already set
        const updates: Record<string, unknown> = {};
        if (walletAddress && walletAddress !== userData.wallet_address) {
          updates.wallet_address = walletAddress;
        }

        if (!userData.p2p_user_id && walletAddress) {
          // Try to find visa linked to this wallet (non-citizen users)
          const { data: visa } = await supabase
            .from('p2p_visa')
            .select('visa_number')
            .eq('wallet_address', walletAddress)
            .eq('status', 'active')
            .maybeSingle();

          if (visa?.visa_number) {
            updates.p2p_user_id = await identityToUUID(visa.visa_number);
          }
          // Welati (citizen) users: p2p_user_id will be set when they visit pwap/web P2P
          // with their wallet connected (see P2PIdentityContext → linkTelegramP2PIdentity)
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('tg_users')
            .update(updates)
            .eq('id', userData.id);
        }

        // Generate email for this telegram user (for Supabase auth)
        const telegramEmail = `telegram_${telegramId}@pezkuwichain.io`;

        // Try to sign in with magic link (will be sent to email, but we'll catch it)
        // Or check if user already has an auth account
        const { data: authData } = await supabase.auth.getSession();

        if (authData?.session) {
          // Already logged in, redirect to P2P
          setStatus('success');
          setMessage(t('telegramConnect.success'));
          setTimeout(() => navigate('/p2p'), 1000);
          return;
        }

        // Try to sign in with OTP/magic link
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: telegramEmail,
          options: {
            shouldCreateUser: true,
            data: {
              telegram_id: parseInt(telegramId, 10),
              wallet_address: walletAddress,
              username: userData.username || userData.first_name,
            },
          },
        });

        if (signInError) {
          // If OTP fails, try password-less sign in
          console.error('OTP sign in failed:', signInError);

          // Store telegram session info in localStorage for P2P access
          localStorage.setItem('telegram_session', JSON.stringify({
            telegram_id: telegramId,
            wallet_address: walletAddress,
            username: userData.username || userData.first_name,
            timestamp: Date.now(),
          }));

          setStatus('success');
          setMessage(t('telegramConnect.success'));
          setTimeout(() => navigate('/p2p'), 1000);
          return;
        }

        // Success - redirect to P2P
        setStatus('success');
        setMessage(t('telegramConnect.success'));
        setTimeout(() => navigate('/p2p'), 1000);

      } catch (err) {
        console.error('Telegram connect error:', err);
        setStatus('error');
        setError(t('telegramConnect.connectionError'));
      }
    };

    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center">
        {/* Logo */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center">
          {status === 'loading' || status === 'connecting' ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-8 h-8 text-white" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-white" />
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-white mb-2">
          {status === 'error' ? t('telegramConnect.errorTitle') : t('telegramConnect.title')}
        </h1>

        {/* Status Message */}
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
          {error || message}
        </p>

        {/* Error Action */}
        {status === 'error' && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => window.close()}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
            >
              {t('telegramConnect.closeWindow')}
            </button>
            <p className="text-xs text-gray-500">
              {t('telegramConnect.returnToMiniApp')}
            </p>
          </div>
        )}

        {/* Success Info */}
        {status === 'success' && (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">{t('telegramConnect.openingP2P')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
