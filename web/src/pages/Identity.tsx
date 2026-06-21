import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileShell from '@/components/MobileShell';
import { useDashboard } from '@/contexts/DashboardContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import {
  Save, CreditCard, BookOpen, Camera, RotateCw,
  Hash, Wallet, ScanFace, CalendarClock, Landmark, Phone,
} from 'lucide-react';

// ── Types ──
interface IdentityData {
  fullName: string;       // given name(s)
  surname: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: 'M' | 'F' | '';
  bloodType: string;
  citizenNumber: string;
  passportNumber: string;
  photo: string; // base64 data URL
}

const DEFAULT_DATA: IdentityData = {
  fullName: '', surname: '', fatherName: '', motherName: '',
  dateOfBirth: '', placeOfBirth: '', gender: '', bloodType: '',
  citizenNumber: '', passportNumber: '', photo: '',
};

const STORAGE_KEY = 'pezkuwi_identity_data';
const SUN = '/kurdistan_sun_light.svg';

// ── Helpers ──
function generatePassportNo(citizenNo: string): string {
  if (!citizenNo) return 'KRD-000000';
  return `KRD-${citizenNo.replace(/\D/g, '').slice(0, 6).padStart(6, '0')}`;
}

function formatMRZ(data: IdentityData): [string, string] {
  const sur = (data.surname || data.fullName.trim().split(/\s+/).slice(-1)[0] || 'KURDISTANI')
    .toUpperCase().replace(/[^A-Z ]/g, '').replace(/ /g, '<');
  const given = (data.surname ? data.fullName : data.fullName.trim().split(/\s+/).slice(0, -1).join(' '))
    .toUpperCase().replace(/[^A-Z ]/g, '').replace(/ /g, '<') || 'AZAD';
  const namePart = `${sur}<<${given}`;
  const line1 = `P<KUD${namePart}${'<'.repeat(44)}`.slice(0, 44);
  const dob = data.dateOfBirth.replace(/-/g, '').slice(2) || '000000';
  const exp = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); return d.toISOString().slice(2, 10).replace(/-/g, ''); })();
  const sex = data.gender || '<';
  const pno = (data.passportNumber.replace(/[^A-Z0-9]/g, '') || 'A0000000').padEnd(9, '<').slice(0, 9);
  const line2 = `${pno}1KUD${dob}1${sex}${exp}${'<'.repeat(14)}00`.slice(0, 44);
  return [line1, line2];
}

const today = new Date();
const issueDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const expiryDate = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate())
  .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

