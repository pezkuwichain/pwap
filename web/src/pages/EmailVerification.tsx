import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Loader2, ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const { t } = useTranslation();

  // Get email from navigation state (after sign up)
  const email = location.state?.email;
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  useEffect(() => {
    // Handle Supabase email confirmation callback
    if (type === 'signup' || type === 'email_change') {
      // Supabase handles this automatically via the URL hash
      // Check if we have an active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setVerified(true);
        }
      });
    } else if (token) {
      verifyEmail(token);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type]);

  const verifyEmail = async (verifyToken: string) => {
    setVerifying(true);
    try {
      const { error } = await supabase.functions.invoke('email-verification', {
        body: { action: 'verify', token: verifyToken }
      });

      if (error) throw error;

      setVerified(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('emailVerify.failedToVerify');
      setError(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) return;

    setResending(true);
    setError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend email';
      setError(errorMessage);
    } finally {
      setResending(false);
    }
  };

  // Show "check your email" screen after sign up
  if (email && !token && !type) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md relative bg-gray-900/90 backdrop-blur-xl border-gray-800">
          <button
            onClick={() => navigate('/login')}
            className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors z-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-white">{t('emailVerify.checkEmail')}</CardTitle>
            <CardDescription className="text-gray-400">
              {t('emailVerify.sentVerificationTo')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-lg font-medium text-green-400">{email}</p>

            <div className="bg-gray-800/50 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm text-gray-300">{t('emailVerify.checkInbox')}</p>
              <p className="text-xs text-gray-500">{t('emailVerify.checkSpam')}</p>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {resent && (
              <p className="text-sm text-green-400">{t('emailVerify.emailSent')}</p>
            )}

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
                onClick={handleResendEmail}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('emailVerify.sending')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('emailVerify.resend')}
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
                onClick={() => navigate('/login')}
              >
                {t('emailVerify.backToLogin')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification status screen (when user clicks email link)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md relative bg-gray-900/90 backdrop-blur-xl border-gray-800">
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CardHeader>
          <CardTitle className="text-white">{t('emailVerify.title')}</CardTitle>
          <CardDescription className="text-gray-400">
            {verifying ? t('emailVerify.verifyingEmail') : t('emailVerify.verificationStatus')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {verifying && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-green-500" />
              <p className="text-gray-300">{t('emailVerify.pleaseWait')}</p>
            </div>
          )}

          {!verifying && verified && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold text-white">{t('emailVerify.success')}</h3>
              <p className="text-gray-400">
                {t('emailVerify.successDesc')}
              </p>
              <Button
                className="bg-green-600 hover:bg-green-500"
                onClick={() => navigate('/login')}
              >
                {t('emailVerify.goToLogin')}
              </Button>
            </div>
          )}

          {!verifying && !verified && error && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-12 w-12 text-red-500" />
              <h3 className="text-lg font-semibold text-white">{t('emailVerify.failed')}</h3>
              <p className="text-gray-400">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/')}>
                  {t('emailVerify.goToHome')}
                </Button>
                <Button onClick={() => navigate('/login')}>
                  {t('emailVerify.login')}
                </Button>
              </div>
            </div>
          )}

          {!verifying && !verified && !error && !token && !type && (
            <div className="flex flex-col items-center space-y-4">
              <Mail className="h-12 w-12 text-gray-500" />
              <h3 className="text-lg font-semibold text-white">{t('emailVerify.noToken')}</h3>
              <p className="text-gray-400">
                {t('emailVerify.noTokenDesc')}
              </p>
              <Button onClick={() => navigate('/login')}>
                {t('emailVerify.backToLogin')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
