import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { supabase } from '@/lib/supabase';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PezkuwiWalletButton } from './PezkuwiWalletButton';
import NotificationBell from './notifications/NotificationBell';
import { fetchUserTikis, getPrimaryRole, getTikiDisplayName, getTikiEmoji } from '@pezkuwi/lib/tiki';
import { getAllScores, type UserScores } from '@pezkuwi/lib/scores';
import { getKycStatus } from '@pezkuwi/lib/kyc';

// Avatar pool (same as mobile)
const AVATAR_POOL = [
  { id: 'avatar1', emoji: '👨🏻' }, { id: 'avatar2', emoji: '👨🏼' },
  { id: 'avatar3', emoji: '👨🏽' }, { id: 'avatar4', emoji: '👨🏾' },
  { id: 'avatar5', emoji: '👩🏻' }, { id: 'avatar6', emoji: '👩🏼' },
  { id: 'avatar7', emoji: '👩🏽' }, { id: 'avatar8', emoji: '👩🏾' },
  { id: 'avatar9', emoji: '🧔🏻' }, { id: 'avatar10', emoji: '🧔🏼' },
  { id: 'avatar11', emoji: '🧔🏽' }, { id: 'avatar12', emoji: '🧔🏾' },
  { id: 'avatar13', emoji: '👳🏻‍♂️' }, { id: 'avatar14', emoji: '👳🏼‍♂️' },
  { id: 'avatar15', emoji: '👳🏽‍♂️' }, { id: 'avatar16', emoji: '🧕🏻' },
  { id: 'avatar17', emoji: '🧕🏼' }, { id: 'avatar18', emoji: '🧕🏽' },
];

const getEmojiFromAvatarId = (avatarId: string): string => {
  const avatar = AVATAR_POOL.find(a => a.id === avatarId);
  return avatar ? avatar.emoji : '👤';
};

// App icon definition
interface AppItem {
  title: string;
  icon: string;
  route: string;
  comingSoon?: boolean;
  requiresAuth?: boolean;
}

// Section definition
interface AppSection {
  titleKey: string;
  emoji: string;
  borderColor: string;
  apps: AppItem[];
}

const APP_SECTIONS: AppSection[] = [
  {
    titleKey: 'mobile.section.finance',
    emoji: '💰',
    borderColor: 'border-l-green-500',
    apps: [
      { title: 'mobile.app.wallet', icon: '👛', route: '/wallet' },
      { title: 'mobile.app.bank', icon: '🏦', route: '/finance/bank' },
      { title: 'mobile.app.exchange', icon: '💱', route: '/dex', requiresAuth: true },
      { title: 'mobile.app.p2p', icon: '🤝', route: '/p2p', requiresAuth: true },
      { title: 'mobile.app.b2b', icon: '🤖', route: '/bereketli', requiresAuth: true },
      { title: 'mobile.app.bacZekat', icon: '💰', route: '/finance/zekat' },
      { title: 'mobile.app.launchpad', icon: '🚀', route: '/launchpad' },
    ],
  },
  {
    titleKey: 'mobile.section.governance',
    emoji: '🏛️',
    borderColor: 'border-l-red-500',
    apps: [
      { title: 'mobile.app.president', icon: '👑', route: '/elections', requiresAuth: true },
      { title: 'mobile.app.assembly', icon: '🏛️', route: '/governance/assembly' },
      { title: 'mobile.app.vote', icon: '🗳️', route: '/elections', requiresAuth: true },
      { title: 'mobile.app.validators', icon: '🛡️', route: '/wallet' },
      { title: 'mobile.app.justice', icon: '⚖️', route: '/governance/justice' },
      { title: 'mobile.app.proposals', icon: '📜', route: '/citizens/government' },
      { title: 'mobile.app.polls', icon: '📊', route: '/governance/polls' },
      { title: 'mobile.app.identity', icon: '🆔', route: '/identity' },
    ],
  },
  {
    titleKey: 'mobile.section.social',
    emoji: '💬',
    borderColor: 'border-l-blue-500',
    apps: [
      { title: 'mobile.app.whatsKurd', icon: '💬', route: '/social/whatskurd' },
      { title: 'mobile.app.forum', icon: '📰', route: '/forum' },
      { title: 'mobile.app.kurdMedia', icon: '📺', route: '/social/kurdmedia' },
      { title: 'mobile.app.events', icon: '📅', route: '/forum', comingSoon: true },
      { title: 'mobile.app.help', icon: '❓', route: '/help' },
      { title: 'mobile.app.music', icon: '🎵', route: '/forum', comingSoon: true },
      { title: 'mobile.app.vpn', icon: '🛡️', route: '/forum', comingSoon: true },
      { title: 'mobile.app.referral', icon: '👥', route: '/dashboard', requiresAuth: true },
    ],
  },
  {
    titleKey: 'mobile.section.education',
    emoji: '📚',
    borderColor: 'border-l-yellow-500',
    apps: [
      { title: 'mobile.app.university', icon: '🎓', route: '/education/university' },
      { title: 'mobile.app.perwerde', icon: '📖', route: '/education', requiresAuth: true },
      { title: 'mobile.app.certificates', icon: '🏆', route: '/education/certificates' },
      { title: 'mobile.app.research', icon: '🔬', route: '/education/research' },
    ],
  },
];

const MobileHomeLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();

  // Profile state
  const [profileData, setProfileData] = useState<{
    full_name?: string | null;
    avatar_url?: string | null;
    created_at?: string;
  } | null>(null);

  // Blockchain state
  const [tikis, setTikis] = useState<string[]>([]);
  const [scores, setScores] = useState<UserScores>({
    trustScore: 0, referralScore: 0, stakingScore: 0, tikiScore: 0, totalScore: 0,
  });
  const [kycStatus, setKycStatus] = useState<string>('NotStarted');
  const [loadingScores, setLoadingScores] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setProfileData(data);
    } catch { /* profile fetch is best-effort */ }
  }, [user]);

  const fetchBlockchainData = useCallback(async () => {
    if (!selectedAccount || !peopleApi || !isPeopleReady) return;
    setLoadingScores(true);
    try {
      const [userTikis, allScores, status] = await Promise.all([
        fetchUserTikis(peopleApi, selectedAccount.address),
        getAllScores(peopleApi, selectedAccount.address),
        getKycStatus(peopleApi, selectedAccount.address),
      ]);
      setTikis(userTikis);
      setScores(allScores);
      setKycStatus(status);
    } catch { /* blockchain fetch is best-effort */ }
    finally { setLoadingScores(false); }
  }, [selectedAccount, peopleApi, isPeopleReady]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => {
    if (selectedAccount && peopleApi && isPeopleReady) fetchBlockchainData();
  }, [fetchBlockchainData, selectedAccount, peopleApi, isPeopleReady]);

  const primaryRole = tikis.length > 0 ? getPrimaryRole(tikis) : 'Visitor';
  const displayName = profileData?.full_name || user?.email?.split('@')[0] || 'Heval';
  const memberSince = profileData?.created_at
    ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : user?.created_at
      ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'N/A';

  const avatarEmoji = profileData?.avatar_url && !profileData.avatar_url.startsWith('http')
    ? getEmojiFromAvatarId(profileData.avatar_url)
    : '👤';

  const currentTab = location.pathname === '/be-citizen' ? 'citizen'
    : location.pathname === '/dashboard' ? 'referral'
    : 'home';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col pb-16">
      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 px-4 pt-3 pb-4 rounded-b-2xl shadow-lg">
        <div className="flex items-center justify-between">
          {/* Left: Avatar + Greeting */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              {profileData?.avatar_url?.startsWith('http') ? (
                <img
                  src={profileData.avatar_url}
                  alt="avatar"
                  className="w-11 h-11 rounded-full border-2 border-white/80 object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full border-2 border-white/80 bg-green-800 flex items-center justify-center text-2xl">
                  {avatarEmoji}
                </div>
              )}
              {/* Online dot */}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-green-700" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">
                {t('mobile.greeting', 'Rojbaş')}, {displayName}
              </p>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white/90 font-medium">
                {getTikiEmoji(primaryRole)} {getTikiDisplayName(primaryRole)}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <LanguageSwitcher />
            <PezkuwiWalletButton />
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-4">

        {/* ── SCORE CARDS (horizontal scroll) ── */}
        <div className="-mx-3 px-3">
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {/* Card 1: Member Since + Logout OR Login/Sign Up */}
            {user ? (
              <ScoreCard icon="📅" label={t('mobile.memberSince', 'Member Since')} value={memberSince} color="border-l-green-500"
                action={{ label: `🚪 ${t('nav.logout', 'Logout')}`, onClick: async () => { await signOut(); navigate('/'); } }} />
            ) : (
              <ScoreCard
                icon="🔑"
                label={t('mobile.joinUs', 'Join Us')}
                value={t('nav.login', 'Login')}
                color="border-l-green-500"
                action={{ label: t('mobile.signInUp', 'Sign In / Up'), onClick: () => navigate('/login') }}
              />
            )}
            {/* Role - always visible, shows Visitor for guests */}
            <ScoreCard icon={getTikiEmoji(primaryRole)} label={t('mobile.role', 'Role')} value={getTikiDisplayName(primaryRole)}
              sub={!user ? t('mobile.loginToSeeRoles', 'Login to see roles') : selectedAccount ? `${tikis.length} ${tikis.length === 1 ? 'role' : 'roles'}` : t('mobile.connectWallet', 'Connect wallet')}
              color="border-l-orange-500" />
            {/* Total Score */}
            <ScoreCard icon="🏆" label={t('mobile.totalScore', 'Total Score')}
              value={!user ? '—' : loadingScores ? '...' : String(scores.totalScore)}
              color="border-l-purple-500"
              action={!user ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') } : undefined} />
            {/* Trust Score */}
            <ScoreCard icon="🛡️" label={t('mobile.trustScore', 'Trust Score')}
              value={!user ? '—' : loadingScores ? '...' : String(scores.trustScore)}
              color="border-l-purple-500"
              action={!user ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') } : undefined} />
            {/* Referral Score */}
            <ScoreCard icon="👥" label={t('mobile.referralScore', 'Referral Score')}
              value={!user ? '—' : loadingScores ? '...' : String(scores.referralScore)}
              color="border-l-cyan-500"
              action={!user ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') } : undefined} />
            {/* Staking Score */}
            <ScoreCard icon="📈" label={t('mobile.stakingScore', 'Staking Score')}
              value={!user ? '—' : loadingScores ? '...' : String(scores.stakingScore)}
              color="border-l-green-500"
              action={!user ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') } : undefined} />
            {/* Tiki Score */}
            <ScoreCard icon="⭐" label={t('mobile.tikiScore', 'Tiki Score')}
              value={!user ? '—' : loadingScores ? '...' : String(scores.tikiScore)}
              color="border-l-pink-500"
              action={!user ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') } : undefined} />
            {/* KYC Status */}
            <ScoreCard
              icon={!user ? '📝' : kycStatus === 'Approved' ? '✅' : kycStatus === 'Pending' ? '⏳' : '📝'}
              label={t('mobile.kycStatus', 'KYC Status')}
              value={!user ? '—' : kycStatus}
              color={kycStatus === 'Approved' ? 'border-l-green-500' : 'border-l-yellow-500'}
              action={!user
                ? { label: t('nav.login', 'Login'), onClick: () => navigate('/login') }
                : kycStatus === 'NotStarted'
                  ? { label: t('mobile.apply', 'Apply'), onClick: () => navigate('/be-citizen') }
                  : undefined}
            />
          </div>
        </div>

        {/* ── APP SECTIONS ── */}
        {APP_SECTIONS.map((section) => (
          <div key={section.titleKey} className="bg-gray-900/60 rounded-xl border border-gray-800/60 overflow-hidden">
            {/* Section header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-l-4 ${section.borderColor}`}>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {t(section.titleKey)} {section.emoji}
              </h3>
            </div>
            {/* App grid - 4 per row */}
            <div className="grid grid-cols-4 gap-1 px-3 py-3">
              {section.apps.map((app) => {
                const needsLogin = app.requiresAuth && !user;
                return (
                  <button
                    key={app.title}
                    onClick={() => {
                      if (app.comingSoon) return;
                      if (needsLogin) { navigate('/login'); return; }
                      navigate(app.route);
                    }}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all active:scale-95
                      ${app.comingSoon ? 'opacity-50' : 'hover:bg-gray-800/60'}`}
                  >
                    <div className="relative">
                      <span className="text-2xl">{app.icon}</span>
                      {app.comingSoon && (
                        <span className="absolute -top-1 -right-2 text-[10px]">🔒</span>
                      )}
                      {needsLogin && !app.comingSoon && (
                        <span className="absolute -top-1 -right-2 text-[10px]">🔑</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium text-center leading-tight">
                      {t(app.title)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bottom spacing for tab bar */}
        <div className="h-4" />
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-md border-t border-gray-800">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          <TabButton
            icon="🏠"
            label={t('mobile.home', 'Home')}
            active={currentTab === 'home'}
            onClick={() => navigate('/')}
          />
          <TabButton
            icon="🏛️"
            label={t('mobile.citizen', 'Citizen')}
            active={currentTab === 'citizen'}
            onClick={() => navigate('/be-citizen')}
            accent
          />
          <TabButton
            icon="👥"
            label={t('mobile.referral', 'Referral')}
            active={currentTab === 'referral'}
            onClick={() => navigate(user ? '/dashboard' : '/login')}
          />
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

function ScoreCard({ icon, label, value, sub, color, action }: {
  icon: string; label: string; value: string; sub?: string; color: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`flex-shrink-0 w-28 bg-gray-900/80 rounded-xl border border-gray-800/60 border-l-4 ${color} p-3 space-y-1`}>
      <span className="text-lg">{icon}</span>
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-white truncate">{value}</p>
      {sub && <p className="text-[9px] text-gray-500">{sub}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-full font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function TabButton({ icon, label, active, onClick, accent }: {
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

export default MobileHomeLayout;
