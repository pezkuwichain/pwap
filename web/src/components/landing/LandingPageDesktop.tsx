import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import './landing.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChainStats {
  latestBlock: number;
  finalizedBlock: number;
  blockHash: string;
  peers: number;
  validators: number;
  nominators: number;
  collators: number;
  activeProposals: number;
  totalVoters: number;
  citizenCount: number;
  tokensStakedPct: string;
}

// ─── SVG Sprite (pallet icons) ───────────────────────────────────────────────

const SPRITE_STYLES = `
  .stk  { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .fill  { fill: currentColor; stroke: none; }
  .soft  { fill: currentColor; stroke: none; opacity: 0.18; }
  .softer{ fill: currentColor; stroke: none; opacity: 0.10; }
  .pop   { fill: #fbbf24; stroke: none; }
  .pop2  { fill: #f97316; stroke: none; }
  .pop3  { fill: #ef4444; stroke: none; }
  .pop4  { fill: #22c55e; stroke: none; }
  .pop5  { fill: #3b82f6; stroke: none; }
  .pop6  { fill: #a855f7; stroke: none; }
  .ink   { fill: #ffffff; stroke: none; }
`;

const Sprite: React.FC = () => (
  <svg className="lp-sprite" aria-hidden="true">
    <defs>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: SPRITE_STYLES }} />
      {/* Finance */}
      <symbol id="lp-i-wallet" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="8" width="26" height="18" rx="3"/>
        <path className="stk" d="M3 12c0-2.2 1.8-4 4-4h17a3 3 0 0 1 3 3v3"/>
        <rect className="stk" x="3" y="11" width="26" height="15" rx="2.5"/>
        <rect className="pop" x="20" y="15" width="11" height="7" rx="2"/>
        <circle className="ink" cx="24" cy="18.5" r="1.4"/>
      </symbol>
      <symbol id="lp-i-bank" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="14" width="26" height="11" rx="1"/>
        <path className="stk" d="M3 13l13-7 13 7"/>
        <path className="fill" d="M14 7.5l2-1 2 1v1l-2 1-2-1z"/>
        <path className="stk" d="M7 14v9M12 14v9M20 14v9M25 14v9"/>
        <path className="stk" d="M3 25h26M2 28h28"/>
        <rect className="pop" x="2" y="27" width="28" height="2" rx="1"/>
      </symbol>
      <symbol id="lp-i-exch" viewBox="0 0 32 32">
        <circle className="soft" cx="16" cy="16" r="12"/>
        <path className="stk" d="M6 12h17l-4-4"/>
        <path className="stk" d="M26 20H9l4 4"/>
        <circle className="pop4" cx="23" cy="12" r="2"/>
        <circle className="pop3" cx="9" cy="20" r="2"/>
      </symbol>
      <symbol id="lp-i-dex" viewBox="0 0 32 32">
        <circle className="soft" cx="16" cy="16" r="12"/>
        <circle className="stk" cx="16" cy="16" r="10"/>
        <path className="stk" d="M16 6v20M6 16h20"/>
        <circle className="pop" cx="16" cy="16" r="3.4"/>
      </symbol>
      <symbol id="lp-i-p2p" viewBox="0 0 32 32">
        <circle className="soft" cx="10" cy="11" r="7"/>
        <circle className="soft" cx="22" cy="11" r="7"/>
        <circle className="stk" cx="10" cy="11" r="3.6"/>
        <circle className="stk" cx="22" cy="11" r="3.6"/>
        <path className="stk" d="M3 26c0-3.6 3.1-6 7-6s7 2.4 7 6"/>
        <path className="stk" d="M15 26c0-3.6 3.1-6 7-6s7 2.4 7 6"/>
        <circle className="pop4" cx="10" cy="11" r="1.4"/>
        <circle className="pop5" cx="22" cy="11" r="1.4"/>
      </symbol>
      <symbol id="lp-i-b2b" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="11" width="11" height="16" rx="1.5"/>
        <rect className="soft" x="18" y="6" width="11" height="21" rx="1.5"/>
        <rect className="stk" x="3" y="11" width="11" height="16" rx="1.5"/>
        <rect className="stk" x="18" y="6" width="11" height="21" rx="1.5"/>
        <rect className="pop"  x="6"  y="14" width="5" height="1.6" rx="0.6"/>
        <rect className="pop2" x="6"  y="18" width="5" height="1.6" rx="0.6"/>
        <rect className="pop4" x="21" y="10" width="5" height="1.6" rx="0.6"/>
        <rect className="pop5" x="21" y="14" width="5" height="1.6" rx="0.6"/>
        <rect className="pop6" x="21" y="18" width="5" height="1.6" rx="0.6"/>
      </symbol>
      <symbol id="lp-i-zekat" viewBox="0 0 32 32">
        <circle className="soft" cx="16" cy="16" r="12"/>
        <path className="stk" d="M16 5v22"/>
        <path className="stk" d="M22 9c-2.5-2-9-2-12 0s-2.5 5 0 7 9 2 12 4-2.5 4-12 2"/>
      </symbol>
      <symbol id="lp-i-rocket" viewBox="0 0 32 32">
        <path className="soft" d="M19 4c5.5 0 8.5 3 8.5 8.5-3 0-4.5 1.5-6 4l-7 7-4-4 7-7c1.5-1.5 2.5-3 2.5-5"/>
        <path className="stk" d="M19 4c5.5 0 8.5 3 8.5 8.5-3 0-4.5 1.5-6 4l-7 7-4-4 7-7c1.5-1.5 2.5-3 2.5-5"/>
        <circle className="pop3" cx="20" cy="12" r="1.8"/>
        <path className="pop2" d="M11 22l-5 5 1.5 1.5L13 24z"/>
      </symbol>
      {/* Governance */}
      <symbol id="lp-i-crown" viewBox="0 0 32 32">
        <path className="soft" d="M4 23l3-13 6 6 3-9 3 9 6-6 3 13z"/>
        <path className="stk" d="M4 23l3-13 6 6 3-9 3 9 6-6 3 13z"/>
        <path className="stk" d="M4 26h24"/>
        <circle className="pop" cx="7" cy="10" r="1.6"/>
        <circle className="pop2" cx="16" cy="7" r="1.6"/>
        <circle className="pop" cx="25" cy="10" r="1.6"/>
      </symbol>
      <symbol id="lp-i-assembly" viewBox="0 0 32 32">
        <path className="soft" d="M5 25V11l11-6 11 6v14z"/>
        <path className="stk" d="M5 25V11l11-6 11 6v14"/>
        <path className="stk" d="M3 27h26M10 25v-8M16 25v-8M22 25v-8"/>
      </symbol>
      <symbol id="lp-i-vote" viewBox="0 0 32 32">
        <rect className="soft" x="4" y="7" width="24" height="19" rx="2"/>
        <rect className="stk" x="4" y="7" width="24" height="19" rx="2"/>
        <path d="M11 16l3 3 7-7" stroke="#22c55e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </symbol>
      <symbol id="lp-i-shield" viewBox="0 0 32 32">
        <path className="soft" d="M16 4l11 4v8c0 7-5 11-11 12-6-1-11-5-11-12V8z"/>
        <path className="stk" d="M16 4l11 4v8c0 7-5 11-11 12-6-1-11-5-11-12V8z"/>
        <path d="M11 16l3 3 6-6" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      </symbol>
      <symbol id="lp-i-justice" viewBox="0 0 32 32">
        <path className="stk" d="M16 5v22M5 27h22"/>
        <circle className="pop" cx="16" cy="5" r="1.6"/>
        <path className="stk" d="M6 12l4-7 4 7M18 12l4-7 4 7"/>
        <path className="soft" d="M6 12c0 2.5 1.8 4 4 4s4-1.5 4-4zM18 12c0 2.5 1.8 4 4 4s4-1.5 4-4z"/>
      </symbol>
      <symbol id="lp-i-proposal" viewBox="0 0 32 32">
        <path className="soft" d="M7 4h11l6 6v18H7z"/>
        <path className="stk" d="M7 4h11l6 6v18H7zM18 4v6h6"/>
        <rect className="pop"  x="11" y="14" width="10" height="1.6" rx="0.8"/>
        <rect className="pop2" x="11" y="18" width="8"  height="1.6" rx="0.8"/>
        <rect className="pop3" x="11" y="22" width="6"  height="1.6" rx="0.8"/>
      </symbol>
      <symbol id="lp-i-poll" viewBox="0 0 32 32">
        <path className="stk" d="M4 27h24"/>
        <rect className="pop4" x="5"  y="17" width="5" height="10" rx="1"/>
        <rect className="pop"  x="13" y="11" width="5" height="16" rx="1"/>
        <rect className="pop3" x="21" y="5"  width="5" height="22" rx="1"/>
      </symbol>
      <symbol id="lp-i-id" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="7" width="26" height="18" rx="2"/>
        <rect className="stk" x="3" y="7" width="26" height="18" rx="2"/>
        <circle className="pop2" cx="11" cy="14" r="3"/>
        <path className="pop2" d="M6 22c.8-2.4 2.8-3.6 5-3.6s4.2 1.2 5 3.6"/>
        <rect className="pop"  x="18" y="12" width="8" height="1.6" rx="0.8"/>
        <rect className="pop"  x="18" y="16" width="6" height="1.6" rx="0.8"/>
      </symbol>
      {/* Social */}
      <symbol id="lp-i-chat" viewBox="0 0 32 32">
        <path className="soft" d="M5 6h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H12l-6 5V8a2 2 0 0 1 2-2z"/>
        <path className="stk" d="M5 6h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H12l-6 5V8a2 2 0 0 1 2-2z"/>
        <circle className="pop4" cx="11" cy="14.5" r="1.4"/>
        <circle className="pop"  cx="16" cy="14.5" r="1.4"/>
        <circle className="pop3" cx="21" cy="14.5" r="1.4"/>
      </symbol>
      <symbol id="lp-i-forum" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="6" width="26" height="20" rx="2"/>
        <rect className="stk" x="3" y="6" width="26" height="20" rx="2"/>
        <rect className="pop" x="3" y="6" width="26" height="4" rx="2"/>
        <rect className="pop4" x="8" y="14" width="16" height="2" rx="1"/>
        <rect className="pop2" x="8" y="18" width="13" height="2" rx="1"/>
      </symbol>
      <symbol id="lp-i-media" viewBox="0 0 32 32">
        <rect className="soft" x="3" y="6" width="26" height="16" rx="2"/>
        <rect className="stk" x="3" y="6" width="26" height="16" rx="2"/>
        <path className="pop3" d="M14 11l6 3-6 3z"/>
        <path className="stk" d="M9 26h14M16 22v4"/>
      </symbol>
      <symbol id="lp-i-cal" viewBox="0 0 32 32">
        <rect className="soft" x="4" y="6" width="24" height="22" rx="2"/>
        <rect className="stk" x="4" y="6" width="24" height="22" rx="2"/>
        <path className="pop3" d="M4 12h24"/>
        <rect className="stk" x="9" y="3" width="2" height="6" rx="1"/>
        <rect className="stk" x="21" y="3" width="2" height="6" rx="1"/>
      </symbol>
      <symbol id="lp-i-help" viewBox="0 0 32 32">
        <circle className="soft" cx="16" cy="16" r="12"/>
        <circle className="stk" cx="16" cy="16" r="12"/>
        <path className="stk" d="M12 13c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8c0 3-4 3-4 6"/>
        <circle className="pop3" cx="16" cy="22.5" r="1.2"/>
      </symbol>
      <symbol id="lp-i-music" viewBox="0 0 32 32">
        <path className="soft" d="M12 22V8l14-2v15"/>
        <path className="stk" d="M12 22V8l14-2v15"/>
        <circle className="pop3" cx="9" cy="22" r="3.4"/>
        <circle className="pop"  cx="23" cy="21" r="3.4"/>
      </symbol>
      <symbol id="lp-i-vpn" viewBox="0 0 32 32">
        <path className="soft" d="M16 4l11 4v8c0 7-5 11-11 12-6-1-11-5-11-12V8z"/>
        <path className="stk" d="M16 4l11 4v8c0 7-5 11-11 12-6-1-11-5-11-12V8z"/>
        <rect className="pop5" x="11" y="14" width="10" height="8" rx="1.5"/>
        <path d="M14 14v-2a2 2 0 0 1 4 0v2" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      </symbol>
      <symbol id="lp-i-ref" viewBox="0 0 32 32">
        <circle className="soft" cx="11" cy="11" r="6"/>
        <circle className="stk" cx="11" cy="11" r="4"/>
        <circle className="stk" cx="22" cy="13" r="3"/>
        <path className="stk" d="M3 26c.6-3.6 3.8-6 8-6s7.4 2.4 8 6M16 26c.4-2.4 2.6-4 5-4s4.6 1.6 5 4"/>
        <circle className="pop4" cx="11" cy="11" r="1.6"/>
        <circle className="pop5" cx="22" cy="13" r="1.4"/>
      </symbol>
      {/* Education */}
      <symbol id="lp-i-cap" viewBox="0 0 32 32">
        <path className="soft" d="M3 12l13-6 13 6-13 6z"/>
        <path className="stk" d="M3 12l13-6 13 6-13 6zM9 16v6c2.5 2 11.5 2 14 0v-6M28 12v8"/>
        <circle className="pop3" cx="28" cy="22" r="1.6"/>
      </symbol>
      <symbol id="lp-i-book" viewBox="0 0 32 32">
        <path className="soft" d="M4 6c5-1 10-1 12 1v18c-2-2-7-2-12-1zM16 7c2-2 7-2 12-1v19c-5-1-10-1-12 1z"/>
        <path className="stk" d="M4 6c5-1 10-1 12 1v18c-2-2-7-2-12-1zM16 7c2-2 7-2 12-1v19c-5-1-10-1-12 1z"/>
        <path className="pop"  d="M7 11h6M7 14h6M7 17h4"/>
        <path className="pop2" d="M19 11h6M19 14h6M19 17h4"/>
      </symbol>
      <symbol id="lp-i-trophy" viewBox="0 0 32 32">
        <path className="soft" d="M10 4h12v7a6 6 0 0 1-12 0z"/>
        <path className="stk" d="M10 4h12v7a6 6 0 0 1-12 0zM6 6H3v3a4 4 0 0 0 4 4M26 6h3v3a4 4 0 0 1-4 4M13 17v3h6v-3M9 28h14M13 20v8M19 20v8"/>
      </symbol>
      <symbol id="lp-i-research" viewBox="0 0 32 32">
        <circle className="soft" cx="14" cy="14" r="9"/>
        <circle className="stk" cx="14" cy="14" r="7"/>
        <path className="stk" d="M19.5 19.5L27 27"/>
        <path d="M11 14h6M14 11v6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none"/>
      </symbol>
      <symbol id="lp-i-library" viewBox="0 0 32 32">
        <rect className="pop"  x="4"  y="6" width="4" height="20" rx="0.8"/>
        <rect className="pop4" x="10" y="8" width="4" height="18" rx="0.8"/>
        <rect className="pop5" x="16" y="5" width="4" height="21" rx="0.8"/>
        <rect className="pop3" x="22" y="9" width="4" height="17" rx="0.8" transform="rotate(8 24 17.5)"/>
        <path className="stk" d="M3 27h26"/>
      </symbol>
      <symbol id="lp-i-pen" viewBox="0 0 32 32">
        <path className="soft" d="M19 4l9 9-15 15H4v-9z"/>
        <path className="stk" d="M19 4l9 9-15 15H4v-9zM4 28l9-9"/>
        <path className="pop" d="M19 4l9 9-3 3-9-9z"/>
      </symbol>
      <symbol id="lp-i-lab" viewBox="0 0 32 32">
        <path className="soft" d="M11 4v8L5 24a3 3 0 0 0 2.6 4.5h16.8A3 3 0 0 0 27 24l-6-12V4"/>
        <path className="stk" d="M11 4v8L5 24a3 3 0 0 0 2.6 4.5h16.8A3 3 0 0 0 27 24l-6-12V4M9 4h14"/>
        <path className="pop4" d="M8 19h16l1 2.5c.6 1.4-.4 3-2 3H9c-1.6 0-2.6-1.6-2-3z"/>
      </symbol>
      <symbol id="lp-i-globe" viewBox="0 0 32 32">
        <circle className="soft" cx="16" cy="16" r="12"/>
        <circle className="stk" cx="16" cy="16" r="12"/>
        <path className="stk" d="M4 16h24M16 4c4 4 4 20 0 24M16 4c-4 4-4 20 0 24"/>
      </symbol>
      <symbol id="lp-i-lock" viewBox="0 0 24 24">
        <rect fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" x="6" y="11" width="12" height="9" rx="2"/>
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 11V8a3 3 0 0 1 6 0v3"/>
      </symbol>
    </defs>
  </svg>
);

