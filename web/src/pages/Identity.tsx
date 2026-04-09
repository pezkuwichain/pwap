import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileShell from '@/components/MobileShell';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Save, CreditCard, BookOpen, Camera } from 'lucide-react';

// ── Types ──
interface IdentityData {
  fullName: string;
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
  fullName: '',
  fatherName: '',
  motherName: '',
  dateOfBirth: '',
  placeOfBirth: '',
  gender: '',
  bloodType: '',
  citizenNumber: '',
  passportNumber: '',
  photo: '',
};

const STORAGE_KEY = 'pezkuwi_identity_data';

// ── Helpers ──
function generatePassportNo(citizenNo: string): string {
  if (!citizenNo) return 'KRD-000000';
  return `KRD-${citizenNo.replace(/\D/g, '').slice(0, 6).padStart(6, '0')}`;
}

function formatMRZ(data: IdentityData): [string, string] {
  const name = data.fullName.toUpperCase().replace(/[^A-Z ]/g, '').replace(/ /g, '<') || 'SURNAME<<NAME';
  const dob = data.dateOfBirth.replace(/-/g, '').slice(2) || '000000';
  const gender = data.gender || '<';
  const pno = data.passportNumber.replace(/[^A-Z0-9]/g, '').padEnd(9, '<');
  const line1 = `P<KRD${name}${'<'.repeat(Math.max(0, 44 - 5 - name.length))}`.slice(0, 44);
  const line2 = `${pno}0KRD${dob}0${gender}${'<'.repeat(14)}00`.slice(0, 44);
  return [line1, line2];
}

const today = new Date();
const issueDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const expiryDate = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate())
  .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ── Main Component ──
