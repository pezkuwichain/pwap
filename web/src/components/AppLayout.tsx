import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LandingPageDesktop from './landing/LandingPageDesktop';
import HeroSection from './HeroSection';
import TokenomicsSection from './TokenomicsSection';
import PalletsGrid from './PalletsGrid';
import ChainSpecs from './ChainSpecs';
import TrustScoreCalculator from './TrustScoreCalculator';
import { NetworkStats } from './NetworkStats';

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
import { ExternalLink, Award, FileEdit, Users2, MessageSquare, ShieldCheck, Wifi, WifiOff, Wallet, DollarSign, PiggyBank, History, Key, TrendingUp, ArrowRightLeft, Lock, LogIn, LayoutDashboard, Settings, Users, Droplet, Mail, Coins, Menu, X, ChevronDown } from 'lucide-react';
import GovernanceInterface from './GovernanceInterface';
import RewardDistribution from './RewardDistribution';
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

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
  const gridRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { isConnected } = useWebSocket();
  useWallet();
  const isMobile = useIsMobile();
  const [, _setIsAdmin] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenu]);

  // Admin status is handled by AuthContext via wallet whitelist
  // Supabase admin_roles is optional (table may not exist)
  React.useEffect(() => {
    _setIsAdmin(false); // Admin status managed by AuthContext
  }, [user]);
  // On mobile, when no feature panel is active, show the mobile home layout
  const isFeaturePanelOpen = showDEX || showProposalWizard || showDelegation || showForum || showModeration || showTreasury || showStaking || showMultiSig || showEducation || showP2P;

  if (isMobile && !isFeaturePanelOpen) {
    return <MobileHomeLayout />;
  }

  if (!user) {
    return <LandingPageDesktop />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* LEFT: Logo - hidden on mobile */}
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

            {/* CENTER & RIGHT: Menu + Actions in same row (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-4 flex-1 justify-between ml-4 xl:ml-8 min-w-0">
              {user ? (
                <div />
              ) : (
                <>
                <div className="flex items-center gap-2 flex-shrink min-w-0">
                  <button
                    onClick={() => navigate('/be-citizen')}
                    className="text-cyan-300 hover:text-cyan-100 transition-colors flex items-center gap-1 text-sm font-semibold whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    {t('nav.beCitizen')}
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                  >
                    <LogIn className="w-4 h-4" />
                    {t('nav.login')}
                  </button>
                </div>
                </>
              )}

              {/* Right actions - always visible, flex-shrink-0 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href="/docs"
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  {t('nav.docs')}
                </a>

                <div className="w-px h-6 bg-gray-700"></div>

                <div className="flex items-center">
                  {isConnected ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                <NotificationBell />
                <LanguageSwitcher />
                {user && (
                  <button
                    onClick={() => navigate('/profile/settings')}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title={t('nav.settings')}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <PezkuwiWalletButton />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Button Grid (logged in only) */}
      {user && (
        <div ref={gridRef} className="fixed top-16 w-full z-30 bg-gray-950/95 backdrop-blur-md border-b border-gray-800">
          <div className="max-w-5xl mx-auto grid grid-cols-4 gap-1 sm:gap-2 px-1 sm:px-4 py-1 sm:py-2">
            {/* Dashboard */}
            <button
              onClick={() => { setOpenMenu(null); navigate('/dashboard'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-green-500/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-400" />
              {t('nav.dashboard')}
            </button>
            {/* Wallet */}
            <button
              onClick={() => { setOpenMenu(null); navigate('/wallet'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-yellow-400/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-400" />
              {t('nav.wallet')}
            </button>
            {/* Be Citizen */}
            <button
              onClick={() => { setOpenMenu(null); navigate('/be-citizen'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-cyan-400/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-cyan-400" />
              {t('nav.beCitizen')}
            </button>
            {/* PEZMessage */}
            <button
              onClick={() => { setOpenMenu(null); navigate('/message'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-purple-500/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-400" />
              {t('nav.message')}
            </button>
            {/* Trading (dropdown) */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'trading' ? null : 'trading')}
                className="w-full flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-red-500/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400" />
                <span className="flex items-center gap-0.5">{t('nav.trading')} <ChevronDown className="w-3 h-3" /></span>
              </button>
              {openMenu === 'trading' && (
                <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-1 w-44 sm:w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
                  <button onClick={() => { setShowDEX(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-t-lg">
                    <Droplet className="w-4 h-4" /> {t('trading.dexPools')}
                  </button>
                  <button onClick={() => { setShowP2P(true); navigate('/p2p'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <Users className="w-4 h-4" /> {t('trading.p2p')}
                  </button>
                  <button onClick={() => { navigate('/presale'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <Coins className="w-4 h-4" /> {t('trading.presale')}
                  </button>
                  <button onClick={() => { setShowStaking(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> {t('trading.staking')}
                  </button>
                  <button onClick={() => { setShowMultiSig(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-b-lg">
                    <Lock className="w-4 h-4" /> {t('trading.multiSig')}
                  </button>
                </div>
              )}
            </div>
            {/* Education */}
            <button
              onClick={() => { setOpenMenu(null); setShowEducation(true); navigate('/education'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-yellow-400/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <Award className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-400" />
              {t('nav.education')}
            </button>
            {/* Governance (dropdown) */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'governance' ? null : 'governance')}
                className="w-full flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-green-500/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
              >
                <FileEdit className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-400" />
                <span className="flex items-center gap-0.5">{t('nav.governance')} <ChevronDown className="w-3 h-3" /></span>
              </button>
              {openMenu === 'governance' && (
                <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-1 w-44 sm:w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
                  <button onClick={() => { setShowProposalWizard(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-t-lg">
                    <FileEdit className="w-4 h-4" /> {t('governance.proposals')}
                  </button>
                  <button onClick={() => { setShowDelegation(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <Users2 className="w-4 h-4" /> {t('governance.delegation')}
                  </button>
                  <button onClick={() => { setShowForum(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> {t('nav.forum')}
                  </button>
                  <button onClick={() => { setShowTreasury(true); setTreasuryTab('overview'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" /> {t('nav.treasury')}
                  </button>
                  <button onClick={() => { setShowModeration(true); setOpenMenu(null); }} className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 rounded-b-lg">
                    <ShieldCheck className="w-4 h-4" /> {t('nav.moderation')}
                  </button>
                </div>
              )}
            </div>
            {/* Logout */}
            <button
              onClick={async () => { setOpenMenu(null); await signOut(); navigate('/login'); }}
              className="flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 rounded-xl bg-gray-900/70 border border-red-500/40 text-[9px] sm:text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 cursor-pointer text-gray-300 hover:text-white"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400 rotate-180" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-16 right-0 bottom-0 w-64 sm:w-72 bg-gray-900 border-l border-gray-800 overflow-y-auto">
            <div className="p-4 space-y-2">
              {user ? (
                <>
                  <button
                    onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    {t('nav.dashboard')}
                  </button>
                  <button
                    onClick={() => { navigate('/wallet'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <Wallet className="w-5 h-5" />
                    {t('nav.wallet')}
                  </button>
                  <button
                    onClick={() => { navigate('/message'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-purple-400 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <MessageSquare className="w-5 h-5" />
                    {t('nav.message')}
                  </button>
                  <button
                    onClick={() => { navigate('/citizens'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-cyan-400 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <Users className="w-5 h-5" />
                    {t('nav.citizensPortal')}
                  </button>
                  <button
                    onClick={() => { navigate('/be-citizen'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-cyan-300 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <Users className="w-5 h-5" />
                    {t('nav.beCitizen')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">{t('nav.governance')}</div>
                  <button
                    onClick={() => { setShowProposalWizard(true); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <FileEdit className="w-5 h-5" />
                    {t('governance.proposals')}
                  </button>
                  <button
                    onClick={() => { setShowDelegation(true); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <Users2 className="w-5 h-5" />
                    {t('governance.delegation')}
                  </button>
                  <button
                    onClick={() => { setShowTreasury(true); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <PiggyBank className="w-5 h-5" />
                    {t('nav.treasury')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">{t('nav.trading')}</div>
                  <button
                    onClick={() => { setShowDEX(true); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <Droplet className="w-5 h-5" />
                    {t('trading.dexPools')}
                  </button>
                  <button
                    onClick={() => { navigate('/p2p'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <ArrowRightLeft className="w-5 h-5" />
                    {t('trading.p2p')}
                  </button>
                  <button
                    onClick={() => { navigate('/presale'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <Coins className="w-5 h-5" />
                    {t('trading.presale')}
                  </button>
                  <button
                    onClick={() => { setShowStaking(true); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <TrendingUp className="w-5 h-5" />
                    {t('trading.staking')}
                  </button>
                  <div className="border-t border-gray-800 my-2" />
                  <button
                    onClick={() => { navigate('/profile/settings'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                  >
                    <Settings className="w-5 h-5" />
                    {t('nav.settings')}
                  </button>
                  <button
                    onClick={async () => { await signOut(); navigate('/login'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-red-400 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <LogIn className="w-5 h-5 rotate-180" />
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { navigate('/be-citizen'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg text-cyan-300 hover:bg-gray-800 flex items-center gap-3"
                  >
                    <Users className="w-5 h-5" />
                    {t('nav.beCitizen')}
                  </button>
                  <button
                    onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-3"
                  >
                    <LogIn className="w-5 h-5" />
                    {t('nav.login')}
                  </button>
                </>
              )}
              <div className="border-t border-gray-800 my-2" />
              <a
                href="/docs"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
              >
                <ExternalLink className="w-5 h-5" />
                {t('nav.docs')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>
        {/* Conditional Rendering for Features */}
        {showDEX ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <DEXDashboard />
            </div>
          </div>
        ) : showProposalWizard ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <ProposalWizard
                onComplete={(proposal) => {
                  if (import.meta.env.DEV) console.log('Proposal created:', proposal);
                  setShowProposalWizard(false);
                }}
                onCancel={() => setShowProposalWizard(false)}
              />
            </div>
          </div>
        ) : showDelegation ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <DelegationManager />
            </div>
          </div>
        ) : showForum ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <ForumOverview />
            </div>
          </div>
        ) : showModeration ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <ModerationPanel />
            </div>
          </div>
        ) : showTreasury ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
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
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" />
                    {t('treasury.overview', 'Overview')}
                  </TabsTrigger>
                  <TabsTrigger value="proposals" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    {t('treasury.proposals', 'Funding Proposals')}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    {t('treasury.history', 'Spending History')}
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    {t('treasury.approvals', 'Multi-Sig Approvals')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-6">
                  <TreasuryOverview />
                </TabsContent>
                
                <TabsContent value="proposals" className="mt-6">
                  <FundingProposal />
                </TabsContent>
                
                <TabsContent value="history" className="mt-6">
                  <SpendingHistory />
                </TabsContent>
                
                <TabsContent value="approvals" className="mt-6">
                  <MultiSigApproval />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : showStaking ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">
                  {t('staking.title')}
                </h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                  {t('staking.subtitle')}
                </p>
              </div>
              <StakingDashboard />
            </div>
          </div>
        ) : showMultiSig ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <div className="max-w-full mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">
                  {t('multiSig.title')}
                </h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                  {t('multiSig.subtitle')}
                </p>
              </div>
              <MultiSigWallet />
            </div>
          </div>
        ) : showEducation ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <EducationPlatform />
          </div>
        ) : showP2P ? (
          <div className="pt-20 sm:pt-[8.5rem] min-h-screen bg-gray-950">
            <P2PDashboard />
          </div>
        ) : (
          <>
            <HeroSection />
            {/* ChainSpecs (Mainnet card) - show right after hero on mobile */}
            <div id="chain-specs" className="block sm:hidden">
              <ChainSpecs />
            </div>
            <NetworkStats key="network-stats-live" />
            <PalletsGrid />
            <TokenomicsSection />


            <div id="trust-calculator">
              <TrustScoreCalculator />
            </div>
            {/* ChainSpecs - original position for desktop */}
            <div id="chain-specs-desktop" className="hidden sm:block">
              <ChainSpecs />
            </div>
            <div id="governance">
              <GovernanceInterface />
            </div>
            <div id="rewards">
              <RewardDistribution />
            </div>
          </>
        )}
        

        {(showDEX || showProposalWizard || showDelegation || showForum || showModeration || showTreasury || showStaking || showMultiSig || showEducation || showP2P) && (
          <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50">
            <button
              onClick={() => {
                setShowDEX(false);
                setShowProposalWizard(false);
                setShowDelegation(false);
                setShowForum(false);
                setShowModeration(false);
                setShowTreasury(false);
                setShowStaking(false);
                setShowMultiSig(false);
                setShowEducation(false);
                setShowP2P(false);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 sm:px-6 sm:py-3 text-sm sm:text-base rounded-full shadow-lg flex items-center gap-2 transition-all"
            >
              {`← ${t('common.backToHome')}`}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-12">
        <div className="max-w-full mx-auto px-4">
          {/* Contact Info */}
          <div className="mb-8 space-y-2 text-sm text-gray-400 text-center">
            <p className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              info@pezkuwichain.io
            </p>
            <p className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              info@pezkuwichain.app
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
            <div>
              <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-green-500 to-yellow-400 bg-clip-text text-transparent">
                PezkuwiChain
              </h3>
              <p className="text-gray-400 text-sm">
                {t('footer.platform')}
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-left">{t('footer.about')}</h4>
              <ul className="space-y-2 text-left">
                <li>
                  <a
                    href="https://raw.githubusercontent.com/pezkuwichain/DKSweb/main/public/Whitepaper.pdf"
                    download="Pezkuwi_Whitepaper.pdf"
                    className="text-gray-400 hover:text-white text-sm inline-flex items-center"
                  >
                    {t('footer.whitepaper')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="https://github.com/pezkuwichain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.github')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-left">{t('footer.developers')}</h4>
              <ul className="space-y-2 text-left">
                <li>
                  <a href="/api" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.api')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="/developers" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.sdk')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-left">{t('footer.community')}</h4>
              <ul className="space-y-2 text-left">
                <li>
                  <a href="https://discord.gg/pezkuwichain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.discord')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="https://x.com/PezkuwiChain" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.twitter')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="https://t.me/PezkuwiApp" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.telegram')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="https://www.youtube.com/@SatoshiQazi" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.youtube')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  <a href="https://facebook.com/profile.php?id=61582484611719" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm inline-flex items-center">
                    {t('footer.facebook')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-400 text-sm">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;