function fmtDOB(v: string) { return v ? new Date(v).toLocaleDateString('en-GB') : '—'; }
function shortAddr(a?: string | null) { return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—'; }

// ── Main Component ──
export default function Identity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { citizenNumber: nftCitizenNumber } = useDashboard();
  const { selectedAccount } = usePezkuwi();
  const walletAddr = selectedAccount?.address || '';
  const [tab, setTab] = useState<'id' | 'passport'>('id');
  const [data, setData] = useState<IdentityData>(DEFAULT_DATA);
  const [saved, setSaved] = useState(false);
  const [idBack, setIdBack] = useState(false);
  const [passData, setPassData] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setData({ ...DEFAULT_DATA, ...JSON.parse(raw) }); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (nftCitizenNumber && nftCitizenNumber !== 'N/A') {
      setData(prev => ({ ...prev, citizenNumber: nftCitizenNumber, passportNumber: generatePassportNo(nftCitizenNumber) }));
    }
  }, [nftCitizenNumber]);

  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 320;
        let w = img.width, h = img.height;
        if (w > h) { h = (h / w) * maxSize; w = maxSize; } else { w = (w / h) * maxSize; h = maxSize; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setData(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.82) }));
        setSaved(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field: keyof IdentityData, value: string) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'citizenNumber') next.passportNumber = generatePassportNo(value);
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [mrzLine1, mrzLine2] = formatMRZ(data);
  const openPhoto = () => photoInputRef.current?.click();

  const content = (
    <div className="bg-gray-950 min-h-full">
      {/* Tab switcher */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        <button onClick={() => setTab('id')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors
            ${tab === 'id' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500'}`}>
          <CreditCard className="w-4 h-4" />{t('identity.idCard', 'e-ID Card')}
        </button>
        <button onClick={() => setTab('passport')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors
            ${tab === 'passport' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500'}`}>
          <BookOpen className="w-4 h-4" />{t('identity.passport', 'Passport')}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoSelect} />

        {tab === 'id' ? (
          <FlipCard aspectClass="aspect-[1.586/1]" flipped={idBack} onFlip={() => setIdBack(v => !v)}
            front={<IDFront data={data} walletAddr={walletAddr} onPhotoClick={openPhoto} />}
            back={<IDBack data={data} walletAddr={walletAddr} />} />
        ) : (
          <FlipCard aspectClass="aspect-[0.71/1]" flipped={passData} onFlip={() => setPassData(v => !v)}
            front={<PassportCover />}
            back={<PassportDataPage data={data} mrzLine1={mrzLine1} mrzLine2={mrzLine2} onPhotoClick={openPhoto} />} />
        )}

        <p className="text-[10px] text-gray-500 text-center -mt-1">
          {tab === 'id'
            ? t('identity.tapFlipId', 'Tap ↻ to see the back of your e-ID')
            : t('identity.tapFlipPass', 'Tap ↻ to open the passport data page')}
        </p>

        {/* ── FORM ── */}
        <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-bold text-white mb-2">{t('identity.personalInfo', 'Personal Information')}</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('identity.givenName', 'Given Name(s)')} value={data.fullName}
              onChange={v => handleChange('fullName', v)} placeholder="Azad" />
            <FormField label={t('identity.surname', 'Surname')} value={data.surname}
              onChange={v => handleChange('surname', v)} placeholder="Kurdistanî" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('identity.dateOfBirth', 'Date of Birth')} value={data.dateOfBirth}
              onChange={v => handleChange('dateOfBirth', v)} type="date" />
            <div>
              <label className="text-[10px] text-gray-400 font-medium block mb-1">{t('identity.gender', 'Sex')}</label>
              <select value={data.gender} onChange={e => handleChange('gender', e.target.value as 'M' | 'F' | '')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">—</option>
                <option value="M">{t('identity.male', 'Male')}</option>
                <option value="F">{t('identity.female', 'Female')}</option>
              </select>
            </div>
          </div>

          <FormField label={t('identity.placeOfBirth', 'Place of Birth')} value={data.placeOfBirth}
            onChange={v => handleChange('placeOfBirth', v)} placeholder="Hewlêr" />

          <FormField label={t('identity.citizenNo', 'ID Number')} value={data.citizenNumber}
            onChange={v => handleChange('citizenNumber', v)} placeholder="KRD-000000"
            readOnly={!!(nftCitizenNumber && nftCitizenNumber !== 'N/A')} />

          <button onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
              ${saved ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-lg'}`}>
            <Save className="w-4 h-4" />{saved ? t('identity.saved', 'Saved!') : t('identity.save', 'Save to Device')}
          </button>

          <p className="text-[10px] text-gray-500 text-center">
            {t('identity.localOnly', 'Data is stored only on your device. Never uploaded.')}
          </p>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );

  if (isMobile) return <MobileShell title={`🆔 ${t('identity.title', 'Identity')}`}>{content}</MobileShell>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto py-8">
        <button onClick={() => navigate('/')} className="mb-4 text-sm text-gray-400 hover:text-white">
          ← {t('common.backToHome', 'Back to Home')}
        </button>
        {content}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Flip card shell
// ════════════════════════════════════════════════════════════
function FlipCard({ flipped, aspectClass, front, back, onFlip }: {
  flipped: boolean; aspectClass: string; front: React.ReactNode; back: React.ReactNode; onFlip: () => void;
}) {
  return (
    <div className={`relative w-full ${aspectClass}`} style={{ perspective: '1600px' }}>
      <div className="absolute inset-0 transition-transform duration-700"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>{front}</div>
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>{back}</div>
      </div>
      <button onClick={onFlip} title="Flip"
        className="absolute -bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-amber-500 text-black shadow-lg flex items-center justify-center active:scale-90 transition-transform">
        <RotateCw className="w-4 h-4" />
      </button>
    </div>
  );
}

// Holographic light surface (e-ID)
const HOLO_BG: React.CSSProperties = {
  background:
    'linear-gradient(135deg,#eef3f8 0%,#f3ecf6 22%,#e9f5f0 46%,#f5f0e6 68%,#eaf0f8 100%)',
};
function HoloSheen() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage:
        'repeating-linear-gradient(115deg,rgba(255,255,255,0) 0px,rgba(255,255,255,.35) 2px,rgba(180,210,255,.12) 5px,rgba(255,200,230,.12) 9px,rgba(255,255,255,0) 13px)',
      mixBlendMode: 'screen', opacity: .5,
    }} />
  );
}

// Newroz-sun emblem in a soft disc
function SunEmblem({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: 'radial-gradient(circle at 50% 40%,#fff3cf,#f4b41a 60%,#e0871a)' }}>
      <img src={SUN} alt="" style={{ width: size * 0.82, height: size * 0.82, objectFit: 'contain' }} />
    </span>
  );
}

