import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HelpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    { icon: '❓', label: t('help.feature.faq', 'Frequently Asked Questions (FAQ)') },
    { icon: '💬', label: t('help.feature.live', 'Live Support') },
    { icon: '📖', label: t('help.feature.guides', 'User Guides') },
    { icon: '🤝', label: t('help.feature.community', 'Community Contact') },
  ];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('help.breadcrumb', 'Help & Support')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">🤝</span>
          <h1 className="text-2xl font-bold text-white">{t('help.title', 'Help & Support')}</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

        {/* Coming Soon Card */}
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
          <p className="text-base text-gray-600 leading-relaxed mb-2">
            {t('help.desc', 'Sîstema arîkariyê dê di demeke nêzîk de were destpêkirin.')}
          </p>
          <p className="text-sm text-gray-400">
            {t('help.descEn', 'The help and support system will be launched soon.')}
          </p>
        </div>

        {/* Planned Features */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-green-700 mb-3 text-sm">
            {t('help.planned.title', 'Taybetmendiyên Plankirin / Planned Features')}
          </h2>
          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-2xl flex-shrink-0">{f.icon}</span>
                <span className="text-sm text-gray-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact via WhatsKURD */}
        <div
          onClick={() => navigate('/social/whatskurd')}
          className="bg-green-700 text-white rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:opacity-80"
        >
          <span className="text-2xl">💬</span>
          <div>
            <p className="font-semibold text-sm">{t('help.whatskurd.title', 'WhatsKURD Messaging')}</p>
            <p className="text-xs text-white/70">{t('help.whatskurd.desc', 'Contact us via the blockchain messaging system')}</p>
          </div>
          <span className="ml-auto text-white/60">→</span>
        </div>

      </div>
      <div className="h-10" />
    </div>
  );
}
