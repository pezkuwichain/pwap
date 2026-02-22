import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Copy, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TwoFactorSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'setup', userId: user?.id }
      });

      if (error) throw error;
      
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setShowSetup(true);
      
      toast({
        title: t('twoFactor.setupStarted'),
        description: t('twoFactor.scanQrDesc'),
      });
    } catch (error) {
      toast({
        title: t('twoFactor.setupFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!verificationCode) {
      toast({
        title: t('common.error'),
        description: t('twoFactor.enterVerification'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('two-factor-auth', {
        body: {
          action: 'enable',
          userId: user?.id,
          code: verificationCode
        }
      });

      if (error) throw error;
      
      setIsEnabled(true);
      setShowSetup(false);
      
      toast({
        title: t('twoFactor.enabled'),
        description: t('twoFactor.enabledDesc'),
      });
    } catch (error) {
      toast({
        title: t('twoFactor.verificationFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('two-factor-auth', {
        body: { action: 'disable', userId: user?.id }
      });

      if (error) throw error;
      
      setIsEnabled(false);
      setSecret('');
      setBackupCodes([]);
      
      toast({
        title: t('twoFactor.disabled'),
        description: t('twoFactor.disabledDesc'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('twoFactor.title')}
        </CardTitle>
        <CardDescription>
          {t('twoFactor.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEnabled && !showSetup && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('twoFactor.infoAlert')}
              </AlertDescription>
            </Alert>
            <Button onClick={handleSetup} disabled={isLoading}>
              {t('twoFactor.setupBtn')}
            </Button>
          </div>
        )}

        {showSetup && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">{t('twoFactor.scanQrTitle')}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('twoFactor.scanQrHint')}
              </p>
              <div className="bg-muted p-2 rounded font-mono text-xs break-all">
                {secret}
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">{t('twoFactor.saveBackup')}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('twoFactor.saveBackupHint')}
              </p>
              <div className="bg-muted p-3 rounded space-y-1">
                {backupCodes.map((code, i) => (
                  <div key={i} className="font-mono text-xs">{code}</div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={copyBackupCodes}
              >
                {copiedCodes ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedCodes ? t('twoFactor.copied') : t('twoFactor.copyCodes')}
              </Button>
            </div>

            <div className="p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">{t('twoFactor.verifySetup')}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('twoFactor.enterCode')}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                />
                <Button onClick={handleEnable} disabled={isLoading}>
                  {t('twoFactor.enableBtn')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEnabled && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {t('twoFactor.enabledAlert')}
              </AlertDescription>
            </Alert>
            <Button variant="destructive" onClick={handleDisable} disabled={isLoading}>
              {t('twoFactor.disableBtn')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}