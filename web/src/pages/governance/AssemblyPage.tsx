import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { languages } from '@/i18n/config';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ASSEMBLY_CSS } from './assembly/_css';

// Pro design ported from "Kurdistan Parliament" — on-chain governance landing.
// Content is fully localized into the app's 6 standard languages; each variant is
// lazy-loaded so only the active language ships. Hemicycle seat tooltip wired below.
const LOADERS: Record<string, () => Promise<{ HTML: string }>> = {
  en: () => import('./assembly/en'),
  tr: () => import('./assembly/tr'),
  kmr: () => import('./assembly/kmr'),
  ckb: () => import('./assembly/ckb'),
  fa: () => import('./assembly/fa'),
  ar: () => import('./assembly/ar'),
};
// i18n language code -> assembly variant file
const MAP: Record<string, string> = {
  en: 'en', tr: 'tr', 'ku-kurmanji': 'kmr', 'ku-sorani': 'ckb', ar: 'ar', fa: 'fa',
};

export default function AssemblyPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const fkey = MAP[i18n.language] || 'en';
  const dir = (languages as Record<string, { dir: string }>)[i18n.language]?.dir || 'ltr';
  const [html, setHtml] = useState('');

  useEffect(() => {
    let alive = true;
    (LOADERS[fkey] || LOADERS.en)().then((m) => { if (alive) setHtml(m.HTML); });
    return () => { alive = false; };
  }, [fkey]);

  // hemicycle seat tooltip (ported from the design's support.js _wire)
  useEffect(() => {
    if (!html) return;
    const root = document.getElementById('khemi');
    const tip = document.getElementById('khemi-tip');
    if (!root || !tip) return;
    const dot = tip.querySelector('[data-tdot]') as HTMLElement | null;
    const nm = tip.querySelector('[data-tname]') as HTMLElement | null;
    const bl = tip.querySelector('[data-tbloc]') as HTMLElement | null;
    const rg = tip.querySelector('[data-tregion]') as HTMLElement | null;
    const onMove = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('[data-mp]') as HTMLElement | null;
      if (!el) { tip.style.display = 'none'; return; }
      if (nm) nm.textContent = el.getAttribute('data-name');
      if (bl) bl.textContent = el.getAttribute('data-bloc');
      if (rg) rg.textContent = el.getAttribute('data-region');
      if (dot) dot.style.background = el.getAttribute('data-color') || '#888';
      const r = root.getBoundingClientRect();
      tip.style.display = 'block';
      let x = e.clientX - r.left;
      x = Math.max(90, Math.min(x, r.width - 90));
      tip.style.left = x + 'px';
      tip.style.top = (e.clientY - r.top - 14) + 'px';
    };
    const onLeave = () => { tip.style.display = 'none'; };
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onLeave);
    return () => {
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, [html]);

  const startSide = dir === 'rtl' ? { right: 14 } : { left: 14 };
  const navPad = dir === 'rtl'
    ? '.kp-root header{padding-right:72px !important;padding-left:120px !important;}'
    : '.kp-root header{padding-left:72px !important;padding-right:120px !important;}';

  return (
    <div className="kp-root" dir={dir} style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: ASSEMBLY_CSS + '\n' + navPad }} />

      {/* back to governance */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        style={{
          position: 'fixed', top: 13, zIndex: 101, width: 40, height: 40, borderRadius: 10,
          background: 'rgba(15,19,24,.92)', border: '1px solid #2D3540', color: '#E8ECF0',
          fontSize: 18, lineHeight: '38px', cursor: 'pointer', backdropFilter: 'blur(8px)',
          ...startSide,
        }}
      >{dir === 'rtl' ? '→' : '←'}</button>

      {/* language switcher (6-language standard) */}
      <div
        style={{
          position: 'fixed', top: 11, zIndex: 101,
          background: 'rgba(15,19,24,.92)', border: '1px solid #2D3540', borderRadius: 10,
          backdropFilter: 'blur(8px)', color: '#E8ECF0',
          ...(dir === 'rtl' ? { left: 14 } : { right: 14 }),
        }}
      >
        <LanguageSwitcher />
      </div>

      {html
        ? <div dangerouslySetInnerHTML={{ __html: html }} />
        : <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#5A6475' }}>…</div>}
    </div>
  );
}
