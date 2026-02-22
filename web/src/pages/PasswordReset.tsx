import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'request', email }
      });

      if (error) throw error;

      toast({
        title: t('passwordReset.resetEmailSent'),
        description: t('passwordReset.resetEmailSentDesc'),
      });
      
      setEmail('');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('passwordReset.failedToSend'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('passwordReset.passwordMismatch'),
        variant: "destructive"
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: t('common.error'),
        description: t('passwordReset.passwordTooShort'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'reset', token, newPassword: password }
      });

      if (error) throw error;

      toast({
        title: t('passwordReset.success'),
        description: t('passwordReset.successDesc'),
      });
      
      navigate('/login');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('passwordReset.failedToReset'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md relative">
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CardHeader>
          <CardTitle>{token ? t('passwordReset.resetPassword') : t('passwordReset.forgotPassword')}</CardTitle>
          <CardDescription>
            {token
              ? t('passwordReset.enterNewPassword')
              : t('passwordReset.enterEmail')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('passwordReset.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('passwordReset.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('passwordReset.sendResetLink')}
              </Button>
              
              <div className="text-center text-sm">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate('/login')}
                  className="text-primary"
                >
                  {t('passwordReset.backToLogin')}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('passwordReset.newPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('passwordReset.newPasswordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('passwordReset.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('passwordReset.confirmPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('passwordReset.resetBtn')}
              </Button>
              
              <div className="text-center text-sm">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate('/login')}
                  className="text-primary"
                >
                  {t('passwordReset.backToLogin')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}