import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { supabase } from '@/lib/supabase';
import { User, Mail, Phone, Globe, MapPin, Calendar, Shield, AlertCircle, ArrowLeft, Award, Users, TrendingUp, UserMinus, Play, Loader2, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchUserTikis, getPrimaryRole, getTikiDisplayName, getTikiColor, getTikiEmoji, getUserRoleCategories, getAllTikiNFTDetails, generateCitizenNumber, type TikiNFTDetails } from '@pezkuwi/lib/tiki';
import { getAllScores, getStakingScoreStatus, startScoreTracking, getPezRewards, recordTrustScore, claimPezReward, type UserScores, type StakingScoreStatus, type PezRewardInfo, formatDuration } from '@pezkuwi/lib/scores';
import { web3FromAddress } from '@pezkuwi/extension-dapp';
import { getKycStatus } from '@pezkuwi/lib/kyc';
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';
// Commission proposals card removed - no longer using notary system for KYC approval
// import { CommissionProposalsCard } from '@/components/dashboard/CommissionProposalsCard';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { api, isApiReady, peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tikis, setTikis] = useState<string[]>([]);
  const [scores, setScores] = useState<UserScores>({
    trustScore: 0,
    referralScore: 0,
    stakingScore: 0,
    tikiScore: 0,
    totalScore: 0
  });
  const [loadingScores, setLoadingScores] = useState(false);
  const [stakingStatus, setStakingStatus] = useState<StakingScoreStatus | null>(null);
  const [startingScoreTracking, setStartingScoreTracking] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>('NotStarted');
  const [renouncingCitizenship, setRenouncingCitizenship] = useState(false);
  const [pezRewards, setPezRewards] = useState<PezRewardInfo | null>(null);
  const [isRecordingScore, setIsRecordingScore] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [nftDetails, setNftDetails] = useState<{ citizenNFT: TikiNFTDetails | null; roleNFTs: TikiNFTDetails[]; totalNFTs: number }>({
    citizenNFT: null,
    roleNFTs: [],
    totalNFTs: 0
  });

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) console.error('Profile fetch error:', error);
        return;
      }

      // Auto-sync user metadata from Auth to profiles if missing
      if (data) {
        const needsUpdate: Record<string, string> = {};

        // Sync full_name from Auth metadata if not set in profiles
        if (!data.full_name && user.user_metadata?.full_name) {
          needsUpdate.full_name = user.user_metadata.full_name;
        }

        // Sync phone from Auth metadata if not set in profiles
        if (!data.phone_number && user.user_metadata?.phone) {
          needsUpdate.phone_number = user.user_metadata.phone;
        }

        // Sync email if not set
        if (!data.email && user.email) {
          needsUpdate.email = user.email;
        }

        // If there are fields to update, update the profile
        if (Object.keys(needsUpdate).length > 0) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update(needsUpdate)
            .eq('id', user.id);

          if (!updateError) {
            // Update local state
            Object.assign(data, needsUpdate);
          }
        }
      }

      // Note: Email verification is handled by Supabase Auth (user.email_confirmed_at)
      // We don&apos;t store it in profiles table to avoid duplication

      setProfile(data);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchScoresAndTikis = useCallback(async () => {

    if (!selectedAccount || !api || !peopleApi) return;

    setLoadingScores(true);
    try {
      // Fetch all scores with frontend fallback (until runtime upgrade)
      // - Trust, referral, tiki: People Chain (on-chain)
      // - Staking: Relay Chain with frontend fallback
      const allScores = await getAllScores(peopleApi, selectedAccount.address);
      setScores(allScores);

      // Fetch staking score tracking status (People Chain - uses cached staking data from Asset Hub)
      const stakingStatusResult = await getStakingScoreStatus(peopleApi, selectedAccount.address);
      setStakingStatus(stakingStatusResult);

      // Fetch tikis from People Chain (tiki pallet is on People Chain)
      const userTikis = await fetchUserTikis(peopleApi, selectedAccount.address);
      setTikis(userTikis);

      // Fetch NFT details from People Chain
      const details = await getAllTikiNFTDetails(peopleApi, selectedAccount.address);
      setNftDetails(details);

      // Fetch KYC status from People Chain (identityKyc pallet is on People Chain)
      const kycStatusResult = await getKycStatus(peopleApi, selectedAccount.address);
      setKycStatus(kycStatusResult);

      // Fetch PEZ rewards from People Chain
      const rewards = await getPezRewards(peopleApi, selectedAccount.address);
      setPezRewards(rewards);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching scores and tikis:', error);
    } finally {
      setLoadingScores(false);
    }
  }, [selectedAccount, api, peopleApi]);

  const handleStartScoreTracking = async () => {
    if (!peopleApi || !selectedAccount) {
      toast({
        title: t('common.error'),
        description: t('dashboard.connectWalletError'),
        variant: "destructive"
      });
      return;
    }

    setStartingScoreTracking(true);
    try {
      const injector = await web3FromAddress(selectedAccount.address);
      // startScoreTracking on People Chain - staking data comes from Asset Hub via XCM
      const result = await startScoreTracking(peopleApi, selectedAccount.address, injector.signer);

      if (result.success) {
        toast({
          title: t('common.success'),
          description: t('dashboard.scoreTrackingStarted')
        });
        // Refresh scores after starting tracking
        fetchScoresAndTikis();
      } else {
        toast({
          title: t('common.error'),
          description: result.error || t('dashboard.scoreTrackingFailed'),
          variant: "destructive"
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error starting score tracking:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('dashboard.scoreTrackingFailed'),
        variant: "destructive"
      });
    } finally {
      setStartingScoreTracking(false);
    }
  };

  const handleRecordTrustScore = async () => {
    if (!peopleApi || !selectedAccount) return;

    setIsRecordingScore(true);
    try {
      const injector = await web3FromAddress(selectedAccount.address);
      const result = await recordTrustScore(peopleApi, selectedAccount.address, injector.signer);

      if (result.success) {
        toast({ title: t('common.success'), description: t('dashboard.trustScoreRecorded') });
        fetchScoresAndTikis();
      } else {
        toast({ title: t('common.error'), description: result.error || t('dashboard.trustScoreRecordFailed'), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('common.error'), description: error instanceof Error ? error.message : t('dashboard.trustScoreRecordFailed'), variant: "destructive" });
    } finally {
      setIsRecordingScore(false);
    }
  };

  const handleClaimReward = async (epochIndex: number) => {
    if (!peopleApi || !selectedAccount) return;

    setIsClaimingReward(true);
    try {
      const injector = await web3FromAddress(selectedAccount.address);
      const result = await claimPezReward(peopleApi, selectedAccount.address, epochIndex, injector.signer);

      if (result.success) {
        const rewardInfo = pezRewards?.claimableRewards.find(r => r.epoch === epochIndex);
        toast({ title: t('common.success'), description: t('dashboard.rewardClaimed', { amount: rewardInfo?.amount || '0' }) });
        fetchScoresAndTikis();
      } else {
        toast({ title: t('common.error'), description: result.error || t('dashboard.rewardClaimFailed'), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('common.error'), description: error instanceof Error ? error.message : t('dashboard.rewardClaimFailed'), variant: "destructive" });
    } finally {
      setIsClaimingReward(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    if (selectedAccount && api && isApiReady && peopleApi && isPeopleReady) {
      fetchScoresAndTikis();
    }
  }, [user, selectedAccount, api, isApiReady, peopleApi, isPeopleReady, fetchProfile, fetchScoresAndTikis]);

  const sendVerificationEmail = async () => {
    if (!user?.email) {
      toast({
        title: t('common.error'),
        description: t('dashboard.noEmailFound'),
        variant: "destructive"
      });
      return;
    }

    if (import.meta.env.DEV) console.log('🔄 Attempting to send verification email to:', user.email);
    if (import.meta.env.DEV) console.log('🔐 User object:', user);

    try {
      // Method 1: Try resend API
      if (import.meta.env.DEV) console.log('📧 Trying Supabase auth.resend()...');
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (resendError) {
        if (import.meta.env.DEV) console.error('❌ Resend error:', resendError);
      } else {
        if (import.meta.env.DEV) console.log('✅ Resend successful');
      }

      // If resend fails, try alternative method
      if (resendError) {
        if (import.meta.env.DEV) console.warn('Resend failed, trying alternative method:', resendError);

        // Method 2: Request password reset as verification alternative
        // This will send an email if the account exists
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/email-verification`,
        });

        if (resetError) throw resetError;
      }

      toast({
        title: t('dashboard.verificationEmailSent'),
        description: t('dashboard.checkInboxAndSpam'),
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error sending verification email:', error);

      // Provide more detailed error message
      let errorMessage = t('dashboard.failedToSendEmail');

      if (error.message?.includes('Email rate limit exceeded')) {
        errorMessage = t('dashboard.rateLimitExceeded');
      } else if (error.message?.includes('User not found')) {
        errorMessage = t('dashboard.accountNotFound');
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleRenounceCitizenship = async () => {
    if (!api || !selectedAccount) {
      toast({
        title: t('common.error'),
        description: t('dashboard.connectWalletError'),
        variant: "destructive"
      });
      return;
    }

    if (kycStatus !== 'Approved') {
      toast({
        title: t('common.error'),
        description: t('dashboard.renounceOnlyCitizens'),
        variant: "destructive"
      });
      return;
    }

    // Confirm action
    const confirmed = window.confirm(t('dashboard.renounceConfirmMsg'));

    if (!confirmed) return;

    setRenouncingCitizenship(true);
    try {
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(selectedAccount.address);

      if (import.meta.env.DEV) console.log('Renouncing citizenship...');

      const tx = api.tx.identityKyc.renounceCitizenship();

      await tx.signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          let errorMessage = 'Transaction failed';
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
          } else {
            errorMessage = dispatchError.toString();
          }
          if (import.meta.env.DEV) console.error(errorMessage);
          toast({
            title: t('dashboard.renounceFailed'),
            description: errorMessage,
            variant: "destructive"
          });
          setRenouncingCitizenship(false);
          return;
        }

        if (status.isInBlock || status.isFinalized) {
          if (import.meta.env.DEV) console.log('✅ Citizenship renounced successfully');

          // Check for CitizenshipRenounced event
          events.forEach(({ event }) => {
            if (event.section === 'identityKyc' && event.method === 'CitizenshipRenounced') {
              if (import.meta.env.DEV) console.log('📢 CitizenshipRenounced event detected');
              toast({
                title: t('dashboard.citizenshipRenounced'),
                description: t('dashboard.renounceSuccess')
              });

              // Refresh data after a short delay
              setTimeout(() => {
                fetchScoresAndTikis();
     
     
              }, 2000);
            }
          });

          setRenouncingCitizenship(false);
        }
      });

    } catch (err) {
      if (import.meta.env.DEV) console.error('Renunciation error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to renounce citizenship';
      toast({
        title: t('common.error'),
        description: errorMsg,
        variant: "destructive"
      });
      setRenouncingCitizenship(false);
    }
  };

  const getRoleDisplay = (): string => {
    if (loadingScores) return t('dashboard.loading');
    if (!selectedAccount) return 'Member';
    if (tikis.length === 0) return 'Member';

    const primaryRole = getPrimaryRole(tikis);
    return getTikiDisplayName(primaryRole);
  };

  const getRoleCategories = (): string[] => {
    if (tikis.length === 0) return ['Member'];
    return getUserRoleCategories(tikis);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl relative">
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.accountStatus')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.email_confirmed_at || profile?.email_verified ? (
                <Badge className="bg-green-500">{t('dashboard.verified')}</Badge>
              ) : (
                <Badge variant="destructive">{t('dashboard.unverified')}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.email_confirmed_at
                ? t('dashboard.verifiedOn', { date: new Date(user.email_confirmed_at).toLocaleDateString() })
                : t('dashboard.emailVerificationStatus')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.memberSince')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(profile?.joined_at || user?.created_at).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.registrationDate')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.role')}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getRoleDisplay()}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedAccount ? t('dashboard.fromTikiNfts') : t('dashboard.connectWalletForRoles')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalScore')}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingScores ? '...' : scores.totalScore}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.combinedScores')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.trustScore')}</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {loadingScores ? '...' : scores.trustScore}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.frontendCalc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.referralScore')}</CardTitle>
            <Users className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {loadingScores ? '...' : scores.referralScore}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.fromReferral')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stakingScore')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loadingScores ? '...' : scores.stakingScore}
            </div>
            {stakingStatus?.isTracking ? (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.tracking', { duration: formatDuration(stakingStatus.durationBlocks) })}
              </p>
            ) : selectedAccount ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={handleStartScoreTracking}
                disabled={startingScoreTracking || loadingScores}
              >
                {startingScoreTracking ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t('dashboard.starting')}
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    {t('dashboard.startTracking')}
                  </>
                )}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.connectToTrack')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.tikiScore')}</CardTitle>
            <Award className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-600">
              {loadingScores ? '...' : scores.tikiScore}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.rolesAssigned', { count: tikis.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PEZ Rewards Card - only show when pallet is available */}
      {selectedAccount && pezRewards && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.pezRewards')}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={
                pezRewards.epochStatus === 'Open'
                  ? 'bg-green-500'
                  : pezRewards.epochStatus === 'ClaimPeriod'
                  ? 'bg-orange-500'
                  : 'bg-gray-500'
              }>
                {pezRewards.epochStatus === 'Open' ? t('dashboard.epochOpen') : pezRewards.epochStatus === 'ClaimPeriod' ? t('dashboard.epochClaim') : t('dashboard.epochClosed')}
              </Badge>
              <Coins className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{t('dashboard.epoch', { number: pezRewards.currentEpoch })}</p>

                {/* Open epoch: Record score or show recorded score */}
                {pezRewards.epochStatus === 'Open' && (
                  pezRewards.hasRecordedThisEpoch ? (
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-green-600">Score: {pezRewards.userScoreCurrentEpoch}</div>
                      <Badge variant="outline" className="text-green-600 border-green-300">{t('dashboard.recorded')}</Badge>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleRecordTrustScore}
                      disabled={isRecordingScore || loadingScores}
                    >
                      {isRecordingScore ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {t('dashboard.recording')}
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          {t('dashboard.recordTrustScore')}
                        </>
                      )}
                    </Button>
                  )
                )}

                {/* Claimable rewards */}
                {pezRewards.hasPendingClaim ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-orange-600">
                      {parseFloat(pezRewards.totalClaimable).toFixed(2)} PEZ
                    </div>
                    {pezRewards.claimableRewards.map((reward) => (
                      <div key={reward.epoch} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('dashboard.epoch', { number: reward.epoch })}: {reward.amount} PEZ</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClaimReward(reward.epoch)}
                          disabled={isClaimingReward}
                          className="h-6 text-xs px-2"
                        >
                          {isClaimingReward ? '...' : t('dashboard.claim')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  !pezRewards.hasRecordedThisEpoch && pezRewards.epochStatus !== 'Open' && (
                    <div className="text-2xl font-bold text-muted-foreground">0 PEZ</div>
                  )
                )}
              </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 sm:px-3">{t('dashboard.profileTab')}</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs sm:text-sm px-2 sm:px-3">{t('dashboard.rolesTab')}</TabsTrigger>
          <TabsTrigger value="referrals" className="text-xs sm:text-sm px-2 sm:px-3">{t('dashboard.referralsTab')}</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm px-2 sm:px-3">{t('dashboard.securityTab')}</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm px-2 sm:px-3">{t('dashboard.activityTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.profileInfo')}</CardTitle>
              <CardDescription>{t('dashboard.personalDetails')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.fullName')}</span>
                  <span>{profile?.full_name || t('dashboard.notSet')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.emailLabel')}</span>
                  <span>{user?.email}</span>
                  {user?.email_confirmed_at || profile?.email_verified ? (
                    <Badge className="bg-green-500">{t('dashboard.verified')}</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={sendVerificationEmail}>
                      {t('dashboard.verifyEmail')}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.recoveryEmail')}</span>
                  <span>{profile?.recovery_email || t('dashboard.notSet')}</span>
                  {profile?.recovery_email_verified && profile?.recovery_email && (
                    <Badge className="bg-green-500">{t('dashboard.verified')}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.phone')}</span>
                  <span>{profile?.phone_number || t('dashboard.notSet')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.website')}</span>
                  <span>{profile?.website || t('dashboard.notSet')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t('dashboard.location')}</span>
                  <span>{profile?.location || t('dashboard.notSet')}</span>
                </div>
              </div>
              <Button onClick={() => navigate('/profile/settings')}>{t('dashboard.editProfile')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.rolesTitle')}</CardTitle>
              <CardDescription>
                {selectedAccount
                  ? t('dashboard.rolesFromBlockchain')
                  : t('dashboard.connectWalletToView')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedAccount && (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {t('dashboard.connectWalletMsg')}
                  </p>
                  <Button onClick={() => navigate('/')}>
                    {t('dashboard.goHomeToConnect')}
                  </Button>
                </div>
              )}

              {selectedAccount && loadingScores && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t('dashboard.loadingRoles')}</p>
                </div>
              )}

              {selectedAccount && !loadingScores && tikis.length === 0 && (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {t('dashboard.noRolesYet')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.completeKyc')}
                  </p>
                </div>
              )}

              {selectedAccount && !loadingScores && tikis.length > 0 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('dashboard.primaryRole')}</span>
                      <Badge className="text-lg">
                        {getTikiEmoji(getPrimaryRole(tikis))} {getTikiDisplayName(getPrimaryRole(tikis))}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('dashboard.totalScore')}:</span>
                      <span className="text-lg font-bold text-purple-600">{scores.totalScore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('dashboard.categories')}</span>
                      <span className="text-muted-foreground">{getRoleCategories().join(', ')}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">{t('dashboard.allRoles', { count: tikis.length })}</h4>
                    <div className="flex flex-wrap gap-2">
                      {tikis.map((tiki, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className={getTikiColor(tiki)}
                        >
                          {getTikiEmoji(tiki)} {getTikiDisplayName(tiki)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {nftDetails.totalNFTs > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">{t('dashboard.nftDetails', { count: nftDetails.totalNFTs })}</h4>
                      <div className="space-y-3">
                        {nftDetails.citizenNFT && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-blue-900 dark:text-blue-100">
                                {nftDetails.citizenNFT.tikiEmoji} {t('dashboard.citizenNft')}
                              </span>
                              <Badge variant="outline" className="text-blue-700 border-blue-300">
                                {t('dashboard.primary')}
                              </Badge>
                            </div>

                            {/* NFT Number and Citizen Number - Side by Side */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {/* NFT Number */}
                              <div className="p-2 bg-white dark:bg-blue-950 rounded border border-blue-300 dark:border-blue-700">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('dashboard.nftNumber')}</span>
                                <div className="font-mono text-lg font-bold text-blue-900 dark:text-blue-100">
                                  #{nftDetails.citizenNFT.collectionId}-{nftDetails.citizenNFT.itemId}
                                </div>
                              </div>

                              {/* Citizen Number = NFT Number + 6 digits */}
                              <div className="p-2 bg-white dark:bg-green-950 rounded border border-green-300 dark:border-green-700">
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">{t('dashboard.citizenNumberLabel')}</span>
                                <div className="font-mono text-lg font-bold text-green-900 dark:text-green-100">
                                  #{nftDetails.citizenNFT.collectionId}-{nftDetails.citizenNFT.itemId}-{generateCitizenNumber(
                                    nftDetails.citizenNFT.owner,
                                    nftDetails.citizenNFT.collectionId,
                                    nftDetails.citizenNFT.itemId
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-blue-700 dark:text-blue-300 font-medium">{t('dashboard.collectionId')}</span>
                                <span className="ml-2 font-mono text-blue-900 dark:text-blue-100">
                                  {nftDetails.citizenNFT.collectionId}
                                </span>
                              </div>
                              <div>
                                <span className="text-blue-700 dark:text-blue-300 font-medium">{t('dashboard.itemId')}</span>
                                <span className="ml-2 font-mono text-blue-900 dark:text-blue-100">
                                  {nftDetails.citizenNFT.itemId}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-blue-700 dark:text-blue-300 font-medium">{t('dashboard.roleLabel')}</span>
                                <span className="ml-2 text-blue-900 dark:text-blue-100">
                                  {nftDetails.citizenNFT.tikiDisplayName}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-blue-700 dark:text-blue-300 font-medium">{t('dashboard.tikiType')}</span>
                                <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
                                  {nftDetails.citizenNFT.tikiRole}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {nftDetails.roleNFTs.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground font-medium">{t('dashboard.additionalRoleNfts')}</p>
                            {nftDetails.roleNFTs.map((nft, /*index*/) => (
                              <div
                                key={`${nft.collectionId}-${nft.itemId}`}
                                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">
                                    {nft.tikiEmoji} {nft.tikiDisplayName}
                                  </span>
                                  <Badge variant="outline" className={nft.tikiColor}>
                                    Score: {nft.tikiScore}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div>
                                    <span className="font-medium">{t('dashboard.collection')}</span>
                                    <span className="ml-2 font-mono">{nft.collectionId}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">{t('dashboard.item')}</span>
                                    <span className="ml-2 font-mono">{nft.itemId}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="font-medium">{t('dashboard.tikiType')}</span>
                                    <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">{nft.tikiRole}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 className="font-medium mb-2">{t('dashboard.blockchainAddress')}</h4>
                    <p className="text-sm text-muted-foreground font-mono break-all">
                      {selectedAccount.address}
                    </p>
                  </div>

                  {kycStatus === 'Approved' && (
                    <div className="border-t pt-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <h4 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <UserMinus className="h-4 w-4" />
                          {t('dashboard.renounceCitizenship')}
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                          {t('dashboard.renounceDesc')}
                        </p>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 mb-3 list-disc list-inside space-y-1">
                          <li>{t('dashboard.renounceBurn')}</li>
                          <li>{t('dashboard.renounceReset')}</li>
                          <li>{t('dashboard.renounceRemove')}</li>
                        </ul>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">
                          {t('dashboard.renounceNote')}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRenounceCitizenship}
                          disabled={renouncingCitizenship}
                        >
                          {renouncingCitizenship ? t('dashboard.renouncing') : t('dashboard.renounceBtn')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <ReferralDashboard />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.securitySettings')}</CardTitle>
              <CardDescription>{t('dashboard.manageAccountSecurity')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">{t('dashboard.password')}</h3>
                <p className="text-sm text-muted-foreground">{t('dashboard.lastChanged')}</p>
                <Button onClick={() => navigate('/reset-password')}>{t('dashboard.changePassword')}</Button>
              </div>
              
              {!user?.email_confirmed_at && !profile?.email_verified && (
                <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 text-gray-900">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-gray-900">{t('dashboard.verifyYourEmail')}</h4>
                      <p className="text-sm text-gray-900">{t('dashboard.verifyEmailMsg')}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
              <CardDescription>{t('dashboard.recentActivityDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('dashboard.noRecentActivity')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}