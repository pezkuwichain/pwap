import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileShell from '@/components/MobileShell';
import { supabase } from '@/lib/supabase';
import { Loader2, RefreshCw } from 'lucide-react';

const BEREKETLI_URL = 'https://bereketli.pezkiwi.app';
const BEREKETLI_API = `${BEREKETLI_URL}/v1`;
const CACHE_KEY = 'pwap_bereketli_tokens';

interface CachedTokens {
  access_token: string;
  refresh_token: string;
  timestamp: number;
}

export default function Bereketli() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<CachedTokens | null>(null);

  const exchangeToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first (valid for 10 minutes)
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedTokens = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
          setTokens(parsed);
          setLoading(false);
          return;
        }
      }

      // Get Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(t('bereketli.noSession', 'Please login first'));
        setLoading(false);
        return;
      }

      // Exchange Supabase token for Bereketli token
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
      const newTokens: CachedTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        timestamp: Date.now(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(newTokens));
      setTokens(newTokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token exchange failed');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    exchangeToken();
  }, [exchangeToken]);

  // Send tokens to iframe after it loads
  const handleIframeLoad = useCallback(() => {
    if (!tokens || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 'bereketli:auth-inject',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }, BEREKETLI_URL);
  }, [tokens]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== BEREKETLI_URL) return;
      if (event.data?.type === 'bereketli:auth-required') {
        // Token expired, re-exchange
        localStorage.removeItem(CACHE_KEY);
        exchangeToken();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [exchangeToken]);

  const content = (
    <div className="flex flex-col h-full bg-gray-950">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-400">{t('bereketli.connecting', 'Connecting to Bereketli...')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => { localStorage.removeItem(CACHE_KEY); exchangeToken(); }}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              {t('bereketli.retry', 'Retry')}
            </button>
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={BEREKETLI_URL}
          onLoad={handleIframeLoad}
          allow="camera; geolocation"
          className="flex-1 w-full border-0"
          title="Bereketli"
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileShell title={`🤖 ${t('mobile.app.b2b', 'Bereketli')}`}>
        {content}
      </MobileShell>
    );
  }

  // Desktop: simple centered layout
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto py-4">
        <button onClick={() => navigate('/')} className="mb-4 text-sm text-gray-400 hover:text-white">
          ← {t('common.backToHome', 'Back to Home')}
        </button>
        <div className="h-[calc(100vh-80px)] rounded-xl overflow-hidden border border-gray-800">
          {content}
        </div>
      </div>
    </div>
  );
}
