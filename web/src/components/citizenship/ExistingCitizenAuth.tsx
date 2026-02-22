import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { verifyCitizenNumber } from '@pezkuwi/lib/tiki';
import { generateAuthChallenge, signChallenge, verifySignature, saveCitizenSession } from '@pezkuwi/lib/citizenship-workflow';
import type { AuthChallenge } from '@pezkuwi/lib/citizenship-workflow';

interface ExistingCitizenAuthProps {
  onClose: () => void;
}

export const ExistingCitizenAuth: React.FC<ExistingCitizenAuthProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { peopleApi, isPeopleReady, selectedAccount, connectWallet } = usePezkuwi();

  const [citizenNumber, setCitizenNumber] = useState('');
  const [step, setStep] = useState<'input' | 'verifying' | 'signing' | 'success' | 'error'>('input');
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);

  const handleVerifyNFT = async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setError(t('existingAuth.connectWallet'));
      return;
    }

    if (!citizenNumber.trim()) {
      setError(t('existingAuth.enterCitizenNumber'));
      return;
    }

    setError(null);
    setStep('verifying');

    try {
      // Verify Citizen Number on People Chain
      const isValid = await verifyCitizenNumber(peopleApi, citizenNumber, selectedAccount.address);

      if (!isValid) {
        setError(t('existingAuth.invalidNumber'));
        setStep('error');
        return;
      }

      // Generate challenge for signature
      const authChallenge = generateAuthChallenge(citizenNumber);
      setChallenge(authChallenge);
      setStep('signing');
    } catch {
      if (import.meta.env.DEV) console.error('Verification error:', err);
      setError(t('existingAuth.verificationFailed'));
      setStep('error');
    }
  };

  const handleSignChallenge = async () => {
    if (!selectedAccount || !challenge) {
      setError(t('existingAuth.missingAuthData'));
      return;
    }

    setError(null);

    try {
      // Sign the challenge
      const signature = await signChallenge(selectedAccount, challenge);

      // Verify signature (self-verification for demonstration)
      const isValid = await verifySignature(signature, challenge, selectedAccount.address);

      if (!isValid) {
        setError(t('existingAuth.signatureFailed'));
        setStep('error');
        return;
      }

      // Save session
      const session = {
        tikiNumber: citizenNumber,
        walletAddress: selectedAccount.address,
        sessionToken: signature, // In production, use proper JWT
        lastAuthenticated: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      await saveCitizenSession(session);

      setStep('success');

      // Redirect to citizens page after 2 seconds
      setTimeout(() => {
        onClose();
        window.location.href = '/citizens';
      }, 2000);
    } catch {
      if (import.meta.env.DEV) console.error('Signature error:', err);
      setError(t('existingAuth.signError'));
      setStep('error');
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch {
      setError(t('existingAuth.walletConnectFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-500" />
            {t('existingAuth.title')}
          </CardTitle>
          <CardDescription>
            {t('existingAuth.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Enter Citizen Number */}
          {step === 'input' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="citizenNumber">{t('existingAuth.citizenNumber')}</Label>
                <Input
                  id="citizenNumber"
                  placeholder="#42-0-123456"
                  value={citizenNumber}
                  onChange={(e) => setCitizenNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyNFT()}
                  className="bg-gray-100 dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('existingAuth.citizenNumberHint')}
                </p>
              </div>

              {!selectedAccount ? (
                <Button onClick={handleConnectWallet} className="w-full">
                  {t('existingAuth.connectWalletFirst')}
                </Button>
              ) : (
                <Button onClick={handleVerifyNFT} className="w-full">
                  {t('existingAuth.verifyCitizenNumber')}
                </Button>
              )}
            </>
          )}

          {/* Step 2: Verifying */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
              <p className="text-sm text-muted-foreground">{t('existingAuth.verifying')}</p>
            </div>
          )}

          {/* Step 3: Sign Challenge */}
          {step === 'signing' && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  {t('existingAuth.nftVerified')}
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t('existingAuth.authChallenge')}</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {challenge?.nonce}
                </p>
              </div>

              <Button onClick={handleSignChallenge} className="w-full">
                {t('existingAuth.signMessage')}
              </Button>
            </>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h3 className="text-lg font-semibold">{t('existingAuth.authSuccess')}</h3>
              <p className="text-sm text-muted-foreground text-center">
                {t('existingAuth.welcomeBack', { number: citizenNumber })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('existingAuth.redirecting')}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'error' && (
            <Button onClick={() => { setStep('input'); setError(null); }} variant="outline" className="w-full">
              {t('existingAuth.tryAgain')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="bg-cyan-500/10 border-cyan-500/30">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t('existingAuth.securityInfo')}
            </h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• {t('existingAuth.securityNft')}</li>
              <li>• {t('existingAuth.securitySig')}</li>
              <li>• {t('existingAuth.securityExpire')}</li>
              <li>• {t('existingAuth.securityNoData')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
