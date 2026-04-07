import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CitizenshipModal } from '@/components/citizenship/CitizenshipModal';
import { InviteUserModal } from '@/components/referral/InviteUserModal';
import { Shield, Users, Award, Globe, ChevronRight, ArrowLeft, UserPlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileShell from '@/components/MobileShell';

const BeCitizen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [referrerAddress, setReferrerAddress] = useState<string | null>(null);
  const { t } = useTranslation();

  // Check for referral parameter on mount
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerAddress(ref);
      // Auto-open modal if coming from referral link
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const isMobile = useIsMobile();

  // ── MOBILE VERSION ──
  if (isMobile) {
    return (
      <MobileShell title={`🏛️ ${t('beCitizen.heroTitle', 'Be a Citizen')}`} hideHeader>
        {/* HERO - fills viewport minus shell tab bar (64px) */}
        <div className="relative flex flex-col min-h-[calc(100vh-64px)] bg-gradient-to-b from-green-700 via-green-600 to-green-800 overflow-hidden">
          {/* Back button */}
          <div className="px-4 pt-3 pb-1 flex items-center">
            <button onClick={() => navigate('/')} className="p-1.5 rounded-lg bg-white/15 active:bg-white/25">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Decorative circles */}
          <div className="absolute top-10 right-0 w-40 h-40 bg-yellow-400/10 rounded-full -mr-16" />
          <div className="absolute bottom-20 left-0 w-32 h-32 bg-red-500/10 rounded-full -ml-12" />

          {/* Content centered */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center -mt-8">
            {/* Kurdistan flag stripe */}
            <div className="flex gap-1 mb-4">
              <div className="w-12 h-1.5 rounded-full bg-red-500" />
              <div className="w-12 h-1.5 rounded-full bg-white" />
              <div className="w-12 h-1.5 rounded-full bg-green-400" />
            </div>

            <span className="text-5xl mb-3">🏛️</span>

            <h1 className="text-2xl font-bold text-white mb-1 leading-tight">
              {t('beCitizen.heroTitle', 'Digital Kurdistan')}
            </h1>
            <h2 className="text-base font-semibold text-yellow-300 mb-4">
              {t('beCitizen.heroSubtitle', 'Be a Citizen')}
            </h2>

            <p className="text-sm text-white/80 leading-relaxed mb-6 max-w-[280px]">
              {t('beCitizen.heroDesc')}
            </p>

            {/* CTA Buttons */}
            <div className="w-full max-w-[280px] space-y-2.5">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                {t('beCitizen.startProcess', 'Start Citizenship Process')}
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-white/15 border border-white/30 text-white font-medium text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {t('beCitizen.inviteFriend', 'Invite a Friend')}
              </button>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <span className="text-[10px] bg-white/15 text-white/90 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" /> {t('beCitizen.zkAuth', 'ZK Authentication')}
              </span>
              <span className="text-[10px] bg-white/15 text-white/90 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Award className="w-3 h-3" /> {t('beCitizen.soulboundNft', 'Soulbound NFT')}
              </span>
              <span className="text-[10px] bg-white/15 text-white/90 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" /> {t('beCitizen.decentralizedId', 'Decentralized ID')}
              </span>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="flex flex-col items-center pb-4 animate-bounce">
            <span className="text-white/50 text-[10px] mb-1">{t('mobile.scrollDown', 'Scroll')}</span>
            <ChevronRight className="w-4 h-4 text-white/50 rotate-90" />
          </div>
        </div>

        {/* SCROLLABLE CONTENT - Ready to Join and below */}
        <div className="bg-gradient-to-b from-green-800 via-white to-red-50 px-4 py-6 space-y-6">
          {/* Ready to Join CTA */}
          <Card className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 border-red-600 border-2 shadow-xl">
            <CardContent className="pt-6 pb-6">
              <div className="text-center space-y-3">
                <h3 className="text-lg font-bold text-red-700">{t('beCitizen.readyToJoin')}</h3>
                <p className="text-sm text-gray-800 font-medium">{t('beCitizen.readyToJoinDesc')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Grid - 2 col */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-red-50/90 border-red-600/50 shadow-md">
              <CardHeader className="p-4">
                <Shield className="h-8 w-8 text-red-600 mb-2" />
                <CardTitle className="text-sm text-red-700 font-bold">{t('beCitizen.privacyTitle')}</CardTitle>
                <CardDescription className="text-xs text-gray-700">{t('beCitizen.privacyDesc')}</CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-yellow-50/90 border-yellow-600/50 shadow-md">
              <CardHeader className="p-4">
                <Award className="h-8 w-8 text-yellow-700 mb-2" />
                <CardTitle className="text-sm text-yellow-800 font-bold">{t('beCitizen.nftTitle')}</CardTitle>
                <CardDescription className="text-xs text-gray-700">{t('beCitizen.nftDesc')}</CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-green-50/90 border-green-600/50 shadow-md">
              <CardHeader className="p-4">
                <Users className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle className="text-sm text-green-700 font-bold">{t('beCitizen.trustTitle')}</CardTitle>
                <CardDescription className="text-xs text-gray-700">{t('beCitizen.trustDesc')}</CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-red-50/90 border-red-600/50 shadow-md">
              <CardHeader className="p-4">
                <Globe className="h-8 w-8 text-red-600 mb-2" />
                <CardTitle className="text-sm text-red-700 font-bold">{t('beCitizen.govTitle')}</CardTitle>
                <CardDescription className="text-xs text-gray-700">{t('beCitizen.govDesc')}</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* How It Works */}
          <div>
            <h3 className="text-lg font-bold text-red-700 text-center mb-4">{t('beCitizen.howItWorks')}</h3>
            <div className="space-y-3">
              <Card className="bg-red-50/90 border-red-600/50 shadow-md">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">1</span>
                    </div>
                    <CardTitle className="text-sm text-red-700 font-bold">{t('beCitizen.existingTitle')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-gray-700 font-medium space-y-1 text-xs">
                  <p>✓ {t('beCitizen.existing1')}</p>
                  <p>✓ {t('beCitizen.existing2')}</p>
                  <p>✓ {t('beCitizen.existing3')}</p>
                  <p>✓ {t('beCitizen.existing4')}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50/90 border-yellow-600/50 shadow-md">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">2</span>
                    </div>
                    <CardTitle className="text-sm text-yellow-800 font-bold">{t('beCitizen.newTitle')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-gray-700 font-medium space-y-1 text-xs">
                  <p>✓ {t('beCitizen.new1')}</p>
                  <p>✓ {t('beCitizen.new2')}</p>
                  <p>✓ {t('beCitizen.new3')}</p>
                  <p>✓ {t('beCitizen.new4')}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50/90 border-green-600/50 shadow-md">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">3</span>
                    </div>
                    <CardTitle className="text-sm text-green-700 font-bold">{t('beCitizen.benefitsTitle')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-gray-700 font-medium space-y-1 text-xs">
                  <p>✓ {t('beCitizen.benefit1')}</p>
                  <p>✓ {t('beCitizen.benefit2')}</p>
                  <p>✓ {t('beCitizen.benefit3')}</p>
                  <p>✓ {t('beCitizen.benefit4')}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Security Notice */}
          <Card className="bg-yellow-50/90 border-yellow-600/50 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-yellow-700 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-700">
                  <p className="font-bold text-yellow-800 mb-1">{t('beCitizen.securityTitle')}</p>
                  <p className="font-medium">{t('beCitizen.securityDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="h-4" />
        </div>

        {/* Modals */}
        <CitizenshipModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} referrerAddress={referrerAddress} />
        <InviteUserModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />
      </MobileShell>
    );
  }

  // ── DESKTOP VERSION (unchanged) ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600">
      <div className="container mx-auto px-4 py-16">
        {/* Back to Home Button and Invite Friend */}
        <div className="mb-8 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 border-yellow-400 border-2 text-white font-semibold shadow-lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('beCitizen.backToHome')}
          </Button>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-green-700 hover:from-red-700 hover:to-green-800 border-yellow-400 border-2 text-white font-semibold shadow-lg group"
          >
            <span>{t('beCitizen.startProcess')}</span>
            <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 border-yellow-400 border-2 text-white font-semibold shadow-lg"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {t('beCitizen.inviteFriend')}
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-red-700 mb-6 drop-shadow-lg">
            🏛️ {t('beCitizen.heroTitle')}
          </h1>
          <h2 className="text-3xl md:text-4xl font-semibold text-green-700 mb-4 drop-shadow-lg">
            {t('beCitizen.heroSubtitle')}
          </h2>
          <p className="text-xl text-gray-800 font-semibold max-w-3xl mx-auto drop-shadow-md">
            {t('beCitizen.heroDesc')}
          </p>
        </div>

        {/* Ready to Join CTA */}
        <div className="max-w-4xl mx-auto mb-12">
          <Card className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 backdrop-blur-lg border-red-600 border-4 shadow-2xl">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-red-700 mb-3">{t('beCitizen.readyToJoin')}</h3>
                  <p className="text-gray-800 font-medium">
                    {t('beCitizen.readyToJoinDesc')}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center text-sm text-gray-700 font-medium">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-700" />
                    <span>{t('beCitizen.zkAuth')}</span>
                  </div>
                  <div className="hidden md:block text-red-600">•</div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-red-600" />
                    <span>{t('beCitizen.soulboundNft')}</span>
                  </div>
                  <div className="hidden md:block text-red-600">•</div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-green-700" />
                    <span>{t('beCitizen.decentralizedId')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-red-50/90 backdrop-blur-md border-red-600/50 hover:border-red-600 transition-all shadow-lg">
            <CardHeader>
              <Shield className="h-12 w-12 text-red-600 mb-3" />
              <CardTitle className="text-red-700 font-bold">{t('beCitizen.privacyTitle')}</CardTitle>
              <CardDescription className="text-gray-700 font-medium">
                {t('beCitizen.privacyDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-yellow-50/90 backdrop-blur-md border-yellow-600/50 hover:border-yellow-600 transition-all shadow-lg">
            <CardHeader>
              <Award className="h-12 w-12 text-yellow-700 mb-3" />
              <CardTitle className="text-yellow-800 font-bold">{t('beCitizen.nftTitle')}</CardTitle>
              <CardDescription className="text-gray-700 font-medium">
                {t('beCitizen.nftDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-green-50/90 backdrop-blur-md border-green-600/50 hover:border-green-600 transition-all shadow-lg">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mb-3" />
              <CardTitle className="text-green-700 font-bold">{t('beCitizen.trustTitle')}</CardTitle>
              <CardDescription className="text-gray-700 font-medium">
                {t('beCitizen.trustDesc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-red-50/90 backdrop-blur-md border-red-600/50 hover:border-red-600 transition-all shadow-lg">
            <CardHeader>
              <Globe className="h-12 w-12 text-red-600 mb-3" />
              <CardTitle className="text-red-700 font-bold">{t('beCitizen.govTitle')}</CardTitle>
              <CardDescription className="text-gray-700 font-medium">
                {t('beCitizen.govDesc')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Process Overview */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-red-700 text-center mb-8 drop-shadow-lg">{t('beCitizen.howItWorks')}</h3>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-red-50/90 backdrop-blur-md border-red-600/50 shadow-lg">
              <CardHeader>
                <div className="bg-red-600 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <CardTitle className="text-red-700 font-bold">{t('beCitizen.existingTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-700 font-medium space-y-2 text-sm">
                <p>✓ {t('beCitizen.existing1')}</p>
                <p>✓ {t('beCitizen.existing2')}</p>
                <p>✓ {t('beCitizen.existing3')}</p>
                <p>✓ {t('beCitizen.existing4')}</p>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50/90 backdrop-blur-md border-yellow-600/50 shadow-lg">
              <CardHeader>
                <div className="bg-yellow-600 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <CardTitle className="text-yellow-800 font-bold">{t('beCitizen.newTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-700 font-medium space-y-2 text-sm">
                <p>✓ {t('beCitizen.new1')}</p>
                <p>✓ {t('beCitizen.new2')}</p>
                <p>✓ {t('beCitizen.new3')}</p>
                <p>✓ {t('beCitizen.new4')}</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50/90 backdrop-blur-md border-green-600/50 shadow-lg">
              <CardHeader>
                <div className="bg-green-600 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <CardTitle className="text-green-700 font-bold">{t('beCitizen.benefitsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-700 font-medium space-y-2 text-sm">
                <p>✓ {t('beCitizen.benefit1')}</p>
                <p>✓ {t('beCitizen.benefit2')}</p>
                <p>✓ {t('beCitizen.benefit3')}</p>
                <p>✓ {t('beCitizen.benefit4')}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-12 max-w-3xl mx-auto">
          <Card className="bg-yellow-50/90 border-yellow-600/50 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-yellow-700 mt-1 flex-shrink-0" />
                <div className="text-sm text-gray-700">
                  <p className="font-bold text-yellow-800 mb-2">{t('beCitizen.securityTitle')}</p>
                  <p className="font-medium">
                    {t('beCitizen.securityDesc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CitizenshipModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} referrerAddress={referrerAddress} />
      <InviteUserModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />
    </div>
  );
};

export default BeCitizen;
