import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { P2PIdentityProvider, useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, UserCheck, Wallet, Home } from 'lucide-react';

function IdentityGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedAccount } = usePezkuwi();
  const { hasIdentity, loading, applyForVisa } = useP2PIdentity();

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('p2pIdentity.resolving')}</p>
      </div>
    );
  }

  // No wallet connected
  if (!selectedAccount) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>{t('p2pIdentity.connectWalletTitle')}</CardTitle>
            <CardDescription>{t('p2pIdentity.connectWalletDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              {t('p2p.backToHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has identity - show content with identity badge
  if (hasIdentity) {
    return <>{children}</>;
  }

  // No identity - show visa application
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-yellow-500" />
          </div>
          <CardTitle>{t('p2pIdentity.identityRequired')}</CardTitle>
          <CardDescription>{t('p2pIdentity.identityRequiredDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3 mb-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <span className="font-medium">{t('p2pIdentity.citizenOption')}</span>
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">{t('p2pIdentity.fullAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('p2pIdentity.citizenDesc')}</p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => navigate('/be-citizen')}
              >
                {t('p2pIdentity.applyCitizenship')}
              </Button>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{t('p2pIdentity.visaOption')}</span>
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">{t('p2pIdentity.limitedAccess')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('p2pIdentity.visaDesc')}</p>
              <Button
                className="mt-3 w-full"
                onClick={async () => {
                  const result = await applyForVisa();
                  if (!result) {
                    // toast handled inside applyForVisa or context
                  }
                }}
              >
                {t('p2pIdentity.applyVisa')}
              </Button>
            </div>
          </div>

          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            {t('p2p.backToHome')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function P2PLayout({ children }: { children: ReactNode }) {
  return (
    <P2PIdentityProvider>
      <IdentityGate>{children}</IdentityGate>
    </P2PIdentityProvider>
  );
}
