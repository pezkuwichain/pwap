import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface MediaChannel {
  id: string;
  nameKu: string;
  name: string;
  icon: string;
  descriptionKu: string;
  description: string;
  color: string;
}

interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  url: string;
  color: string;
}

const MEDIA_CHANNELS: MediaChannel[] = [
  { id: 'dkstv',     nameKu: 'DKS TV',          name: 'DKS TV',          icon: '📺', descriptionKu: 'Televizyona Dewleta Dijîtal a Kurdistanê', description: 'Digital Kurdistan State Television', color: '#E53935' },
  { id: 'dksgzt',    nameKu: 'DKS Rojname',      name: 'DKS Gazette',     icon: '📰', descriptionKu: 'Nûçe û Daxuyaniyên Fermî',               description: 'Official News & Announcements',      color: '#1E88E5' },
  { id: 'dksradio',  nameKu: 'DKS Radyo',        name: 'DKS Radio',       icon: '📻', descriptionKu: 'Radyoya Dewleta Dijîtal a Kurdistanê',    description: 'Digital Kurdistan State Radio',       color: '#7B1FA2' },
  { id: 'dksmusic',  nameKu: 'DKS Muzîk',        name: 'DKS Music',       icon: '🎵', descriptionKu: 'Weşana Muzîka Kurdî',                    description: 'Kurdish Music Streaming',             color: '#00897B' },
  { id: 'dkspodcast',nameKu: 'DKS Podcast',      name: 'DKS Podcast',     icon: '🎙️', descriptionKu: 'Podcast û Gotûbêjên Kurdî',             description: 'Kurdish Podcasts & Talks',            color: '#F4511E' },
  { id: 'dksdocs',   nameKu: 'DKS Belgefîlm',   name: 'DKS Docs',        icon: '🎬', descriptionKu: 'Belgefîlm û Fîlim',                      description: 'Documentaries & Films',               color: '#6D4C41' },
];

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: 'telegram', name: 'Telegram', icon: '✈️', url: 'https://t.me/pezkuwichain',                                       color: '#0088CC' },
  { id: 'discord',  name: 'Discord',  icon: '💬', url: 'https://discord.gg/Y3VyEC6h8W',                                   color: '#5865F2' },
  { id: 'twitter',  name: 'X',        icon: '🐦', url: 'https://twitter.com/pezkuwichain',                                 color: '#1DA1F2' },
  { id: 'facebook', name: 'Facebook', icon: '📘', url: 'https://www.facebook.com/profile.php?id=61582484611719',           color: '#1877F2' },
  { id: 'medium',   name: 'Medium',   icon: '📝', url: 'https://medium.com/@pezkuwichain',                                 color: '#555555' },
  { id: 'github',   name: 'GitHub',   icon: '💻', url: 'https://github.com/pezkuwichain',                                  color: '#333333' },
];

export default function KurdMediaPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('mobile.section.social', 'Social')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">📡</span>
          <h1 className="text-2xl font-bold">{t('kurdMedia.title', 'KurdMedia')}</h1>
          <p className="text-white/70 text-sm mt-0.5">{t('kurdMedia.subtitle', 'Kurdish Digital Media')}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">

        {/* Media Channels */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📺</div>
            <div>
              <h2 className="font-bold text-white">{t('kurdMedia.channels.title', 'Medyaya Kurdî')}</h2>
              <p className="text-xs text-gray-400">{t('kurdMedia.channels.subtitle', 'Kurdish Media')}</p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-sm text-gray-300 mb-1">{t('kurdMedia.channels.desc', 'Weşanên fermî yên Dewleta Dijîtal a Kurdistanê.')}</p>
            <p className="text-xs text-gray-500 mb-4">{t('kurdMedia.channels.descEn', 'Official broadcasts of Digital Kurdistan State. TV, radio, news and more.')}</p>
            <div className="space-y-3">
              {MEDIA_CHANNELS.map(ch => (
                <div key={ch.id} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: ch.color }}>
                    {ch.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{ch.nameKu}</p>
                    <p className="text-xs text-gray-400 truncate">{ch.descriptionKu}</p>
                  </div>
                  <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full flex-shrink-0">
                    {t('kurdMedia.soon', 'Soon')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social Platforms */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🤝</div>
            <div>
              <h2 className="font-bold text-white">{t('kurdMedia.social.title', 'Piştgirî PezkuwiChain')}</h2>
              <p className="text-xs text-gray-400">{t('kurdMedia.social.subtitle', 'Support PezkuwiChain')}</p>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-sm text-gray-300 mb-1">{t('kurdMedia.social.desc', 'Bi me re têkildar bin li ser platformên civakî.')}</p>
            <p className="text-xs text-gray-500 mb-4">{t('kurdMedia.social.descEn', 'Connect with us on social platforms. Ask questions, follow news and join our community.')}</p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {SOCIAL_PLATFORMS.map(p => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: p.color }}>
                    {p.icon}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{p.name}</span>
                </a>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-0 bg-gray-800 rounded-xl overflow-hidden">
              {[
                { val: '40M+', label: t('kurdMedia.stats.kurds', 'Kurd li cîhanê') },
                { val: '5B',   label: 'PEZ Total' },
                { val: '∞',    label: t('kurdMedia.stats.hope', 'Hêvî / Hope') },
              ].map((s, i) => (
                <div key={i} className={`py-4 text-center ${i > 0 ? 'border-l border-gray-700' : ''}`}>
                  <p className="text-xl font-bold text-red-400">{s.val}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-green-900/20 border-l-4 border-green-600 rounded-xl p-4 flex gap-3">
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <p className="text-sm text-green-300 font-medium">{t('kurdMedia.banner', 'PezkuwiChain - Blockchain\'a yekem a netewî ya Kurdan')}</p>
            <p className="text-xs text-green-500 mt-1">{t('kurdMedia.bannerEn', 'PezkuwiChain - The first national blockchain of the Kurds')}</p>
          </div>
        </div>
      </div>
      <div className="h-10" />
    </div>
  );
}
