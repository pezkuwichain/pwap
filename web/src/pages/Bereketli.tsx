import { useEffect } from 'react';
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

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        // Not signed in: skip SSO and send the user to the Bereketli site,
        // which handles its own login. Never dead-end on this interstitial.
        if (!session?.access_token) {
          window.location.href = BEREKETLI_URL;
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
        // SSO failed (expired token, network, etc.) — fall back to the public
        // Bereketli site instead of stranding the user on app.pezkuwichain.io.
        if (import.meta.env.DEV) console.warn('Bereketli SSO failed, falling back:', err);
        window.location.href = BEREKETLI_URL;
      }
    })();
  }, [t]);

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
