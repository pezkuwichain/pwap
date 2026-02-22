import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TwoFactorVerifyProps {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function TwoFactorVerify({ userId, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async (useBackup: boolean = false) => {
    const code = useBackup ? backupCode : verificationCode;
    
    if (!code) {
      toast({
        title: t('common.error'),
        description: t('twoFactor.pleaseEnterCode'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('two-factor-auth', {
        body: { 
          action: 'verify', 
          userId,
          code: useBackup ? undefined : code,
          backupCode: useBackup ? code : undefined
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: t('twoFactor.verifySuccess'),
          description: t('twoFactor.authenticated'),
        });
        onSuccess();
      } else {
        throw new Error(data.error || 'Verification failed');
      }
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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('twoFactor.title')}
        </CardTitle>
        <CardDescription>
          {t('twoFactor.enterAuthCode')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="authenticator" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="authenticator">{t('twoFactor.authenticatorTab')}</TabsTrigger>
            <TabsTrigger value="backup">{t('twoFactor.backupTab')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="authenticator" className="space-y-4">
            <Alert>
              <AlertDescription>
                {t('twoFactor.enterCode')}
              </AlertDescription>
            </Alert>
            <Input
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl font-mono"
            />
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => handleVerify(false)}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('twoFactor.verify')}
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="backup" className="space-y-4">
            <Alert>
              <AlertDescription>
                {t('twoFactor.enterBackupCode')}
              </AlertDescription>
            </Alert>
            <Input
              placeholder="Backup code"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => handleVerify(true)}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('twoFactor.verify')}
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}