import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const BEREKETLI_URL = 'https://bereketli.pezkiwi.app';
const BEREKETLI_API = `${BEREKETLI_URL}/v1`;

/**
 * Exchanges the PWAP Supabase token for a Bereketli JWT,
 * then redirects the user to bereketli.pezkiwi.app/app with the token.
 */
export default function Bereketli() {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError(t('bereketli.noSession', 'Lütfen önce giriş yapın'));
          return;
        }

        // Exchange Supabase token for Bereketli JWT
        const res = await fetch(`${BEREKETLI_API}/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supabase_token: session.access_token }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Exchange failed (${res.status})`);
        }

        const data = await res.json();

        // Redirect to Bereketli app with tokens as URL hash (not visible to server)
        const params = new URLSearchParams({
          t: data.access_token,
          r: data.refresh_token,
        });
        window.location.href = `${BEREKETLI_URL}/app?auth=${btoa(params.toString())}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bağlantı hatası');
      }
    })();
  }, [t]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
          >
            {t('common.backToHome', 'Ana Sayfaya Dön')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto" />
        <p className="text-sm text-gray-400">
          {t('bereketli.connecting', "Bereketli'ye yönlendiriliyor...")}
        </p>
      </div>
    </div>
  );
}
