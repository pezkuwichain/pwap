import { useState, useEffect } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Smartphone, Download, Clock, CheckCircle2, ExternalLink,
  Shield, FileText, Wifi, ChevronDown, ChevronUp, AlertCircle,
  Github, Star, Package, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppVersion {
  version: string;
  releaseDate: Date;
  downloadUrl: string;
  size: string;
  changelog: string[];
  isLatest?: boolean;
  minAndroidVersion?: string;
  downloads?: number;
}

// Mock versions - will be replaced with GitHub API
const appVersions: AppVersion[] = [
  {
    version: '1.2.0',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.2.0/pezwallet-v1.2.0.apk',
    size: '45.2 MB',
    isLatest: true,
    minAndroidVersion: '7.0',
    downloads: 1234,
    changelog: [
      'Yeni: Telegram Mini App entegrasyonu',
      'Yeni: Geliştirilmiş staking arayüzü',
      'Düzeltme: Bakiye yenileme sorunları',
      'Düzeltme: İşlem geçmişi yüklemesi',
      'İyileştirme: Genel performans',
    ],
  },
  {
    version: '1.1.2',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.1.2/pezwallet-v1.1.2.apk',
    size: '44.8 MB',
    minAndroidVersion: '7.0',
    downloads: 856,
    changelog: [
      'Düzeltme: Kritik güvenlik güncellemesi',
      'Düzeltme: Cüzdan bağlantı kararlılığı',
      'İyileştirme: İşlem imzalama',
    ],
  },
  {
    version: '1.1.0',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.1.0/pezwallet-v1.1.0.apk',
    size: '44.5 MB',
    minAndroidVersion: '7.0',
    downloads: 2341,
    changelog: [
      'Yeni: Çoklu dil desteği',
      'Yeni: Geliştirilmiş karanlık tema',
      'Yeni: QR kod tarama',
      'Düzeltme: Çeşitli hata düzeltmeleri',
    ],
  },
];

const features = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Güvenli Cüzdan',
    description: 'Anahtarlarınız, kriptonuz. Tam self-custody.',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Vatandaşlık Yönetimi',
    description: 'Vatandaşlık başvurusu ve Tiki yönetimi.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
  },
  {
    icon: <Wifi className="w-5 h-5" />,
    title: 'Çevrimdışı Destek',
    description: 'Bakiye ve geçmişi çevrimdışı görüntüleyin.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
  },
];

function VersionCard({
  version,
  isExpanded,
  onToggle,
  onDownload,
  isDownloading
}: {
  version: AppVersion;
  isExpanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className={cn(
      "bg-gray-900 border-gray-800 overflow-hidden",
      version.isLatest && "border-green-500/50"
    )}>
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              version.isLatest ? "bg-green-500" : "bg-gray-800"
            )}>
              {version.isLatest ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <Package className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">v{version.version}</span>
                {version.isLatest && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                    En Son
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                <span>{formatDate(version.releaseDate)}</span>
                <span>•</span>
                <span>{version.size}</span>
                {version.downloads && (
                  <>
                    <span>•</span>
                    <span>{version.downloads.toLocaleString()} indirme</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-800">
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                Değişiklikler
              </h4>
              <ul className="space-y-2">
                {version.changelog.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-500 mt-1.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>

              {version.minAndroidVersion && (
                <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Android {version.minAndroidVersion} veya üstü gerekli
                </div>
              )}

              <Button
                onClick={onDownload}
                disabled={isDownloading}
                className={cn(
                  "w-full mt-4",
                  version.isLatest
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-700 hover:bg-gray-600"
                )}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    İndiriliyor...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    v{version.version} İndir
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function APKSection() {
  const { hapticImpact, openLink, showConfirm } = useTelegram();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(appVersions[0]?.version || null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (version: AppVersion) => {
    hapticImpact('medium');

    const confirmed = await showConfirm(
      `Pezwallet v${version.version} (${version.size}) indirilsin mi?`
    );

    if (confirmed) {
      setDownloading(version.version);
      openLink(version.downloadUrl);
      setTimeout(() => setDownloading(null), 3000);
    }
  };

  const handleOpenGitHub = () => {
    hapticImpact('light');
    openLink('https://github.com/pezkuwichain/pezwallet/releases');
  };

  const latestVersion = appVersions.find(v => v.isLatest);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950">
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-500" />
            Pezwallet APK
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenGitHub}
            className="h-8 w-8"
          >
            <Github className="w-4 h-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pt-0 space-y-4">
        {/* App Banner */}
        <Card className="bg-gradient-to-br from-green-600 to-emerald-700 border-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* App Icon */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl font-bold text-white">P</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">Pezwallet</h3>
                <p className="text-green-100 text-sm mb-3">
                  Pezkuwichain için resmi cüzdan uygulaması
                </p>
                {latestVersion && (
                  <Button
                    onClick={() => handleDownload(latestVersion)}
                    disabled={downloading === latestVersion.version}
                    className="bg-white text-green-700 hover:bg-green-50"
                  >
                    {downloading === latestVersion.version ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        İndiriliyor...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        v{latestVersion.version} İndir
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Özellikler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  feature.bgColor, feature.color
                )}>
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm">{feature.title}</h4>
                  <p className="text-gray-400 text-xs">{feature.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Installation Guide */}
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            <span className="font-medium text-yellow-500 block mb-2">Kurulum Rehberi</span>
            <ol className="text-xs space-y-1 list-decimal list-inside text-yellow-200/80">
              <li>APK dosyasını indirin</li>
              <li>Cihaz Ayarlarını açın</li>
              <li>"Bilinmeyen kaynaklardan yükleme"yi etkinleştirin</li>
              <li>İndirilen APK dosyasını açın</li>
              <li>Kurulum talimatlarını izleyin</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Version History */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Sürüm Geçmişi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appVersions.map((version) => (
              <VersionCard
                key={version.version}
                version={version}
                isExpanded={expandedVersion === version.version}
                onToggle={() => setExpandedVersion(
                  expandedVersion === version.version ? null : version.version
                )}
                onDownload={() => handleDownload(version)}
                isDownloading={downloading === version.version}
              />
            ))}
          </CardContent>
        </Card>

        {/* Footer note */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-500">
            Daima resmi kaynaklardan indirdiğinizi doğrulayın
          </p>
          <Button
            variant="link"
            onClick={handleOpenGitHub}
            className="text-green-500 text-xs mt-1"
          >
            <Github className="w-3 h-3 mr-1" />
            GitHub'da tüm sürümleri görüntüle
          </Button>
        </div>
      </div>
    </div>
  );
}

export default APKSection;