// Stylized gold ram (mouflon) emblem — passport signature
function RamEmblem({ size = 96, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 112" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="ramGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e08a" /><stop offset=".5" stopColor="#d9b24a" /><stop offset="1" stopColor="#9c7a23" />
        </linearGradient>
      </defs>
      <g stroke="url(#ramGold)" strokeWidth="7.5" strokeLinecap="round" fill="none">
        <path d="M60 32 C42 20 18 24 14 46 C11 65 28 73 39 64 C48 57 43 45 34 48" />
        <path d="M60 32 C78 20 102 24 106 46 C109 65 92 73 81 64 C72 57 77 45 86 48" />
      </g>
      <path d="M45 37 C36 33 28 37 27 44 C34 45 41 43 47 41 Z" fill="url(#ramGold)" />
      <path d="M75 37 C84 33 92 37 93 44 C86 45 79 43 73 41 Z" fill="url(#ramGold)" />
      <path d="M60 34 C73 34 79 45 79 60 C79 79 71 96 60 103 C49 96 41 79 41 60 C41 45 47 34 60 34 Z" fill="url(#ramGold)" />
      <path d="M60 72 C66 72 69 81 60 95 C51 81 54 72 60 72 Z" fill="#6f5417" opacity=".55" />
      <ellipse cx="51.5" cy="57" rx="3" ry="4.2" fill="#3a2c0e" />
      <ellipse cx="68.5" cy="57" rx="3" ry="4.2" fill="#3a2c0e" />
    </svg>
  );
}

// Decorative QR-style block (deterministic from the ID, not a scannable code)
function FauxQR({ seed, size = 46 }: { seed: string; size?: number }) {
  const n = 11;
  let h = 2166136261; for (const c of (seed || 'KRD')) { h ^= c.charCodeAt(0); h = (h * 16777619) >>> 0; }
  const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const cells: React.ReactNode[] = [];
  const finder = (x: number, y: number) => (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g><rect x={x} y={y} width="3" height="3" /><rect x={x + 0.6} y={y + 0.6} width="1.8" height="1.8" fill="#fff" /><rect x={x + 1} y={y + 1} width="1" height="1" /></g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} fill="#1c2530" style={{ borderRadius: 4 }}>
      <rect x="0" y="0" width={n} height={n} fill="#fff" />
      {cells}
      <Finder x={0} y={0} /><Finder x={n - 3} y={0} /><Finder x={0} y={n - 3} />
    </svg>
  );
}

