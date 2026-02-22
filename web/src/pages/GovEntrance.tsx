import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/contexts/DashboardContext';
import {
  ArrowLeft,
  Vote,
  Users,
  FileText,
  Scale,
  Megaphone,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function GovEntrance() {
  // usePezkuwi removed
  const { nftDetails, kycStatus, loading: dashboardLoading } = useDashboard();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGovernmentRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftDetails, dashboardLoading]);
     

  const checkGovernmentRole = () => {
    if (dashboardLoading) {
      setLoading(true);
      return;
    }

    // Check if user has government role NFT
    const hasGovernmentRole = nftDetails.roleNFTs.some(nft => {
      // Check if NFT is a government role (collection 42, items 10-99 are government roles)
      return nft.collectionId === 42 && nft.itemId >= 10 && nft.itemId < 100;
    });

    if (!hasGovernmentRole) {
      toast({
        title: t('govEntrance.noAccess'),
        description: t('govEntrance.noAccessMessage'),
        variant: "destructive"
      });
      navigate('/citizens');
      return;
    }

    setLoading(false);
  };

  const handleFeatureClick = (feature: string) => {
    toast({
      title: t('govEntrance.underDevelopment'),
      description: t('govEntrance.underDevelopmentMessage', { feature }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="text-gray-700 font-medium">{t('govEntrance.loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show government portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            onClick={() => navigate('/citizens')}
            variant="outline"
            className="bg-red-600 hover:bg-red-700 border-yellow-400 border-2 text-white font-semibold shadow-lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('govEntrance.backToCitizens')}
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-red-700 mb-3 drop-shadow-lg">
            🏛️ {t('govEntrance.title')}
          </h1>
          <p className="text-xl text-gray-800 font-semibold drop-shadow-md mb-2">
            {t('govEntrance.subtitle')}
          </p>
          <p className="text-base text-gray-700">
            {t('govEntrance.description')}
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* 1. Elections - Hilbijartinên (Elections) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-blue-400 hover:border-blue-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.elections.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Vote className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                  {t('govEntrance.active')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-blue-800">{t('govEntrance.elections.title')}</CardTitle>
              <CardDescription className="text-gray-600">{t('govEntrance.elections.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.elections.presidential')}</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.elections.parliamentary')}</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.elections.speaker')}</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.elections.constitutional')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 2. Candidacy - Berjewendî (Candidacy) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-green-400 hover:border-green-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.candidacy.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  {t('govEntrance.candidacy.badge')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-green-800">{t('govEntrance.candidacy.title')}</CardTitle>
              <CardDescription className="text-gray-600"></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.candidacy.presidential')}</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.candidacy.parliamentary')}</span>
                </li>
                <li className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-yellow-700">{t('govEntrance.candidacy.trustScore')}</span>
                </li>
                <li className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-yellow-700">{t('govEntrance.candidacy.endorsements')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Proposals - Pêşniyar (Legislative Proposals) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-purple-400 hover:border-purple-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.proposals.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-purple-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                  {t('govEntrance.proposals.badge')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-purple-800">{t('govEntrance.proposals.title')}</CardTitle>
              <CardDescription className="text-gray-600"></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <FileText className="h-4 w-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.proposals.legislative')}</span>
                </li>
                <li className="flex items-start">
                  <FileText className="h-4 w-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.proposals.constitutional')}</span>
                </li>
                <li className="flex items-start">
                  <FileText className="h-4 w-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.proposals.budget')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Voting on Proposals - Dengdayîn (Vote on Proposals) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-orange-400 hover:border-orange-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.voting.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                  {t('govEntrance.voting.badge')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-orange-800">{t('govEntrance.voting.title')}</CardTitle>
              <CardDescription className="text-gray-600"></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.voting.aye')}</span>
                </li>
                <li className="flex items-start">
                  <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.voting.nay')}</span>
                </li>
                <li className="flex items-start">
                  <Clock className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.voting.abstain')}</span>
                </li>
                <li className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-blue-700">{t('govEntrance.voting.majorityTypes')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 5. Veto & Override - Veto û Têperbûn (Veto System) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-red-400 hover:border-red-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.veto.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-red-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Scale className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                  {t('govEntrance.veto.badge')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-red-800">{t('govEntrance.veto.title')}</CardTitle>
              <CardDescription className="text-gray-600"></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.veto.presidential')}</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.veto.override')}</span>
                </li>
                <li className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-yellow-700">{t('govEntrance.veto.requires')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 6. Government Appointments - Tayinên Hikûmetê (Official Appointments) */}
          <Card
            className="bg-white/95 backdrop-blur border-2 border-indigo-400 hover:border-indigo-600 transition-all shadow-xl cursor-pointer group hover:scale-105"
            onClick={() => handleFeatureClick(t('govEntrance.appointments.title'))}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-indigo-500 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Megaphone className="h-8 w-8 text-white" />
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300">
                  {t('govEntrance.appointments.badge')}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-indigo-800">{t('govEntrance.appointments.title')}</CardTitle>
              <CardDescription className="text-gray-600"></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.appointments.cabinet')}</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{t('govEntrance.appointments.officials')}</span>
                </li>
                <li className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-yellow-700">{t('govEntrance.appointments.approval')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview */}
        <Card className="bg-gradient-to-r from-green-50 to-red-50 border-2 border-yellow-400 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-800 flex items-center">
              <AlertCircle className="h-6 w-6 text-yellow-600 mr-2" />
              {t('govEntrance.status.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">{t('govEntrance.status.kyc')}</p>
                <div className="flex items-center">
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {kycStatus}
                  </Badge>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">{t('govEntrance.status.votingRights')}</p>
                <div className="flex items-center">
                  <Badge className="bg-blue-500 text-white">
                    <Vote className="h-3 w-3 mr-1" />
                    {t('govEntrance.status.active')}
                  </Badge>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600 mb-1">{t('govEntrance.status.participation')}</p>
                <div className="flex items-center">
                  <Badge className="bg-purple-500 text-white">
                    <Users className="h-3 w-3 mr-1" />
                    {t('govEntrance.status.ready')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {t('govEntrance.status.notice')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
