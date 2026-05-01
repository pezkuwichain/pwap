import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { supabase } from '@/lib/supabase';
import { fetchUserTikis, getPrimaryRole, getTikiDisplayName, getTikiEmoji, getCitizenNFTDetails, generateCitizenNumber } from '@pezkuwi/lib/tiki';
import { getAllScores, type UserScores } from '@pezkuwi/lib/scores';
import { getKycStatus } from '@pezkuwi/lib/kyc';
import LandingPageDesktop from './landing/LandingPageDesktop';
import { LanguageSwitcher } from './LanguageSwitcher';
import NotificationBell from './notifications/NotificationBell';
import ProposalWizard from './proposals/ProposalWizard';
import DelegationManager from './delegation/DelegationManager';
import { ForumOverview } from './forum/ForumOverview';
import { ModerationPanel } from './forum/ModerationPanel';
import { TreasuryOverview } from './treasury/TreasuryOverview';
import { FundingProposal } from './treasury/FundingProposal';
import { SpendingHistory } from './treasury/SpendingHistory';
import { MultiSigApproval } from './treasury/MultiSigApproval';
import {
  ExternalLink, FileEdit, Users2, MessageSquare, Wifi, WifiOff,
  Wallet, DollarSign, PiggyBank, History, Key, TrendingUp,
  ArrowRightLeft, Lock, LogIn, LayoutDashboard, Settings, Users,
  Droplet, Mail, Coins, Menu, X, ChevronDown,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { StakingDashboard } from './staking/StakingDashboard';
import { MultiSigWallet } from './wallet/MultiSigWallet';
import { useWallet } from '@/contexts/WalletContext';
import { PezkuwiWalletButton } from './PezkuwiWalletButton';
import { DEXDashboard } from './dex/DEXDashboard';
import { P2PDashboard } from './p2p/P2PDashboard';
import EducationPlatform from '../pages/EducationPlatform';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileHomeLayout from './MobileHomeLayout';

// ── Avatar pool ──
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
const getEmojiFromAvatarId = (id: string) =>
  AVATAR_POOL.find(a => a.id === id)?.emoji ?? '👤';

// ── App sections (mirrors MobileHomeLayout) ──
interface AppItem {
  title: string; icon: string; imgIcon?: string;
  route: string; href?: string; comingSoon?: boolean; requiresAuth?: boolean;
}
interface AppSection { titleKey: string; emoji: string; borderColor: string; apps: AppItem[]; }

const APP_SECTIONS: AppSection[] = [
  {
    titleKey: 'mobile.section.finance', emoji: '💰', borderColor: 'border-l-green-500',
    apps: [
      { title: 'mobile.app.wallet',    icon: '👛', route: '/wallet' },
      { title: 'mobile.app.bank',      icon: '🏦', route: '/finance/bank' },
      { title: 'mobile.app.exchange',  icon: '💱', imgIcon: '/PezkuwiExchange.png', route: '/dex', href: 'https://pex.network' },
      { title: 'mobile.app.dex',       icon: '🔄', route: '/dex',       requiresAuth: true },
      { title: 'mobile.app.p2p',       icon: '🤝', route: '/p2p',       requiresAuth: true },
      { title: 'mobile.app.b2b',       icon: '🤖', route: '/bereketli', requiresAuth: true },
      { title: 'mobile.app.bacZekat',  icon: '💰', route: '/finance/zekat' },
      { title: 'mobile.app.launchpad', icon: '🚀', route: '/launchpad' },
    ],
  },
  {
    titleKey: 'mobile.section.governance', emoji: '🏛️', borderColor: 'border-l-red-500',
    apps: [
      { title: 'mobile.app.president', icon: '👑', route: '/elections',           requiresAuth: true },
      { title: 'mobile.app.assembly',  icon: '🏛️', route: '/governance/assembly' },
      { title: 'mobile.app.vote',      icon: '🗳️', route: '/elections',           requiresAuth: true },
      { title: 'mobile.app.validators',icon: '🛡️', route: '/wallet' },
      { title: 'mobile.app.justice',   icon: '⚖️', route: '/governance/justice' },
      { title: 'mobile.app.proposals', icon: '📜', route: '/citizens/government' },
      { title: 'mobile.app.polls',     icon: '📊', route: '/governance/polls' },
      { title: 'mobile.app.identity',  icon: '🆔', route: '/identity' },
    ],
  },
  {
    titleKey: 'mobile.section.social', emoji: '💬', borderColor: 'border-l-blue-500',
    apps: [
      { title: 'mobile.app.whatsKurd', icon: '💬', route: '/social/whatskurd' },
      { title: 'mobile.app.forum',     icon: '📰', route: '/forum' },
      { title: 'mobile.app.kurdMedia', icon: '📺', route: '/social/kurdmedia' },
      { title: 'mobile.app.events',    icon: '📅', route: '/forum',     comingSoon: true },
      { title: 'mobile.app.help',      icon: '❓', route: '/help' },
      { title: 'mobile.app.music',     icon: '🎵', route: '/forum',     comingSoon: true },
      { title: 'mobile.app.rewshenbir',icon: '📡', imgIcon: '/rewshenbir-icon.png', route: '/rewshenbir', href: 'https://rewshenbir.pezkuwi.app' },
      { title: 'mobile.app.referral',  icon: '👥', route: '/dashboard', requiresAuth: true },
    ],
  },
  {
    titleKey: 'mobile.section.education', emoji: '📚', borderColor: 'border-l-yellow-500',
    apps: [
      { title: 'mobile.app.university',   icon: '🎓', route: '/education/university' },
      { title: 'mobile.app.perwerde',     icon: '📖', route: '/education', requiresAuth: true },
      { title: 'mobile.app.certificates', icon: '🏆', route: '/education/certificates' },
      { title: 'mobile.app.research',     icon: '🔬', route: '/education/research' },
    ],
  },
];

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();
  const [showProposalWizard, setShowProposalWizard] = useState(false);
  const [showDelegation, setShowDelegation] = useState(false);
  const [showForum, setShowForum] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showTreasury, setShowTreasury] = useState(false);
  const [treasuryTab, setTreasuryTab] = useState('overview');
  const [showStaking, setShowStaking] = useState(false);
  const [showMultiSig, setShowMultiSig] = useState(false);
  const [showDEX, setShowDEX] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [showP2P, setShowP2P] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const { t } = useTranslation();
  const { isConnected } = useWebSocket();
  useWallet();
  const isMobile = useIsMobile();
  const [, _setIsAdmin] = useState(false);

  // Score / profile state for desktop home
  const [profileData, setProfileData] = useState<{
    full_name?: string | null; avatar_url?: string | null; created_at?: string;
  } | null>(null);
  const [tikis, setTikis] = useState<string[]>([]);
  const [scores, setScores] = useState<UserScores>({
    trustScore: 0, referralScore: 0, stakingScore: 0, tikiScore: 0, totalScore: 0,
  });
  const [kycStatus, setKycStatus] = useState<string>('NotStarted');
  const [citizenId, setCitizenId] = useState<string | null>(null);
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  React.useEffect(() => { _setIsAdmin(false); }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) setProfileData(data);
    } catch { /* best-effort */ }
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
      if (userTikis.includes('Welati')) {
        const nft = await getCitizenNFTDetails(peopleApi, selectedAccount.address);
        if (nft) {
          const sixDigit = generateCitizenNumber(selectedAccount.address, nft.collectionId, nft.itemId);
          setCitizenId(`#${nft.collectionId}-${nft.itemId}-${sixDigit}`);
        }
      }
    } catch { /* best-effort */ }
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
    ? getEmojiFromAvatarId(profileData.avatar_url) : '👤';

  const isFeaturePanelOpen = showDEX || showProposalWizard || showDelegation || showForum
    || showModeration || showTreasury || showStaking || showMultiSig || showEducation || showP2P;

  const currentTab = location.pathname === '/be-citizen' ? 'citizen'
    : location.pathname === '/dashboard' ? 'referral'
    : 'home';

  if (isMobile && !isFeaturePanelOpen) return <MobileHomeLayout />;
  if (!user) return <LandingPageDesktop />;

  // Desktop click handler — maps routes to panel opens where applicable
  const getAppClickHandler = (app: AppItem) => {
    if (app.comingSoon) return () => {};
    if (app.requiresAuth && !user) return () => navigate('/login');
    if (app.href) return () => window.open(app.href, '_blank', 'noopener,noreferrer');
    switch (app.route) {
      case '/dex': return () => setShowDEX(true);
      case '/p2p': return () => { setShowP2P(true); navigate('/p2p'); };
      default:     return () => navigate(app.route);
    }
  };

  // Extra items added to the governance card on desktop
  const govExtras = [
    { title: 'governance.delegation', icon: '🤝', onAction: () => setShowDelegation(true) },
    { title: 'nav.forum',             icon: '📰', onAction: () => setShowForum(true) },
    { title: 'nav.treasury',          icon: '💰', onAction: () => { setShowTreasury(true); setTreasuryTab('overview'); } },
    { title: 'nav.moderation',        icon: '🛡️', onAction: () => setShowModeration(true) },
  ];

  const closeAllPanels = () => {
    setShowDEX(false); setShowProposalWizard(false); setShowDelegation(false);
    setShowForum(false); setShowModeration(false); setShowTreasury(false);
    setShowStaking(false); setShowMultiSig(false); setShowEducation(false); setShowP2P(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── NAVIGATION ── */}
      <nav ref={navRef} className="fixed top-0 w-full z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex-shrink-0 hidden lg:block">
              <span className="text-lg font-bold bg-gradient-to-r from-green-500 to-yellow-400 bg-clip-text text-transparent whitespace-nowrap">
                PezkuwiChain
              </span>
            </div>

            {/* Mobile: Language + Wallet + Hamburger */}
            <div className="flex lg:hidden items-center gap-2 ml-auto">
              <LanguageSwitcher />
              <PezkuwiWalletButton />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Desktop: right-side actions */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-3 flex-1 justify-end ml-4 min-w-0">
              <a href="/docs" className="text-gray-300 hover:text-white transition-colors text-sm whitespace-nowrap">
                {t('nav.docs')}
              </a>

              {/* Trading header dropdown (Presale / Staking / MultiSig) */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'hdr-trading' ? null : 'hdr-trading'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/70 border border-red-500/30 text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-red-400" />
                  {t('nav.trading')}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {openMenu === 'hdr-trading' && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                    <button onClick={() => { navigate('/presale'); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-t-lg text-sm">
                      <Coins className="w-4 h-4 text-yellow-400" /> {t('trading.presale')}
                    </button>
                    <button onClick={() => { setShowStaking(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-400" /> {t('trading.staking')}
                    </button>
                    <button onClick={() => { setShowMultiSig(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-b-lg text-sm">
                      <Lock className="w-4 h-4 text-purple-400" /> {t('trading.multiSig')}
                    </button>
                  </div>
                )}
              </div>

              <div className="w-px h-6 bg-gray-700" />

              <div className="flex items-center">
                {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
              </div>
              <NotificationBell />
              <LanguageSwitcher />
              <button
                onClick={() => navigate('/profile/settings')}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title={t('nav.settings')}
              >
                <Settings className="w-4 h-4" />
              </button>
              <PezkuwiWalletButton />
              <button
                onClick={async () => { await signOut(); navigate('/login'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-500/40 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors text-sm whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 rotate-180" />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── MOBILE MENU PANEL ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-16 right-0 bottom-0 w-64 sm:w-72 bg-gray-900 border-l border-gray-800 overflow-y-auto">
            <div className="p-4 space-y-2">
              {user ? (
                <>
                  <button onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5" /> {t('nav.dashboard')}
                  </button>
                  <button onClick={() => { navigate('/wallet'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <Wallet className="w-5 h-5" /> {t('nav.wallet')}
                  </button>
                  <button onClick={() => { navigate('/message'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-purple-400 hover:bg-gray-800 flex items-center gap-3">
                    <MessageSquare className="w-5 h-5" /> {t('nav.message')}
                  </button>
                  <button onClick={() => { navigate('/citizens'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-cyan-400 hover:bg-gray-800 flex items-center gap-3">
                    <Users className="w-5 h-5" /> {t('nav.citizensPortal')}
                  </button>
                  <button onClick={() => { navigate('/be-citizen'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-cyan-300 hover:bg-gray-800 flex items-center gap-3">
                    <Users className="w-5 h-5" /> {t('nav.beCitizen')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">{t('nav.governance')}</div>
                  <button onClick={() => { setShowProposalWizard(true); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <FileEdit className="w-5 h-5" /> {t('governance.proposals')}
                  </button>
                  <button onClick={() => { setShowDelegation(true); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <Users2 className="w-5 h-5" /> {t('governance.delegation')}
                  </button>
                  <button onClick={() => { setShowTreasury(true); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <PiggyBank className="w-5 h-5" /> {t('nav.treasury')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">{t('nav.trading')}</div>
                  <button onClick={() => { setShowDEX(true); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <Droplet className="w-5 h-5" /> {t('trading.dexPools')}
                  </button>
                  <button onClick={() => { navigate('/p2p'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <ArrowRightLeft className="w-5 h-5" /> {t('trading.p2p')}
                  </button>
                  <button onClick={() => { navigate('/presale'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <Coins className="w-5 h-5" /> {t('trading.presale')}
                  </button>
                  <button onClick={() => { setShowStaking(true); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <TrendingUp className="w-5 h-5" /> {t('trading.staking')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <button onClick={() => { navigate('/profile/settings'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                    <Settings className="w-5 h-5" /> {t('nav.settings')}
                  </button>
                  <button onClick={async () => { await signOut(); navigate('/login'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-red-400 hover:bg-gray-800 flex items-center gap-3">
                    <LogIn className="w-5 h-5 rotate-180" /> {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { navigate('/be-citizen'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-cyan-300 hover:bg-gray-800 flex items-center gap-3">
                    <Users className="w-5 h-5" /> {t('nav.beCitizen')}
                  </button>
                  <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-3">
                    <LogIn className="w-5 h-5" /> {t('nav.login')}
                  </button>
                </>
              )}
              <div className="border-t border-gray-800 my-2" />
              <a href="/docs" onClick={() => setMobileMenuOpen(false)} className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3">
                <ExternalLink className="w-5 h-5" /> {t('nav.docs')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main>
        {showDEX ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4"><DEXDashboard /></div>
          </div>
        ) : showProposalWizard ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <ProposalWizard
                onComplete={(p) => { if (import.meta.env.DEV) console.log('Proposal:', p); setShowProposalWizard(false); }}
                onCancel={() => setShowProposalWizard(false)}
              />
            </div>
          </div>
        ) : showDelegation ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4"><DelegationManager /></div>
          </div>
        ) : showForum ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4"><ForumOverview /></div>
          </div>
        ) : showModeration ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4"><ModerationPanel /></div>
          </div>
        ) : showTreasury ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">
                  {t('treasury.title', 'Treasury Management')}
                </h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                  {t('treasury.subtitle', 'Track funds, submit proposals, and manage community resources')}
                </p>
              </div>
              <Tabs value={treasuryTab} onValueChange={setTreasuryTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                  <TabsTrigger value="overview"  className="flex items-center gap-2"><PiggyBank className="w-4 h-4" />{t('treasury.overview',   'Overview')}</TabsTrigger>
                  <TabsTrigger value="proposals" className="flex items-center gap-2"><DollarSign className="w-4 h-4" />{t('treasury.proposals', 'Funding Proposals')}</TabsTrigger>
                  <TabsTrigger value="history"   className="flex items-center gap-2"><History className="w-4 h-4" />{t('treasury.history',     'Spending History')}</TabsTrigger>
                  <TabsTrigger value="approvals" className="flex items-center gap-2"><Key className="w-4 h-4" />{t('treasury.approvals',       'Multi-Sig Approvals')}</TabsTrigger>
                </TabsList>
                <TabsContent value="overview"  className="mt-6"><TreasuryOverview /></TabsContent>
                <TabsContent value="proposals" className="mt-6"><FundingProposal /></TabsContent>
                <TabsContent value="history"   className="mt-6"><SpendingHistory /></TabsContent>
                <TabsContent value="approvals" className="mt-6"><MultiSigApproval /></TabsContent>
              </Tabs>
            </div>
          </div>
        ) : showStaking ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">{t('staking.title')}</h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">{t('staking.subtitle')}</p>
              </div>
              <StakingDashboard />
            </div>
          </div>
        ) : showMultiSig ? (
          <div className="pt-20 min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">{t('multiSig.title')}</h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">{t('multiSig.subtitle')}</p>
              </div>
              <MultiSigWallet />
            </div>
          </div>
        ) : showEducation ? (
          <div className="pt-20 min-h-screen bg-gray-950"><EducationPlatform /></div>
        ) : showP2P ? (
          <div className="pt-20 min-h-screen bg-gray-950"><P2PDashboard /></div>
        ) : (
          /* ── LOGGED-IN DESKTOP HOME ── */
          <div className="pt-20 pb-20 min-h-screen bg-gray-950">
            <div className="max-w-7xl mx-auto px-4 py-6">

              {/* Greeting row */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-green-900 border-2 border-green-500/50 flex items-center justify-center text-2xl flex-shrink-0">
                  {avatarEmoji}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">
                    {t('mobile.greeting', 'Rojbaş')}, {displayName}
                  </p>
                  <span className="text-sm bg-gray-800 px-3 py-0.5 rounded-full text-gray-300">
                    {getTikiEmoji(primaryRole)} {getTikiDisplayName(primaryRole)}
                  </span>
                </div>
              </div>

              {/* Score cards (horizontal scroll) */}
              <div className="-mx-4 px-4 mb-8">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <DesktopScoreCard
                    icon="📅" label={t('mobile.memberSince', 'Member Since')} value={memberSince}
                    color="border-l-green-500" onClick={() => navigate('/dashboard')} />
                  <DesktopScoreCard
                    icon={getTikiEmoji(primaryRole)} label={t('mobile.role', 'Role')} value={getTikiDisplayName(primaryRole)}
                    sub={citizenId ?? (selectedAccount ? `${tikis.length} role(s)` : t('mobile.connectWallet', 'Connect wallet'))}
                    color="border-l-orange-500" />
                  <DesktopScoreCard
                    icon="🏆" label={t('mobile.totalScore', 'Total Score')}
                    value={loadingScores ? '...' : String(scores.totalScore)} color="border-l-purple-500" />
                  <DesktopScoreCard
                    icon="🛡️" label={t('mobile.trustScore', 'Trust Score')}
                    value={loadingScores ? '...' : String(scores.trustScore)} color="border-l-purple-500" />
                  <DesktopScoreCard
                    icon="👥" label={t('mobile.referralScore', 'Referral Score')}
                    value={loadingScores ? '...' : String(scores.referralScore)} color="border-l-cyan-500" />
                  <DesktopScoreCard
                    icon="📈" label={t('mobile.stakingScore', 'Staking Score')}
                    value={loadingScores ? '...' : String(scores.stakingScore)} color="border-l-green-500" />
                  <DesktopScoreCard
                    icon="⭐" label={t('mobile.tikiScore', 'Tiki Score')}
                    value={loadingScores ? '...' : String(scores.tikiScore)} color="border-l-pink-500" />
                  <DesktopScoreCard
                    icon={tikis.includes('Welati') ? '🌿' : kycStatus === 'Approved' ? '✅' : kycStatus === 'Pending' ? '⏳' : '📝'}
                    label={t('mobile.kycStatus', 'KYC Status')}
                    value={tikis.includes('Welati') ? 'Welati' : kycStatus}
                    color={tikis.includes('Welati') || kycStatus === 'Approved' ? 'border-l-green-500' : 'border-l-yellow-500'}
                    actionLabel={!tikis.includes('Welati') && kycStatus === 'NotStarted' ? t('mobile.apply', 'Apply') : undefined}
                    onClick={!tikis.includes('Welati') && kycStatus === 'NotStarted' ? () => navigate('/be-citizen') : undefined}
                  />
                </div>
              </div>

              {/* Section cards — 2-column grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {APP_SECTIONS.map((section, sectionIdx) => (
                  <div key={section.titleKey} className="bg-gray-900/60 rounded-2xl border border-gray-800/60 overflow-hidden">
                    <div className={`flex items-center px-5 py-3 border-l-4 ${section.borderColor} bg-gray-900/40`}>
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        {t(section.titleKey)} {section.emoji}
                      </h3>
                    </div>
                    <div className="grid grid-cols-4 gap-1 px-3 py-3">
                      {section.apps.map((app) => {
                        const needsLogin = app.requiresAuth && !user;
                        return (
                          <button
                            key={app.title}
                            onClick={getAppClickHandler(app)}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95
                              ${app.comingSoon ? 'opacity-50' : 'hover:bg-gray-800/60'}`}
                          >
                            <div className="relative">
                              {app.imgIcon ? (
                                <img src={app.imgIcon} alt={t(app.title)} className="w-9 h-9 object-contain rounded-xl" />
                              ) : (
                                <span className="text-3xl">{app.icon}</span>
                              )}
                              {app.comingSoon && <span className="absolute -top-1 -right-2 text-[10px]">🔒</span>}
                              {needsLogin && !app.comingSoon && <span className="absolute -top-1 -right-2 text-[10px]">🔑</span>}
                            </div>
                            <span className="text-[11px] text-gray-300 font-medium text-center leading-tight">
                              {t(app.title)}
                            </span>
                          </button>
                        );
                      })}
                      {/* Governance extras: Delegation / Forum / Treasury / Moderation */}
                      {sectionIdx === 1 && govExtras.map((ex) => (
                        <button
                          key={ex.title}
                          onClick={ex.onAction}
                          className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95 hover:bg-gray-800/60"
                        >
                          <span className="text-3xl">{ex.icon}</span>
                          <span className="text-[11px] text-gray-300 font-medium text-center leading-tight">
                            {t(ex.title)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Back-to-home button */}
        {isFeaturePanelOpen && (
          <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50">
            <button
              onClick={closeAllPanels}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 sm:px-6 sm:py-3 text-sm sm:text-base rounded-full shadow-lg flex items-center gap-2 transition-all"
            >
              {`← ${t('common.backToHome')}`}
            </button>
          </div>
        )}
      </main>

      {/* ── BOTTOM TAB BAR (mirrors MobileHomeLayout) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          <BottomTabBtn icon="🏠" label={t('mobile.home', 'Home')} active={currentTab === 'home'} onClick={() => navigate('/')} />
          <BottomTabBtn icon="🏛️" label={t('mobile.citizen', 'Citizen')} active={currentTab === 'citizen'} onClick={() => navigate('/be-citizen')} accent />
          <BottomTabBtn icon="👥" label={t('mobile.referral', 'Referral')} active={currentTab === 'referral'} onClick={() => navigate('/dashboard')} />
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 border-t border-gray-800 py-12 pb-28">
        <div className="max-w-full mx-auto px-4">
          <div className="mb-8 space-y-2 text-sm text-gray-400 text-center">
            <p className="flex items-center justify-center gap-2"><Mail className="w-4 h-4" />info@pezkuwichain.io</p>
            <p className="flex items-center justify-center gap-2"><Mail className="w-4 h-4" />info@pezkuwichain.app</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
            <div>
              <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-green-500 to-yellow-400 bg-clip-text text-transparent">PezkuwiChain</h3>
              <p className="text-gray-400 text-sm">{t('footer.platform')}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.about')}</h4>
              <ul className="space-y-2">
                <li><a href="https://raw.githubusercontent.com/pezkuwichain/DKSweb/main/public/Whitepaper.pdf" download="Pezkuwi_Whitepaper.pdf" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.whitepaper')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="https://github.com/pezkuwichain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.github')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.developers')}</h4>
              <ul className="space-y-2">
                <li><a href="/api" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.api')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="/developers" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.sdk')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.community')}</h4>
              <ul className="space-y-2">
                <li><a href="https://discord.gg/pezkuwichain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.discord')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="https://x.com/PezkuwiChain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.twitter')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="https://t.me/PezkuwiApp" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.telegram')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="https://www.youtube.com/@SatoshiQazi" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.youtube')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
                <li><a href="https://facebook.com/profile.php?id=61582484611719" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">{t('footer.facebook')}<ExternalLink className="w-3 h-3 ml-1" /></a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-400 text-sm">{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ── BottomTabBtn (identical to MobileHomeLayout's TabButton) ──
function BottomTabBtn({ icon, label, active, onClick, accent }: {
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

// ── DesktopScoreCard ──
function DesktopScoreCard({ icon, label, value, sub, color, onClick, actionLabel }: {
  icon: string; label: string; value: string; sub?: string; color: string;
  onClick?: () => void; actionLabel?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 w-36 bg-gray-900/80 rounded-xl border border-gray-800/60 border-l-4 ${color} p-3 space-y-1
        ${onClick ? 'cursor-pointer hover:bg-gray-800/60 transition-colors' : ''}`}
      onClick={onClick}
    >
      <span className="text-xl">{icon}</span>
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-white truncate">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 truncate">{sub}</p>}
      {actionLabel && (
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="mt-1 text-[11px] bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-full font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default AppLayout;