function PhotoBox({ photo, onClick, className = '' }: { photo: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick}
      className={`relative overflow-hidden flex items-center justify-center group bg-gradient-to-b from-slate-100 to-slate-300 ${className}`}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" />
        : <span className="text-3xl opacity-60">👤</span>}
      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="w-4 h-4 text-white" />
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════
//  e-ID — FRONT
// ════════════════════════════════════════════════════════════
function IDFront({ data, walletAddr, onPhotoClick }: { data: IdentityData; walletAddr: string; onPhotoClick: () => void }) {
  return (
    <div className="absolute inset-0 text-slate-800" style={HOLO_BG}>
      <HoloSheen />
      {/* faint sun watermark */}
      <img src={SUN} alt="" className="absolute -right-6 top-6 w-40 h-40 opacity-[0.06] pointer-events-none" />

      <div className="relative h-full px-[5%] py-[5%] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between">
          <div className="leading-tight">
            <p className="font-extrabold tracking-tight text-slate-900" style={{ fontSize: 'clamp(9px,3.1vw,15px)' }}>
              BÊ KURDISTAN JÎYANE NÎNE
            </p>
            <p className="text-slate-500 font-medium" style={{ fontSize: 'clamp(5px,1.5vw,8px)', letterSpacing: '.04em' }}>
              DEMOCRACY · FEDERALISM · PEACE · DIGITAL INNOVATION
            </p>
          </div>
          <SunEmblem size={30} className="shadow shrink-0" />
        </div>

        {/* body */}
        <div className="flex gap-[4%] mt-[3%] flex-1 min-h-0">
          <div className="flex flex-col items-center gap-1 shrink-0" style={{ width: '26%' }}>
            <PhotoBox photo={data.photo} onClick={onPhotoClick} className="w-full aspect-[3/4] rounded-md border border-white/70 shadow" />
            {/* gold chip + DIGITAL ID */}
            <div className="mt-0.5 w-7 h-5 rounded-[3px] bg-gradient-to-br from-yellow-300 to-amber-600 border border-amber-700/40"
              style={{ backgroundImage: 'linear-gradient(135deg,#f6d365,#c08a2d)' }} />
            <p className="text-[6px] tracking-wider text-slate-500 font-semibold">DIGITAL ID</p>
          </div>

          <div className="flex-1 min-w-0 grid content-start gap-[2.5%]">
            <Field k="NAV / NAME" v={data.fullName || '—'} strong />
            <Field k="PASNAV / SURNAME" v={data.surname || '—'} strong />
            <Field k="DÎROKA JIDAYIKBÛNÊ / DATE OF BIRTH" v={fmtDOB(data.dateOfBirth)} />
            <Field k="HEMWELATÎ / NATIONALITY" v="KURDISTANÎ / KURDISH" />
            <Field k="JIMAREYA NASNAMÊ / ID NUMBER" v={data.citizenNumber || 'KRD-000000'} mono />
          </div>

          <div className="shrink-0 self-end pb-1"><FauxQR seed={data.citizenNumber || walletAddr} size={42} /></div>
        </div>
      </div>

      {/* footer bar */}
      <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-amber-300 px-[5%] py-1 flex items-center justify-between">
        <span className="font-bold tracking-wide" style={{ fontSize: 'clamp(7px,2.3vw,11px)' }}>e-ID: KOMARA KURDISTAN</span>
        <span className="text-amber-200/70" style={{ fontSize: 'clamp(5px,1.6vw,8px)' }}>کۆماری کوردستان</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  e-ID — BACK
// ════════════════════════════════════════════════════════════
function IDBack({ data, walletAddr }: { data: IdentityData; walletAddr: string }) {
  const rows = [
    { Icon: Hash, label: 'ID NUMBER', val: data.citizenNumber || 'KRD-000000' },
    { Icon: Wallet, label: 'DIGITAL WALLET ID', val: shortAddr(walletAddr) },
    { Icon: ScanFace, label: 'BIOMETRIC ENROLMENT', val: 'YES — Face / Fingerprint' },
    { Icon: CalendarClock, label: 'VALID UNTIL', val: expiryDate },
    { Icon: Landmark, label: 'ACCESS GOVERNMENT SERVICES', val: 'apps.pezkuwichain.io' },
    { Icon: Phone, label: 'SUPPORT & INFORMATION', val: 'pezkuwichain.io' },
  ];
  return (
    <div className="absolute inset-0 text-slate-800" style={HOLO_BG}>
      <HoloSheen />
      <img src={SUN} alt="" className="absolute -left-8 bottom-2 w-44 h-44 opacity-[0.05] pointer-events-none" />

      <div className="relative h-full px-[5%] py-[4.5%] flex flex-col">
        <p className="font-extrabold text-slate-900 tracking-tight" style={{ fontSize: 'clamp(10px,3.4vw,16px)' }}>
          DIGITAL KURDISTAN STATE
        </p>
        <div className="h-px bg-gradient-to-r from-red-500 via-amber-400 to-green-600 my-[2%]" />

        <div className="grid gap-[2.2%] content-start flex-1">
          {rows.map(({ Icon, label, val }) => (
            <div key={label} className="flex items-center gap-[3%]">
              <span className="shrink-0 rounded-md bg-slate-900/90 text-amber-300 flex items-center justify-center"
                style={{ width: 'clamp(16px,5vw,24px)', height: 'clamp(16px,5vw,24px)' }}>
                <Icon style={{ width: '60%', height: '60%' }} />
              </span>
              <div className="min-w-0">
                <p className="text-slate-500 font-semibold leading-none" style={{ fontSize: 'clamp(5px,1.7vw,8px)', letterSpacing: '.03em' }}>{label}</p>
                <p className="text-slate-900 font-bold leading-tight truncate font-mono" style={{ fontSize: 'clamp(7px,2.2vw,11px)' }}>{val}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-300/60 pt-[2%]">
          <div className="leading-tight">
            <p className="font-bold text-slate-700" style={{ fontSize: 'clamp(6px,1.9vw,9px)' }}>DIGITAL IDENTITY COMMISSION</p>
            <p className="text-slate-500" style={{ fontSize: 'clamp(5px,1.5vw,7px)' }}>Digital Identity Authority · Kurdistan State</p>
          </div>
          <SunEmblem size={26} className="shadow" />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Passport — COVER (navy + gold ram)
// ════════════════════════════════════════════════════════════
function PassportCover() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between text-center py-[10%] px-[8%]"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%,#243657 0%,#16213c 45%,#0c1424 100%)' }}>
      <div className="absolute inset-2 rounded-xl border border-amber-300/25 pointer-events-none" />

      <div className="relative">
        <p className="text-amber-300/90 font-semibold" style={{ fontSize: 'clamp(8px,3vw,13px)', letterSpacing: '.05em' }} dir="rtl">پاسپۆرتی کۆماری کوردستان</p>
        <p className="text-amber-200/70 mt-1 font-medium" style={{ fontSize: 'clamp(7px,2.4vw,11px)', letterSpacing: '.12em' }}>REPUBLIC OF DIJITAL KURDISTAN</p>
      </div>

      <RamEmblem size={120} className="relative drop-shadow-[0_4px_10px_rgba(0,0,0,.5)]" />

      <div className="relative">
        <p className="text-amber-300 font-extrabold" style={{ fontSize: 'clamp(13px,5vw,22px)', letterSpacing: '.18em' }}>PASSPORT</p>
        <p className="text-amber-200/70 mt-1 font-medium" style={{ fontSize: 'clamp(7px,2.3vw,11px)', letterSpacing: '.1em' }}>PASAPORTA KOMARA KURDISTAN</p>
        <span className="inline-block mt-2 w-5 h-4 rounded-[2px] border border-amber-300/50"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,#d9b24a 0 1px,transparent 1px 3px)' }} title="biometric" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Passport — DATA PAGE
// ════════════════════════════════════════════════════════════
function PassportDataPage({ data, mrzLine1, mrzLine2, onPhotoClick }: {
  data: IdentityData; mrzLine1: string; mrzLine2: string; onPhotoClick: () => void;
}) {
  const sex = data.gender === 'M' ? 'NÊR / MALE' : data.gender === 'F' ? 'JIN / FEMALE' : '—';
  return (
    <div className="absolute inset-0 text-slate-800" style={HOLO_BG}>
      <HoloSheen />
      <RamEmblem size={150} className="absolute right-[-12%] bottom-[14%] opacity-[0.07] pointer-events-none" />

      <div className="relative h-full px-[5%] py-[5%] flex flex-col">
        {/* header with flag stripe */}
        <div className="flex items-center gap-[3%]">
          <span className="shrink-0 rounded-sm overflow-hidden border border-white/60 flex flex-col" style={{ width: '13%', aspectRatio: '3/2' }}>
            <span className="flex-1 bg-red-600" /><span className="flex-1 bg-white relative">
              <img src={SUN} alt="" className="absolute inset-0 m-auto h-[80%]" /></span><span className="flex-1 bg-green-600" />
          </span>
          <div className="leading-tight min-w-0">
            <p className="font-extrabold text-slate-900 truncate" style={{ fontSize: 'clamp(8px,2.8vw,13px)' }}>KOMARA KURDISTAN</p>
            <p className="text-slate-500 font-medium truncate" style={{ fontSize: 'clamp(5px,1.6vw,8px)' }}>REPUBLIC OF DIJITAL KURDISTAN</p>
          </div>
          <p className="ml-auto text-slate-500 font-semibold" dir="rtl" style={{ fontSize: 'clamp(6px,2vw,10px)' }}>کۆماری کوردستان</p>
        </div>

        <div className="h-px bg-gradient-to-r from-red-500 via-amber-400 to-green-600 my-[3%]" />

        <div className="flex gap-[4%] flex-1 min-h-0">
          <div className="flex-1 min-w-0 grid content-start gap-[3%]">
            <div className="flex gap-[6%]">
              <Field k="CURE / TYPE" v="P" />
              <Field k="KOD / CODE" v="KUD" />
            </div>
            <Field k="NAV / GIVEN NAME" v={data.fullName || '—'} strong />
            <Field k="PASNAV / SURNAME" v={data.surname || '—'} strong />
            <Field k="DÎROKA JIDAYIKBÛNÊ / DATE OF BIRTH" v={fmtDOB(data.dateOfBirth)} />
            <Field k="HEMWELATÎ / NATIONALITY" v="KURDISTANÎ / KURDISH" />
            <div className="flex gap-[6%]">
              <Field k="ZAYÎ / SEX" v={sex} />
              <Field k="JIMARE / ID NO" v={data.citizenNumber || 'KRD-000000'} mono />
            </div>
          </div>
          <PhotoBox photo={data.photo} onClick={onPhotoClick}
            className="shrink-0 self-start rounded-md border border-white/70 shadow" />
        </div>

        {/* MRZ */}
        <div className="mt-[3%] bg-white/85 rounded px-[3%] py-[2%] font-mono text-slate-800 leading-snug">
          <p className="break-all" style={{ fontSize: 'clamp(5px,1.8vw,9px)', letterSpacing: '.08em' }}>{mrzLine1}</p>
          <p className="break-all" style={{ fontSize: 'clamp(5px,1.8vw,9px)', letterSpacing: '.08em' }}>{mrzLine2}</p>
        </div>
      </div>
    </div>
  );
}

// ── small field renderer (document style) ──
function Field({ k, v, strong, mono }: { k: string; v: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500 font-semibold leading-none" style={{ fontSize: 'clamp(5px,1.55vw,8px)', letterSpacing: '.02em' }}>{k}</p>
      <p className={`text-slate-900 leading-tight truncate ${strong ? 'font-extrabold' : 'font-semibold'} ${mono ? 'font-mono tracking-wide' : ''}`}
        style={{ fontSize: 'clamp(8px,2.5vw,13px)' }}>{v}</p>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 font-medium block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
        className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors
          ${readOnly ? 'border-gray-600 text-gray-400 cursor-default' : 'border-gray-700 focus:border-amber-500'}`} />
    </div>
  );
}