// ─── Pallet item ─────────────────────────────────────────────────────────────

const PalletItem: React.FC<{
  icon?: string; imgSrc?: string; label: string;
  to?: string; external?: string;
  locked?: boolean; requiresLogin?: boolean; onClick?: () => void;
}> = ({ icon, imgSrc, label, to, external, locked, requiresLogin, onClick }) => {
  const navigate = useNavigate();

  const inner = (
    <>
      <span className="lp-ico-frame">
        {imgSrc
          ? <img src={imgSrc} alt="" width={24} height={24} style={{ objectFit: 'contain', borderRadius: 4 }} />
          : <svg><use href={`#${icon}`}/></svg>
        }
      </span>
      <span className="nm">{label}</span>
    </>
  );

  if (locked) {
    return (
      <span className="lp-pallet-item locked" title="Coming soon">
        <svg className="lp-lock-icon"><use href="#lp-i-lock"/></svg>
        {inner}
      </span>
    );
  }
  if (requiresLogin) {
    return (
      <button className="lp-pallet-item" onClick={() => navigate('/login')} title="Login required">
        <svg className="lp-lock-icon"><use href="#lp-i-lock"/></svg>
        {inner}
      </button>
    );
  }
  if (external) {
    return (
      <a className="lp-pallet-item" href={external} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return <button className="lp-pallet-item" onClick={onClick}>{inner}</button>;
  }
  return (
    <Link className="lp-pallet-item" to={to ?? '/'}>
      {inner}
    </Link>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const LandingPageDesktop: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { api, assetHubApi, peopleApi, isApiReady, isAssetHubReady, isPeopleReady, selectedAccount, disconnectWallet, connectWallet } = usePezkuwi();

  const [tokTab, setTokTab] = useState<'hez'|'pez'>('hez');
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChainStats>({
    latestBlock: 0, finalizedBlock: 0, blockHash: '',
    peers: 0, validators: 0, nominators: 0, collators: 0,
    activeProposals: 0, totalVoters: 0, citizenCount: 0,
    tokensStakedPct: '—',
  });

  // Animate counter on scroll
  const counterRefs = useRef<Map<string, HTMLElement>>(new Map());
  const animated = useRef<Set<string>>(new Set());

  const animateNum = useCallback((el: HTMLElement, target: number) => {
    const dur = 1600;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (elapsed < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('lp-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Counter animation on scroll
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const el = e.target as HTMLElement;
        const key = el.dataset.counterKey ?? '';
        if (e.isIntersecting && !animated.current.has(key)) {
          animated.current.add(key);
          const target = parseInt(el.dataset.counter ?? '0', 10);
          animateNum(el, target);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-counter]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [animateNum, stats]);

  // Live block subscription
  useEffect(() => {
    if (!api || !isApiReady) return;
    let unsub: (() => void) | null = null;

    api.rpc.chain.subscribeNewHeads((header) => {
      const blockNum = header.number.toNumber();
      setStats(prev => ({
        ...prev,
        latestBlock: blockNum,
        blockHash: header.hash.toHex().slice(0, 10) + '…' + header.hash.toHex().slice(-8),
        finalizedBlock: Math.max(prev.finalizedBlock, blockNum - 2),
      }));
    }).then(fn => { unsub = fn; }).catch(() => {});

    api.rpc.system.peers().then(peers => {
      setStats(prev => ({ ...prev, peers: peers.length }));
    }).catch(() => {});

    return () => { unsub?.(); };
  }, [api, isApiReady]);

  // Governance + validators + nominators from relay
  useEffect(() => {
    if (!api || !isApiReady) return;
    (async () => {
      try {
        const [entries, votingKeys, sessionVals] = await Promise.all([
          api.query.referenda.referendumInfoFor.entries(),
          api.query.convictionVoting.votingFor.keys(),
          api.query.session.validators(),
        ]);
        const activeProposals = entries.filter(([, info]) => {
          const d = info.toJSON();
          return d && typeof d === 'object' && 'ongoing' in d;
        }).length;
        const totalVoters = new Set(votingKeys.map(k => k.args[0].toString())).size;
        const validators = sessionVals.length;
        setStats(prev => ({ ...prev, activeProposals, totalVoters, validators }));
      } catch {}

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nomCount = await (api.query.staking as any).counterForNominators?.();
        if (nomCount != null) setStats(prev => ({ ...prev, nominators: nomCount.toNumber() }));
      } catch {}
    })();
  }, [api, isApiReady]);

  // Staking % from Asset Hub
  useEffect(() => {
    if (!assetHubApi || !isAssetHubReady) return;
    (async () => {
      try {
        const ledgers = await assetHubApi.query.staking.ledger.entries();
        let total = BigInt(0);
        for (const [, l] of ledgers) {
          if (!l.isEmpty) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = (l as any).unwrap?.()?.toJSON() ?? (l as any).toJSON();
            total += BigInt(d?.active ?? d?.total ?? '0');
          }
        }
        const totalIssuance = await assetHubApi.query.balances.totalIssuance();
        const issuance = BigInt(totalIssuance.toString());
        if (issuance > 0n) {
          const pct = (Number(total) / Number(issuance) * 100).toFixed(1);
          setStats(prev => ({ ...prev, tokensStakedPct: pct + '%' }));
        }
      } catch {}

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const collCount = await (assetHubApi.query.collatorSelection as any)?.candidates?.();
        if (collCount != null) setStats(prev => ({ ...prev, collators: collCount.length }));
      } catch {}
    })();
  }, [assetHubApi, isAssetHubReady]);

  // Citizens from People Chain
  useEffect(() => {
    if (!peopleApi || !isPeopleReady) return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries = await (peopleApi.query as any).tiki?.citizenNft?.entries?.();
        if (entries) setStats(prev => ({ ...prev, citizenCount: entries.length }));
      } catch {}
    })();
  }, [peopleApi, isPeopleReady]);

  const shortHash = (h: string) => h || '0x——————…————';

  const handleConnectWallet = async () => {
    setWalletConnectError(null);
    try {
      await connectWallet();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletConnectError(msg || 'Wallet extension not found. Please install Pezkuwi.js or Polkadot.js.');
    }
  };

  // ─── Ticker content ───────────────────────────────────────────────────────
  const tickerItems = [
    { label: t('landing.ticker.block'), val: stats.latestBlock ? `#${stats.latestBlock.toLocaleString()}` : '—' },
    { label: t('landing.ticker.validators'), val: stats.validators || '—' },
    { label: t('landing.ticker.nominators'), val: stats.nominators ? stats.nominators.toLocaleString() : '—' },
    { label: t('landing.ticker.citizens'), val: stats.citizenCount ? stats.citizenCount.toLocaleString() : '—' },
    { label: t('landing.ticker.staked'), val: stats.tokensStakedPct },
    { label: t('landing.ticker.proposals'), val: stats.activeProposals || '—' },
    { label: t('landing.ticker.peers'), val: stats.peers || '—' },
  ];

  return (
    <div className="lp" data-accent="default" data-density="default">
      <Sprite />
      <div className="lp-grain" aria-hidden="true" />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-mark" />
            <span className="lp-logo-text">PezkuwiChain</span>
          </Link>

          <div className="lp-nav-links">
            <Link to="/explorer" className="lp-nav-link">{t('landing.nav.network')}</Link>
            <Link to="/governance/assembly" className="lp-nav-link">{t('landing.nav.governance')}</Link>
            <Link to="/p2p" className="lp-nav-link">{t('landing.nav.trading')}</Link>
            <Link to="/citizens" className="lp-nav-link">{t('landing.nav.citizens')}</Link>
            <Link to="/docs" className="lp-nav-link">{t('landing.nav.docs')}</Link>
          </div>

          <div className="lp-nav-actions">
            <div className="lp-status-pill">
              <span className="lp-status-dot" />
              {t('landing.nav.mainnet')}
            </div>
            <LanguageSwitcher />
            {selectedAccount ? (
              <div className="lp-wallet-connected">
                <span className="lp-btn-wallet lp-btn-wallet--on">
                  <span className="lp-wallet-dot" />
                  <span className="lp-wallet-name">{selectedAccount.meta.name || selectedAccount.address.slice(0, 6) + '…'}</span>
                </span>
                <button className="lp-btn-wallet-dc" onClick={disconnectWallet} title="Disconnect wallet">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <button className="lp-btn-wallet lp-btn-wallet--off" onClick={handleConnectWallet}>
                  {t('landing.nav.connectWallet')}
                </button>
                {walletConnectError && (
                  <div className="lp-wallet-error" role="alert">
                    {walletConnectError}
                  </div>
                )}
              </div>
            )}
            <button className="lp-btn-login" onClick={() => navigate('/login')}>
              {t('landing.nav.login')}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
          <div className="lp-hero-bg" />
          <div className="lp-container lp-hero-content">
            <div className="lp-hero-v1-grid">
              <div>
                <div className="lp-hero-badge lp-reveal">
                  <span className="pill">{t('landing.hero.badgeVersion')}</span>
                  <span>{t('landing.hero.badge')}</span>
                </div>
                <h1 className="lp-hero-h1 lp-reveal d1">
                  {t('landing.hero.h1part1')}<br />
                  {t('landing.hero.h1part2')} <span className="accent">{t('landing.hero.h1accent')}</span><br />
                  {t('landing.hero.h1part3')}
                </h1>
                <p className="lp-hero-sub lp-reveal d2">
                  {t('landing.hero.sub')}
                </p>
                <div className="lp-hero-cta lp-reveal d3">
                  <button className="lp-btn lp-btn-accent" onClick={() => navigate('/explorer')}>
                    {t('landing.hero.cta.explore')}
                  </button>
                  <Link className="lp-btn lp-btn-outline" to="/docs">
                    {t('landing.hero.cta.whitepaper')}
                  </Link>
                </div>
              </div>
              <div className="lp-hero-side lp-reveal d2">
                <div className="lp-sun-bg" />
                <div className="lp-sun-rings" />
                <div className="lp-sun-disc" />
                <div className="lp-hero-side-meta">
                  <span><strong>Roj</strong> · {t('landing.hero.sun.name')}</span>
                  <span>{t('landing.hero.sun.rays')}</span>
                </div>
              </div>
            </div>

            {/* Stat bar */}
            <div className="lp-statbar lp-reveal d4">
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico">
                    <svg viewBox="0 0 24 24"><path d="M5 12.5A9 9 0 0 1 12 9a9 9 0 0 1 7 3.5"/><path d="M8 15.5A5 5 0 0 1 12 14a5 5 0 0 1 4 1.5"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/></svg>
                  </span>
                  <span className="label">{t('landing.statbar.network')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="lp-conn-pill">{t('landing.statbar.connected')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                    {stats.peers} {t('landing.nav.peers')}
                  </span>
                </div>
              </div>
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor"/><path d="M8 10h8M8 14h5"/></svg></span>
                  <span className="label">{t('landing.statbar.latestBlock')}</span>
                </div>
                <div className="lp-stat-val">#{stats.latestBlock ? stats.latestBlock.toLocaleString() : '—'}</div>
                <div className="lp-stat-meta lp-stat-hash">{shortHash(stats.blockHash)}</div>
              </div>
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico"><svg viewBox="0 0 24 24"><path d="M4 18l5-5 4 4 7-7"/><path d="M14 10h6v6"/></svg></span>
                  <span className="label">{t('landing.statbar.finalized')}</span>
                </div>
                <div className="lp-stat-val">#{stats.finalizedBlock ? stats.finalizedBlock.toLocaleString() : '—'}</div>
                <div className="lp-stat-meta">{t('landing.statbar.finalizedMeta')}</div>
              </div>
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico"><svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5"/></svg></span>
                  <span className="label">{t('landing.statbar.validators')}</span>
                </div>
                <div className="lp-stat-val">{stats.validators || '—'}</div>
                <div className="lp-stat-meta">{t('landing.statbar.validatorsMeta')}</div>
              </div>
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico"><svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor"/><circle cx="17" cy="11" r="2.4" fill="none" stroke="currentColor"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5M14 19c.3-2 2-3.4 4-3.4"/></svg></span>
                  <span className="label">{t('landing.statbar.collators')}</span>
                </div>
                <div className="lp-stat-val">{stats.collators || '—'}</div>
                <div className="lp-stat-meta">{t('landing.statbar.collatorsMeta')}</div>
              </div>
              <div className="lp-stat-tile">
                <div className="lp-stat-head">
                  <span className="ico"><svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5M16 11h5M16 14h3"/></svg></span>
                  <span className="label">{t('landing.statbar.nominators')}</span>
                </div>
                <div className="lp-stat-val">{stats.nominators ? stats.nominators.toLocaleString() : '—'}</div>
                <div className="lp-stat-meta">{t('landing.statbar.nominatorsMeta')}</div>
              </div>
            </div>
          </div>
        </section>

      {/* ── TICKER ──────────────────────────────────────────────────────── */}
      <div className="lp-ticker-band">
        <div className="lp-ticker">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <React.Fragment key={i}>
              <div className="lp-ticker-item">
                <span className="label">{item.label}</span>
                <span className="val">{String(item.val)}</span>
              </div>
              <div className="lp-ticker-sep" />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── LIVE STATS ──────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <span className="lp-eyebrow">{t('landing.network.eyebrow')}</span>
            <h2>{t('landing.network.h2')} <em>{t('landing.network.h2em')}</em></h2>
            <p>{t('landing.network.p')}</p>
          </div>
          <div className="lp-stats-grid lp-reveal">
            <div className="lp-stat-cell">
              <div className="lp-accent-bar" />
              <div className="label">{t('landing.network.activeProposals')}</div>
              <div className="val">
                <span
                  data-counter={stats.activeProposals}
                  data-counter-key="proposals"
                  ref={el => { if (el) counterRefs.current.set('proposals', el); }}
                >{stats.activeProposals}</span>
              </div>
              <div className="meta">
                <span className="up">{t('landing.network.proposalsMeta')}</span>
              </div>
            </div>
            <div className="lp-stat-cell">
              <div className="lp-accent-bar" />
              <div className="label">{t('landing.network.totalVoters')}</div>
              <div className="val">
                <span
                  data-counter={stats.totalVoters}
                  data-counter-key="voters"
                >{stats.totalVoters.toLocaleString()}</span>
              </div>
              <div className="meta">{t('landing.network.votersMeta')}</div>
            </div>
            <div className="lp-stat-cell">
              <div className="lp-accent-bar" />
              <div className="label">{t('landing.network.tokensStaked')}</div>
              <div className="val">{stats.tokensStakedPct}</div>
              <div className="meta">{t('landing.network.stakedMeta')}</div>
            </div>
            <div className="lp-stat-cell">
              <div className="lp-accent-bar" />
              <div className="label">{t('landing.network.citizens')}</div>
              <div className="val">
                <span
                  data-counter={stats.citizenCount}
                  data-counter-key="citizens"
                >{stats.citizenCount.toLocaleString()}</span>
              </div>
              <div className="meta">{t('landing.network.citizensMeta')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <span className="lp-eyebrow">{t('landing.features.eyebrow')}</span>
            <h2>{t('landing.features.h2')} <em>{t('landing.features.h2em')}</em></h2>
            <p>{t('landing.features.p')}</p>
          </div>
          <div className="lp-features-grid">
            <div className="lp-feat-card span-7 featured lp-reveal">
              <div className="lp-feat-eyebrow"><span className="num">01</span> · {t('landing.features.01.eyebrow')}</div>
              <h3>{t('landing.features.01.h3')}</h3>
              <p>{t('landing.features.01.p')}</p>
              <Link to="/governance/assembly" className="lp-feat-link">{t('landing.features.01.link')}</Link>
              <div className="lp-art">
                <div className="lp-art-vote">
                  {[30,55,42,78,48,62,35,88,51,68,40,72].map((h,i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="lp-feat-card span-5 lp-reveal d1">
              <div className="lp-feat-eyebrow"><span className="num">02</span> · {t('landing.features.02.eyebrow')}</div>
              <h3>{t('landing.features.02.h3')}</h3>
              <p>{t('landing.features.02.p')}</p>
              <button className="lp-feat-link" onClick={() => navigate('/login')}>{t('landing.features.02.link')}</button>
              <div className="lp-art">
                <div className="lp-art-citizen">
                  {['','on1','','on2','on1','','on3','','on2','','on1','on1','','on3','','on2','','on1','on2','','on1','','on3','on1'].map((c,i) => (
                    <span key={i} className={c} />
                  ))}
                </div>
              </div>
            </div>
            <div className="lp-feat-card span-5 lp-reveal">
              <div className="lp-feat-eyebrow"><span className="num">03</span> · {t('landing.features.03.eyebrow')}</div>
              <h3>{t('landing.features.03.h3')}</h3>
              <p>{t('landing.features.03.p')}</p>
              <Link to="/p2p" className="lp-feat-link">{t('landing.features.03.link')}</Link>
              <div className="lp-art">
                <div className="lp-art-trade"><div className="lp-art-trade-wave" /></div>
              </div>
            </div>
            <div className="lp-feat-card span-7 featured lp-reveal d1">
              <div className="lp-feat-eyebrow"><span className="num">04</span> · {t('landing.features.04.eyebrow')}</div>
              <h3>{stats.validators || 'N'} {t('landing.features.04.h3suffix')}</h3>
              <p>{t('landing.features.04.p')}</p>
              <Link to="/explorer" className="lp-feat-link">{t('landing.features.04.link')}</Link>
              <div className="lp-art">
                <div className="lp-art-validator">
                  <div className="col">
                    {[84,92,71,88,64].map((w,i) => (
                      <div key={i} className="row" style={{ '--w': `${w}%` } as React.CSSProperties} />
                    ))}
                  </div>
                  <div className="col" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textAlign: 'right' }}>
                    {['NODE-001','NODE-002','NODE-003','NODE-004','NODE-005'].map(n => <div key={n}>{n}</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE ────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-arch-wrap lp-reveal">
            <div className="lp-section-head" style={{ marginBottom: 0 }}>
              <span className="lp-eyebrow">{t('landing.arch.eyebrow')}</span>
              <h2>{t('landing.arch.h2')} <em>{t('landing.arch.h2em')}</em></h2>
              <p>{t('landing.arch.p')}</p>
            </div>
            <div className="lp-arch-chains">
              <div className="lp-arch-chain">
                <div className="lp-chain-tag">
                  <span className="lp-chain-dot" />
                  {t('landing.arch.rc.tag')}
                </div>
                <h4>{t('landing.arch.rc.h4')}</h4>
                <p>{t('landing.arch.rc.p')}</p>
                <div className="lp-chain-stats">
                  <div><span className="k">{t('landing.arch.stats.block')}</span><span className="v">{stats.latestBlock ? (stats.latestBlock / 1000000).toFixed(2) + 'M' : '—'}</span></div>
                  <div><span className="k">{t('landing.arch.stats.time')}</span><span className="v">6s</span></div>
                  <div><span className="k">{t('landing.arch.stats.validators')}</span><span className="v">{stats.validators || '—'}</span></div>
                </div>
              </div>
              <div className="lp-arch-chain">
                <div className="lp-chain-tag">
                  <span className="lp-chain-dot" />
                  {t('landing.arch.ah.tag')}
                </div>
                <h4>{t('landing.arch.ah.h4')}</h4>
                <p>{t('landing.arch.ah.p')}</p>
                <div className="lp-chain-stats">
                  <div><span className="k">{t('landing.arch.stats.staked')}</span><span className="v">{stats.tokensStakedPct}</span></div>
                  <div><span className="k">{t('landing.arch.stats.collators')}</span><span className="v">{stats.collators || '—'}</span></div>
                  <div><span className="k">{t('landing.arch.stats.nominators')}</span><span className="v">{stats.nominators ? stats.nominators.toLocaleString() : '—'}</span></div>
                </div>
              </div>
              <div className="lp-arch-chain">
                <div className="lp-chain-tag">
                  <span className="lp-chain-dot" />
                  {t('landing.arch.people.tag')}
                </div>
                <h4>{t('landing.arch.people.h4')}</h4>
                <p>{t('landing.arch.people.p')}</p>
                <div className="lp-chain-stats">
                  <div><span className="k">{t('landing.arch.stats.citizens')}</span><span className="v">{stats.citizenCount ? stats.citizenCount.toLocaleString() : '—'}</span></div>
                  <div><span className="k">{t('landing.arch.stats.countries')}</span><span className="v">187</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOKENOMICS ──────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <span className="lp-eyebrow">{t('landing.tok.eyebrow')}</span>
            <h2>{t('landing.tok.h2')} <em>{t('landing.tok.h2em')}</em></h2>
            <p>{t('landing.tok.p')}</p>
          </div>
          <div className="lp-reveal" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="lp-tok-tabs">
              <button
                className={`lp-tok-tab${tokTab === 'hez' ? ' active' : ''}`}
                data-tok="hez"
                onClick={() => setTokTab('hez')}
              >
                <span className="dot" /> {t('landing.tok.tabHez')}
              </button>
              <button
                className={`lp-tok-tab${tokTab === 'pez' ? ' active' : ''}`}
                data-tok="pez"
                onClick={() => setTokTab('pez')}
              >
                <span className="dot" /> {t('landing.tok.tabPez')}
              </button>
            </div>
          </div>

          {/* HEZ */}
          <div className={`lp-tok-panel lp-reveal${tokTab === 'hez' ? ' active' : ''}`}>
            <div>
              <div className="lp-tok-meta">
                <div className="item"><span className="k">Symbol</span><span className="v italic">HEZ</span></div>
                <div className="item"><span className="k">Total supply</span><span className="v">200,000,000</span></div>
                <div className="item"><span className="k">Type</span><span className="v">Utility</span></div>
                <div className="item"><span className="k">Inflation</span><span className="v">Fixed</span></div>
              </div>
              <div>
                {[
                  { color: 'var(--kurd-green)', name: 'Network fees & gas reserves', pct: '40.0%', amt: '80M HEZ' },
                  { color: 'var(--kurd-yellow)', name: 'Liquidity & market making', pct: '25.0%', amt: '50M HEZ' },
                  { color: 'var(--kurd-red)', name: 'Validator collateral pool', pct: '20.0%', amt: '40M HEZ' },
                  { color: '#6dd9c2', name: 'Ecosystem grants', pct: '10.0%', amt: '20M HEZ' },
                  { color: '#b48ee5', name: 'Core team (4y vesting)', pct: '5.0%', amt: '10M HEZ' },
                ].map(r => (
                  <div key={r.name} className="lp-tok-row">
                    <span className="swatch" style={{ background: r.color }} />
                    <span className="name">{r.name}</span>
                    <span className="pct">{r.pct}</span>
                    <span className="amt">{r.amt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-tok-chart">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-2)" strokeWidth="14"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-green)"  strokeWidth="14" strokeDasharray="100.5 251.3"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-yellow)" strokeWidth="14" strokeDasharray="62.8 251.3"  strokeDashoffset="-100.5"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-red)"    strokeWidth="14" strokeDasharray="50.3 251.3"  strokeDashoffset="-163.3"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#6dd9c2"             strokeWidth="14" strokeDasharray="25.1 251.3"  strokeDashoffset="-213.6"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#b48ee5"             strokeWidth="14" strokeDasharray="12.6 251.3"  strokeDashoffset="-238.7"/>
              </svg>
              <div className="center">
                <div className="big">200M</div>
                <div className="clabel">HEZ {t('landing.tok.total')}</div>
              </div>
            </div>
          </div>

          {/* PEZ */}
          <div className={`lp-tok-panel lp-reveal${tokTab === 'pez' ? ' active' : ''}`}>
            <div>
              <div className="lp-tok-meta">
                <div className="item"><span className="k">Symbol</span><span className="v italic">PEZ</span></div>
                <div className="item"><span className="k">Total supply</span><span className="v">5,000,000,000</span></div>
                <div className="item"><span className="k">Type</span><span className="v">Citizen reward</span></div>
                <div className="item"><span className="k">Emission</span><span className="v">Synthetic halving</span></div>
              </div>
              <div>
                {[
                  { color: 'var(--kurd-green)', name: 'Validator & nominator rewards', pct: '76.0%', amt: '3.80B PEZ' },
                  { color: 'var(--kurd-yellow)', name: 'Community treasury', pct: '15.0%', amt: '750M PEZ' },
                  { color: 'var(--kurd-red)', name: 'Citizen airdrop & trust rewards', pct: '5.0%', amt: '250M PEZ' },
                  { color: '#6dd9c2', name: 'Core development', pct: '1.875%', amt: '93.75M PEZ' },
                  { color: '#b48ee5', name: 'Presale contributors', pct: '1.875%', amt: '93.75M PEZ' },
                ].map(r => (
                  <div key={r.name} className="lp-tok-row">
                    <span className="swatch" style={{ background: r.color }} />
                    <span className="name">{r.name}</span>
                    <span className="pct">{r.pct}</span>
                    <span className="amt">{r.amt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-tok-chart">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-2)" strokeWidth="14"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-green)"  strokeWidth="14" strokeDasharray="191.0 251.3"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-yellow)" strokeWidth="14" strokeDasharray="37.7 251.3"  strokeDashoffset="-191.0"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--kurd-red)"    strokeWidth="14" strokeDasharray="12.6 251.3"  strokeDashoffset="-228.7"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#6dd9c2"             strokeWidth="14" strokeDasharray="4.7 251.3"   strokeDashoffset="-241.3"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#b48ee5"             strokeWidth="14" strokeDasharray="4.7 251.3"   strokeDashoffset="-246.0"/>
              </svg>
              <div className="center">
                <div className="big">5B</div>
                <div className="clabel">PEZ {t('landing.tok.total')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REFERRAL ────────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-ref-head lp-reveal">
            <span className="lp-eyebrow" style={{ color: 'var(--kurd-yellow-2)' }}>{t('landing.ref.eyebrow')}</span>
            <h2>{t('landing.ref.h2')} <em>{t('landing.ref.h2em')}</em></h2>
            <p>{t('landing.ref.p')}</p>
          </div>
          <div className="lp-ref-steps lp-reveal d1">
            {[
              { step: 's1', n: 1, labelKey: 'landing.ref.step1.label', titleKey: 'landing.ref.step1.title', descKey: 'landing.ref.step1.desc', char: '/ref-step1-character.png', wallet: '/ref-step1-wallet.png' },
              { step: 's2', n: 2, labelKey: 'landing.ref.step2.label', titleKey: 'landing.ref.step2.title', descKey: 'landing.ref.step2.desc', char: '/ref-step2-character.png', wallet: '/ref-step2-wallet.png' },
              { step: 's3', n: 3, labelKey: 'landing.ref.step3.label', titleKey: 'landing.ref.step3.title', descKey: 'landing.ref.step3.desc', char: '/ref-step3-character.png', wallet: '/ref-step3-wallet.png' },
            ].map(s => (
              <div key={s.step} className={`lp-ref-step ${s.step}`}>
                <div className="lp-ref-card">
                  <span className="lp-ref-num">{s.n}</span>
                  <div className="lp-ref-illus">
                    <div className="lp-ref-char"><img src={s.char} alt={t(s.titleKey)} /></div>
                    <div className="lp-ref-wallet"><img src={s.wallet} alt={t(s.titleKey)} /></div>
                  </div>
                </div>
                <div className="lp-step-label">{t(s.labelKey)}</div>
                <h4>{t(s.titleKey)}</h4>
                <p>{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-cta-band lp-reveal">
            <span className="lp-eyebrow">{t('landing.cta.eyebrow')}</span>
            <h2>{t('landing.cta.h2')} <em>{t('landing.cta.h2em')}</em></h2>
            <p>{t('landing.cta.p')}</p>
            <div className="lp-cta-btns">
              <button className="lp-btn lp-btn-accent" onClick={() => navigate('/login')}>{t('landing.cta.become')}</button>
              <button className="lp-btn lp-btn-outline" onClick={() => navigate('/explorer')}>{t('landing.cta.validator')}</button>
            </div>
            <div className="lp-services-block">
              <h4>{t('landing.cta.services')}</h4>
              <div className="lp-services-grid">
                {([
                  { label: 'Explorer',    to: '/explorer',    svgPath: <><circle cx="12" cy="12" r="9"/><path d="M15 9l-2.5 5.5L7 17l2.5-5.5z"/><circle cx="12" cy="12" r="1" fill="currentColor"/></> },
                  { label: 'Docs',        to: '/docs',        svgPath: <><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></> },
                  { label: 'Wallet',      to: '/login',       svgPath: <><path d="M3 9c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9V7a2 2 0 0 1 2-2h12"/><circle cx="17" cy="14" r="1.2" fill="currentColor"/></>, needsLogin: true },
                  { label: 'API',         to: '/api',         svgPath: <><path d="M9 7l-5 5 5 5M15 7l5 5-5 5M13 5l-2 14"/></> },
                  { label: 'Faucet',      to: '/faucet',      svgPath: <><path d="M12 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z"/><path d="M9 17c1 1.6 3 2.5 5 1.5"/></> },
                  { label: 'Developers',  to: '/developers',  svgPath: <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="11" r="2.4"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5"/><path d="M14 19c.3-2 2-3.4 4-3.4s3.7 1.4 4 3.4"/></> },
                  { label: 'Grants',      to: '/grants',      svgPath: <><path d="M14 4l6 6-9 9-6 1 1-6z"/><path d="M13 5l6 6"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/></>, needsLogin: true },
                  { label: 'Wiki',        to: '/wiki',        svgPath: <><path d="M5 5h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H10l-4 3V6a1 1 0 0 1 1-1z"/><circle cx="9" cy="11" r="0.9" fill="currentColor"/><circle cx="13" cy="11" r="0.9" fill="currentColor"/><circle cx="17" cy="11" r="0.9" fill="currentColor"/></> },
                  { label: 'Forum',       to: '/forum',       svgPath: <><circle cx="6" cy="7" r="1.6"/><circle cx="6" cy="17" r="1.6"/><circle cx="18" cy="12" r="1.6"/><path d="M7.4 7.5l9.2 4M7.4 16.5l9.2-4"/></> },
                  { label: 'Telemetry',   to: '/telemetry',   svgPath: <><rect x="3" y="5" width="18" height="5" rx="1.5"/><rect x="3" y="14" width="18" height="5" rx="1.5"/><circle cx="7" cy="7.5" r="0.9" fill="currentColor"/><circle cx="7" cy="16.5" r="0.9" fill="currentColor"/><path d="M11 7.5h7M11 16.5h7"/></> },
                ] as Array<{ label: string; to: string; svgPath: React.ReactNode; needsLogin?: boolean }>).map(s => (
                  <Link
                    key={s.label}
                    className={`lp-service-link${s.needsLogin ? ' needs-login' : ''}`}
                    to={s.to}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {s.svgPath}
                    </svg>
                    <span>{s.label}</span>
                    {s.needsLogin && <span className="lp-login-badge">Login</span>}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PALLETS ─────────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-section-head lp-reveal">
            <span className="lp-eyebrow">{t('landing.pallets.eyebrow')}</span>
            <h2>{t('landing.pallets.h2')} <em>{t('landing.pallets.h2em')}</em></h2>
            <p>{t('landing.pallets.p')}</p>
          </div>
          <div className="lp-pallet-grid lp-reveal d1">
            {/* Finance */}
            <div className="lp-pallet-card finance">
              <div className="lp-pallet-head">
                <div className="lp-pallet-head-l">
                  <span className="lp-glyph-mark">F</span>
                  <h3>{t('landing.pallets.finance')}</h3>
                </div>
                <span className="lp-pallet-count"><b>8</b> {t('landing.pallets.financeCount').replace(/^\d+\s*/, '')}</span>
              </div>
              <div className="lp-pallet-items">
                <PalletItem icon="lp-i-wallet"  label={t('landing.pallets.wallet')}    to="/wallet" requiresLogin />
                <PalletItem icon="lp-i-bank"    label={t('landing.pallets.bank')}      to="/finance/bank" requiresLogin />
                <PalletItem imgSrc="/PezkuwiExchange.png" label={t('landing.pallets.exchange')} external="https://pex.network" />
                <PalletItem icon="lp-i-dex"     label={t('landing.pallets.dex')}       to="/dex" requiresLogin />
                <PalletItem icon="lp-i-p2p"     label={t('landing.pallets.p2p')}       to="/p2p" requiresLogin />
                <PalletItem icon="lp-i-b2b"     label={t('landing.pallets.b2b')}       to="/bereketli" requiresLogin />
                <PalletItem icon="lp-i-zekat"   label={t('landing.pallets.zekat')}     to="/finance/zekat" />
                <PalletItem icon="lp-i-rocket"  label={t('landing.pallets.launchpad')} to="/launchpad" />
              </div>
            </div>
            {/* Governance */}
            <div className="lp-pallet-card governance">
              <div className="lp-pallet-head">
                <div className="lp-pallet-head-l">
                  <span className="lp-glyph-mark">G</span>
                  <h3>{t('landing.pallets.governance')}</h3>
                </div>
                <span className="lp-pallet-count"><b>8</b> {t('landing.pallets.governanceCount').replace(/^\d+\s*/, '')}</span>
              </div>
              <div className="lp-pallet-items">
                <PalletItem icon="lp-i-crown"    label={t('landing.pallets.president')}  to="/elections" requiresLogin />
                <PalletItem icon="lp-i-assembly" label={t('landing.pallets.assembly')}   to="/governance/assembly" />
                <PalletItem icon="lp-i-vote"     label={t('landing.pallets.vote')}       to="/elections" requiresLogin />
                <PalletItem icon="lp-i-shield"   label={t('landing.pallets.validators')} to="/wallet" />
                <PalletItem icon="lp-i-justice"  label={t('landing.pallets.justice')}    to="/governance/justice" />
                <PalletItem icon="lp-i-proposal" label={t('landing.pallets.proposals')}  to="/citizens/government" />
                <PalletItem icon="lp-i-poll"     label={t('landing.pallets.polls')}      to="/governance/polls" />
                <PalletItem icon="lp-i-id"       label={t('landing.pallets.identity')}   to="/identity" requiresLogin />
              </div>
            </div>
            {/* Social */}
            <div className="lp-pallet-card social">
              <div className="lp-pallet-head">
                <div className="lp-pallet-head-l">
                  <span className="lp-glyph-mark">S</span>
                  <h3>{t('landing.pallets.social')}</h3>
                </div>
                <span className="lp-pallet-count">{t('landing.pallets.socialCount')}</span>
              </div>
              <div className="lp-pallet-items">
                <PalletItem icon="lp-i-chat"   label={t('landing.pallets.whatskurd')}  to="/social/whatskurd" requiresLogin />
                <PalletItem icon="lp-i-forum"  label={t('landing.pallets.forum')}      to="/forum" />
                <PalletItem icon="lp-i-media"  label={t('landing.pallets.kurdmedia')}  to="/social/kurdmedia" requiresLogin />
                <PalletItem icon="lp-i-cal"    label={t('landing.pallets.events')}     locked />
                <PalletItem icon="lp-i-help"   label={t('landing.pallets.help')}       to="/help" />
                <PalletItem icon="lp-i-music"  label={t('landing.pallets.music')}      locked />
                <PalletItem imgSrc="/rewshenbir-icon.png" label={t('landing.pallets.rewshenbir')} external="https://rewshenbir.pezkuwi.app" />
                <PalletItem icon="lp-i-ref"    label={t('landing.pallets.referral')}   to="/dashboard" requiresLogin />
              </div>
            </div>
            {/* Education */}
            <div className="lp-pallet-card education">
              <div className="lp-pallet-head">
                <div className="lp-pallet-head-l">
                  <span className="lp-glyph-mark">E</span>
                  <h3>{t('landing.pallets.education')}</h3>
                </div>
                <span className="lp-pallet-count">{t('landing.pallets.educationCount')}</span>
              </div>
              <div className="lp-pallet-items">
                <PalletItem icon="lp-i-cap"      label={t('landing.pallets.university')}   to="/education/university" />
                <PalletItem icon="lp-i-book"     label={t('landing.pallets.perwerde')}     to="/education" requiresLogin />
                <PalletItem icon="lp-i-trophy"   label={t('landing.pallets.certificates')} to="/education/certificates" />
                <PalletItem icon="lp-i-research" label={t('landing.pallets.research')}     to="/education/research" />
                <PalletItem icon="lp-i-library"  label={t('landing.pallets.library')}      locked />
                <PalletItem icon="lp-i-pen"      label={t('landing.pallets.tutor')}        locked />
                <PalletItem icon="lp-i-lab"      label={t('landing.pallets.labs')}         locked />
                <PalletItem icon="lp-i-globe"    label={t('landing.pallets.languages')}    locked />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-foot-grid">
            <div className="lp-foot-brand">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="lp-logo-mark" style={{ width: 28, height: 28 }} />
                <h4>PezkuwiChain</h4>
              </div>
              <p>{t('landing.footer.desc')}</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="lp-status-dot" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>{t('landing.footer.mainnet')}</span>
              </div>
            </div>
            <div className="lp-foot-col">
              <h5>{t('landing.footer.network')}</h5>
              <ul>
                <li><a href="/network">{t('landing.footer.explorer')}</a></li>
                <li><a href="/telemetry">{t('landing.footer.telemetry')}</a></li>
                <li><a href="/network">{t('landing.footer.validators')}</a></li>
                <li><a href="/faucet">{t('landing.footer.faucet')}</a></li>
              </ul>
            </div>
            <div className="lp-foot-col">
              <h5>{t('landing.footer.use')}</h5>
              <ul>
                <li><a href="/wallet">{t('landing.footer.wallet')}</a></li>
                <li><a href="/p2p">{t('landing.footer.trade')}</a></li>
                <li><a href="/">{t('landing.footer.vote')}</a></li>
                <li><a href="/grants">{t('landing.footer.grants')}</a></li>
              </ul>
            </div>
            <div className="lp-foot-col">
              <h5>{t('landing.footer.build')}</h5>
              <ul>
                <li><a href="/docs">{t('landing.footer.docs')}</a></li>
                <li><a href="/api">{t('landing.footer.api')}</a></li>
                <li><a href="/developers">{t('landing.footer.sdk')}</a></li>
                <li><a href="https://github.com/pezkuwichain" target="_blank" rel="noopener noreferrer">{t('landing.footer.github')}</a></li>
              </ul>
            </div>
            <div className="lp-foot-col">
              <h5>{t('landing.footer.community')}</h5>
              <ul>
                <li><a href="/forum">{t('landing.footer.forum')}</a></li>
                <li><a href="https://discord.gg/pezkuwichain" target="_blank" rel="noopener noreferrer">{t('landing.footer.discord')}</a></li>
                <li><a href="https://t.me/PezkuwiApp" target="_blank" rel="noopener noreferrer">{t('landing.footer.telegram')}</a></li>
                <li><a href="https://x.com/PezkuwiChain" target="_blank" rel="noopener noreferrer">{t('landing.footer.twitter')}</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>{t('landing.footer.copyright')}</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span className="lp-foot-flag" title="Kurdish flag" />
              <span className="lp-foot-kurdish-text">{t('landing.footer.builtBy')}</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPageDesktop;
