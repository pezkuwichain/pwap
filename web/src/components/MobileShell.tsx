import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MobileShellProps {
  title: string;
  children: React.ReactNode;
  /** Hide header gradient bar (e.g. when page has its own header) */
  hideHeader?: boolean;
}

/**
 * Shared mobile wrapper: compact header with back button + sticky bottom tab bar.
 * Used by all mobile-specific pages (Citizen, Referral, etc.)
 */
const MobileShell: React.FC<MobileShellProps> = ({ title, children, hideHeader }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const currentTab = location.pathname === '/be-citizen' ? 'citizen'
    : location.pathname === '/dashboard' ? 'referral'
    : 'home';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col pb-16">
      {/* ── HEADER ── */}
      {!hideHeader && (
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-4 py-3 flex items-center gap-3 shadow-md">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg bg-white/15 active:bg-white/25 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-bold text-white truncate">{title}</h1>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-md border-t border-gray-800">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          <TabBtn icon="🏠" label={t('mobile.home', 'Home')} active={currentTab === 'home'} onClick={() => navigate('/')} />
          <TabBtn icon="🏛️" label={t('mobile.citizen', 'Citizen')} active={currentTab === 'citizen'} onClick={() => navigate('/be-citizen')} accent />
          <TabBtn icon="👥" label={t('mobile.referral', 'Referral')} active={currentTab === 'referral'}
            onClick={() => navigate(user ? '/dashboard' : '/login')} />
        </div>
      </div>
    </div>
  );
};

function TabBtn({ icon, label, active, onClick, accent }: {
  icon: string; label: string; active: boolean; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all active:scale-95
        ${active ? 'text-green-400' : 'text-gray-500'}
        ${accent ? 'relative' : ''}`}
    >
      {accent ? (
        <div className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-lg
          ${active ? 'bg-green-600' : 'bg-gray-800 border border-gray-700'}`}>
          <span className="text-xl">{icon}</span>
        </div>
      ) : (
        <span className="text-xl">{icon}</span>
      )}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default MobileShell;