export default function Identity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selectedAccount } = usePezkuwi();
  const [tab, setTab] = useState<'id' | 'passport'>('id');
  const [data, setData] = useState<IdentityData>(DEFAULT_DATA);
  const [saved, setSaved] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Auto-fill citizen number from wallet
  useEffect(() => {
    if (selectedAccount && !data.citizenNumber) {
      const short = selectedAccount.address.slice(-8).toUpperCase();
      setData(prev => ({
        ...prev,
        citizenNumber: short,
        passportNumber: generatePassportNo(short),
      }));
    }
  }, [selectedAccount, data.citizenNumber]);

  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize to max 300px and compress
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        let w = img.width, h = img.height;
        if (w > h) { h = (h / w) * maxSize; w = maxSize; }
        else { w = (w / h) * maxSize; h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setData(prev => ({ ...prev, photo: dataUrl }));
        setSaved(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field: keyof IdentityData, value: string) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'citizenNumber') {
        next.passportNumber = generatePassportNo(value);
      }
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

  const content = (
    <div className="bg-gray-950 min-h-full">
      {/* Tab switcher */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => setTab('id')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors
            ${tab === 'id' ? 'text-green-400 border-b-2 border-green-400 bg-gray-900' : 'text-gray-500'}`}
        >
          <CreditCard className="w-4 h-4" />
          {t('identity.idCard', 'ID Card')}
        </button>
        <button
          onClick={() => setTab('passport')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors
            ${tab === 'passport' ? 'text-green-400 border-b-2 border-green-400 bg-gray-900' : 'text-gray-500'}`}
        >
          <BookOpen className="w-4 h-4" />
          {t('identity.passport', 'Passport')}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Hidden file input for photo */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handlePhotoSelect}
        />

        {/* ── CARD PREVIEW ── */}
        {tab === 'id' ? (
          <IDCardPreview data={data} onPhotoClick={() => photoInputRef.current?.click()} />
        ) : (
          <PassportPreview data={data} mrzLine1={mrzLine1} mrzLine2={mrzLine2} onPhotoClick={() => photoInputRef.current?.click()} />
        )}

        {/* ── FORM ── */}
        <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-bold text-white mb-2">
            {t('identity.personalInfo', 'Personal Information')}
          </h3>

          <FormField label={t('identity.fullName', 'Full Name')} value={data.fullName}
            onChange={v => handleChange('fullName', v)} placeholder="Azad Kurdistanî" />

          <FormField label={t('identity.fatherName', "Father's Name")} value={data.fatherName}
            onChange={v => handleChange('fatherName', v)} placeholder="Rêber" />

          <FormField label={t('identity.motherName', "Mother's Name")} value={data.motherName}
            onChange={v => handleChange('motherName', v)} placeholder="Jîn" />

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('identity.dateOfBirth', 'Date of Birth')} value={data.dateOfBirth}
              onChange={v => handleChange('dateOfBirth', v)} type="date" />

            <div>
              <label className="text-[10px] text-gray-400 font-medium block mb-1">
                {t('identity.gender', 'Gender')}
              </label>
              <select
                value={data.gender}
                onChange={e => handleChange('gender', e.target.value as 'M' | 'F' | '')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                <option value="M">{t('identity.male', 'Male')}</option>
                <option value="F">{t('identity.female', 'Female')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('identity.placeOfBirth', 'Place of Birth')} value={data.placeOfBirth}
              onChange={v => handleChange('placeOfBirth', v)} placeholder="Hewlêr" />

            <div>
              <label className="text-[10px] text-gray-400 font-medium block mb-1">
                {t('identity.bloodType', 'Blood Type')}
              </label>
              <select
                value={data.bloodType}
                onChange={e => handleChange('bloodType', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
          </div>

          <FormField label={t('identity.citizenNo', 'Citizen Number')} value={data.citizenNumber}
            onChange={v => handleChange('citizenNumber', v)} placeholder="KRD-000000" />

          {/* Save button */}
          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
              ${saved
                ? 'bg-green-600 text-white'
                : 'bg-gradient-to-r from-green-600 to-yellow-500 text-white shadow-lg'}`}
          >
            <Save className="w-4 h-4" />
            {saved ? t('identity.saved', 'Saved!') : t('identity.save', 'Save to Device')}
          </button>

          <p className="text-[10px] text-gray-500 text-center">
            {t('identity.localOnly', 'Data is stored only on your device. Never uploaded.')}
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <MobileShell title={`🆔 ${t('identity.title', 'Identity')}`}>
        {content}
      </MobileShell>
    );
  }

  // Desktop: simple centered layout
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

// ── ID Card Preview ──
function IDCardPreview({ data, onPhotoClick }: { data: IdentityData; onPhotoClick: () => void }) {
  return (
    <div className="relative w-full aspect-[1.586/1] rounded-xl overflow-hidden shadow-2xl border-2 border-yellow-600/50"
      style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #e8dcc8 50%, #f0e8d8 100%)' }}>

      {/* Top stripe - Kurdistan flag colors */}
      <div className="absolute top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-red-600" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-green-600" />
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-bold text-gray-600 tracking-wider">KOMARA KURDISTANÊ</p>
          <p className="text-[7px] text-gray-500">KURDISTAN REPUBLIC</p>
        </div>
        {/* Sun emblem */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-md overflow-hidden">
          <img src="/kurdistan_sun_light.svg" alt="Kurdistan Sun" className="w-7 h-7 object-contain" />
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold text-gray-600 tracking-wider">کۆماری کوردستان</p>
          <p className="text-[7px] text-gray-500">NASNAMA / ID CARD</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-red-400 via-yellow-400 to-green-400" />

      {/* Body */}
      <div className="px-4 pt-2 flex gap-3">
        {/* Photo area - clickable */}
        <button onClick={onPhotoClick}
          className="w-16 h-20 rounded-md bg-gray-200 border border-gray-300 flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
          {data.photo ? (
            <img src={data.photo} alt="photo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">👤</span>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <IDField label="Nav / Name" value={data.fullName || '—'} bold />
          <IDField label="Navê bav / Father" value={data.fatherName || '—'} />
          <IDField label="Navê dayik / Mother" value={data.motherName || '—'} />
          <div className="flex gap-3">
            <IDField label="Zayîn / DOB" value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-GB') : '—'} />
            <IDField label="Zayî / Sex" value={data.gender || '—'} />
          </div>
          <IDField label="Cih / Place" value={data.placeOfBirth || '—'} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-green-800 via-green-700 to-green-800 px-4 py-1.5 flex items-center justify-between">
        <div>
          <p className="text-[7px] text-green-200">JIM / NO</p>
          <p className="text-[9px] font-mono font-bold text-white tracking-widest">
            {data.citizenNumber || 'KRD-000000'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[7px] text-green-200">XWÎNê / Blood</p>
          <p className="text-[9px] font-bold text-white">{data.bloodType || '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-[7px] text-green-200">DERBASDAR / Expiry</p>
          <p className="text-[9px] font-mono text-white">{expiryDate}</p>
        </div>
      </div>
    </div>
  );
}

// ── Passport Preview ──
function PassportPreview({ data, mrzLine1, mrzLine2, onPhotoClick }: {
  data: IdentityData; mrzLine1: string; mrzLine2: string; onPhotoClick: () => void;
}) {
  return (
    <div className="relative w-full aspect-[0.71/1] rounded-xl overflow-hidden shadow-2xl border-2 border-green-800/70"
      style={{ background: 'linear-gradient(180deg, #1a472a 0%, #0d2818 100%)' }}>

      {/* Top ornament */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />

      {/* Header */}
      <div className="text-center pt-4 pb-2">
        <p className="text-[9px] font-bold text-yellow-400 tracking-[0.2em]">KOMARA KURDISTANÊ</p>
        <p className="text-[8px] text-yellow-400/70 tracking-wider">KURDISTAN REPUBLIC</p>

        {/* Emblem */}
        <div className="w-14 h-14 mx-auto my-2 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center shadow-lg border-2 border-yellow-300/50 overflow-hidden">
          <img src="/kurdistan_sun_light.svg" alt="Kurdistan Sun" className="w-12 h-12 object-contain" />
        </div>

        <p className="text-[9px] font-bold text-yellow-400/80 tracking-[0.3em]">پاسپۆرت</p>
        <p className="text-[8px] text-yellow-400/60 tracking-widest">PASSPORT</p>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-yellow-400/30" />

      {/* Data page */}
      <div className="mx-4 mt-2 bg-white/95 rounded-lg p-3 space-y-1.5"
        style={{ background: 'linear-gradient(135deg, #fefdf8 0%, #f5f0e0 100%)' }}>

        <div className="flex gap-3">
          {/* Photo - clickable */}
          <button onClick={onPhotoClick}
            className="w-14 h-18 rounded bg-gray-200 border border-gray-300 flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
            {data.photo ? (
              <img src={data.photo} alt="photo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">👤</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </button>

          <div className="flex-1 space-y-0.5">
            <PassField label="Type / Cure" value="P" />
            <PassField label="Code / Kod" value="KRD" />
            <PassField label="Passport No" value={data.passportNumber || 'KRD-000000'} mono />
          </div>
        </div>

        <PassField label="Surname, Name / Nav û paşnav" value={data.fullName?.toUpperCase() || '—'} bold />
        <div className="flex gap-3">
          <PassField label="Nationality / Netewe" value="KURDISTANÎ" />
          <PassField label="Sex / Zayî" value={data.gender || '—'} />
        </div>
        <div className="flex gap-3">
          <PassField label="Date of Birth / Zayîn" value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-GB') : '—'} />
          <PassField label="Place / Cih" value={data.placeOfBirth?.toUpperCase() || '—'} />
        </div>
        <div className="flex gap-3">
          <PassField label="Issue / Dest pê" value={issueDate} />
          <PassField label="Expiry / Dawî" value={expiryDate} />
        </div>
      </div>

      {/* MRZ Zone */}
      <div className="mx-4 mt-2 bg-white/90 rounded-b-lg px-2 py-1.5 font-mono">
        <p className="text-[7px] text-gray-700 tracking-[0.15em] leading-relaxed break-all">{mrzLine1}</p>
        <p className="text-[7px] text-gray-700 tracking-[0.15em] leading-relaxed break-all">{mrzLine2}</p>
      </div>
    </div>
  );
}

// ── Shared sub-components ──
function IDField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-[6px] text-gray-500 leading-none">{label}</p>
      <p className={`text-[9px] text-gray-900 leading-tight truncate ${bold ? 'font-bold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function PassField({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[5px] text-gray-500 leading-none">{label}</p>
      <p className={`text-[8px] text-gray-900 leading-tight truncate
        ${bold ? 'font-bold' : 'font-medium'}
        ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</p>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none transition-colors"
      />
    </div>
  );
}
