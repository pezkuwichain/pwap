import { useState } from 'react';
import { Smartphone, Download, Clock, CheckCircle2, AlertCircle, ExternalLink, FileText, Shield } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { cn } from '@/lib/utils';

interface AppVersion {
  version: string;
  releaseDate: Date;
  downloadUrl: string;
  size: string;
  changelog: string[];
  isLatest?: boolean;
  minAndroidVersion?: string;
}

const appVersions: AppVersion[] = [
  {
    version: '1.2.0',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.2.0/pezwallet-v1.2.0.apk',
    size: '45.2 MB',
    isLatest: true,
    minAndroidVersion: '7.0',
    changelog: [
      'New: Telegram Mini App integration',
      'New: Improved staking interface',
      'Fix: Balance refresh issues',
      'Fix: Transaction history loading',
      'Improved: Overall performance',
    ],
  },
  {
    version: '1.1.2',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days ago
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.1.2/pezwallet-v1.1.2.apk',
    size: '44.8 MB',
    minAndroidVersion: '7.0',
    changelog: [
      'Fix: Critical security update',
      'Fix: Wallet connection stability',
      'Improved: Transaction signing',
    ],
  },
  {
    version: '1.1.0',
    releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    downloadUrl: 'https://github.com/pezkuwichain/pezwallet/releases/download/v1.1.0/pezwallet-v1.1.0.apk',
    size: '44.5 MB',
    minAndroidVersion: '7.0',
    changelog: [
      'New: Multi-language support',
      'New: Dark theme improvements',
      'New: QR code scanning',
      'Fix: Various bug fixes',
    ],
  },
];

const features = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Secure Wallet',
    description: 'Your keys, your crypto. Full self-custody.',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Citizenship Management',
    description: 'Apply for citizenship and manage your Tiki.',
  },
  {
    icon: <Download className="w-5 h-5" />,
    title: 'Offline Support',
    description: 'View balances and history offline.',
  },
];

export function APK() {
  const { hapticImpact, openLink, showConfirm } = useTelegram();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(appVersions[0]?.version || null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownload = async (version: AppVersion) => {
    hapticImpact('medium');

    const confirmed = await showConfirm(
      `Download Pezwallet v${version.version} (${version.size})?`
    );

    if (confirmed) {
      setDownloading(version.version);

      // Open download link
      openLink(version.downloadUrl);

      // Reset downloading state after a delay
      setTimeout(() => {
        setDownloading(null);
      }, 3000);
    }
  };

  const handleOpenGitHub = () => {
    hapticImpact('light');
    openLink('https://github.com/pezkuwichain/pezwallet/releases');
  };

  const latestVersion = appVersions.find(v => v.isLatest);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Pezwallet APK</h2>
        </div>
        <button
          onClick={handleOpenGitHub}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* App Banner */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-4">
          <div className="flex items-start gap-4">
            {/* App Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold text-white">P</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">Pezwallet</h3>
              <p className="text-green-100 text-sm mb-3">
                Official wallet app for Pezkuwichain
              </p>
              {latestVersion && (
                <button
                  onClick={() => handleDownload(latestVersion)}
                  disabled={downloading === latestVersion.version}
                  className="flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors disabled:opacity-70"
                >
                  {downloading === latestVersion.version ? (
                    <>
                      <span className="animate-pulse">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download v{latestVersion.version}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-lg p-3 flex items-start gap-3 border border-gray-700"
            >
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center text-green-500 flex-shrink-0">
                {feature.icon}
              </div>
              <div>
                <h4 className="text-white font-medium text-sm">{feature.title}</h4>
                <p className="text-gray-400 text-xs">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Installation Guide */}
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-500 font-medium text-sm mb-1">Installation Guide</h4>
              <ol className="text-yellow-200/80 text-xs space-y-1 list-decimal list-inside">
                <li>Download the APK file</li>
                <li>Open your device's Settings</li>
                <li>Enable "Install from unknown sources"</li>
                <li>Open the downloaded APK file</li>
                <li>Follow the installation prompts</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Version History */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-medium">Version History</h3>
          </div>

          <div className="divide-y divide-gray-700">
            {appVersions.map((version) => (
              <div key={version.version}>
                <button
                  onClick={() => setExpandedVersion(
                    expandedVersion === version.version ? null : version.version
                  )}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      version.isLatest ? 'bg-green-600' : 'bg-gray-700'
                    )}>
                      {version.isLatest ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">v{version.version}</span>
                        {version.isLatest && (
                          <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatDate(version.releaseDate)} • {version.size}
                      </div>
                    </div>
                  </div>
                  <Download
                    className={cn(
                      'w-5 h-5 transition-transform',
                      expandedVersion === version.version ? 'rotate-180' : ''
                    )}
                  />
                </button>

                {/* Expanded content */}
                {expandedVersion === version.version && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-white mb-2">Changelog</h4>
                      <ul className="space-y-1">
                        {version.changelog.map((item, idx) => (
                          <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>

                      {version.minAndroidVersion && (
                        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
                          Requires Android {version.minAndroidVersion} or higher
                        </div>
                      )}

                      <button
                        onClick={() => handleDownload(version)}
                        disabled={downloading === version.version}
                        className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition-colors disabled:opacity-70"
                      >
                        {downloading === version.version ? (
                          'Downloading...'
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download v{version.version}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-xs text-gray-500 pb-4">
          <p>Always verify downloads from official sources</p>
          <p className="mt-1">
            <button
              onClick={handleOpenGitHub}
              className="text-green-500 hover:text-green-400"
            >
              View all releases on GitHub
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default APK;
