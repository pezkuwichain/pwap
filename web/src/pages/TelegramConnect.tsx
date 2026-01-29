/**
 * Telegram Mini App Connect Page
 * Handles authentication from Telegram mini app and redirects to P2P
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Status = 'loading' | 'connecting' | 'success' | 'error';

export default function TelegramConnect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Girêdan tê kirin...');
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
          setError('Parametreyên nederbasdar. Ji kerema xwe ji mini app-ê dest pê bikin.');
          return;
        }

        // Check timestamp (allow 5 minutes)
        if (timestamp) {
          const ts = parseInt(timestamp, 10);
          const now = Date.now();
          if (now - ts > 5 * 60 * 1000) {
            setStatus('error');
            setError('Lînk qediya. Ji kerema xwe dîsa biceribînin.');
            return;
          }
        }

        setStatus('connecting');
        setMessage('Bikarhêner tê pejirandin...');

        // Find user by telegram_id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, telegram_id, wallet_address, username, first_name')
          .eq('telegram_id', parseInt(telegramId, 10))
          .single();

        if (userError || !userData) {
          setStatus('error');
          setError('Bikarhêner nehat dîtin. Ji kerema xwe berî dest bi P2P-ê bikin, di mini app-ê de cîzdanê xwe ava bikin.');
          return;
        }

        // Update wallet address if provided and different
        if (walletAddress && walletAddress !== userData.wallet_address) {
          await supabase
            .from('users')
            .update({ wallet_address: walletAddress })
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
          setMessage('Serketî! Tê veguheztin...');
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
          setMessage('Serketî! Tê veguheztin...');
          setTimeout(() => navigate('/p2p'), 1000);
          return;
        }

        // Success - redirect to P2P
        setStatus('success');
        setMessage('Serketî! Tê veguheztin...');
        setTimeout(() => navigate('/p2p'), 1000);

      } catch (err) {
        console.error('Telegram connect error:', err);
        setStatus('error');
        setError('Xeletî di girêdanê de. Ji kerema xwe dîsa biceribînin.');
      }
    };

    connect();
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
          {status === 'error' ? 'Xeletî' : 'Telegram Connect'}
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
              Pencereyê Bigire
            </button>
            <p className="text-xs text-gray-500">
              Ji kerema xwe vegerin mini app-ê û dîsa biceribînin
            </p>
          </div>
        )}

        {/* Success Info */}
        {status === 'success' && (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">P2P Platform tê vekirin...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
