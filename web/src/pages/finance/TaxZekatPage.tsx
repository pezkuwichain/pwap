import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePezkuwi } from '@/contexts/PezkuwiContext';

type ContributionType = 'zekat' | 'tax';

interface AllocationItem {
  id: string;
  nameKu: string;
  nameEn: string;
  icon: string;
  percentage: number;
}

const DEFAULT_ALLOCATIONS: AllocationItem[] = [
  { id: 'shahid',         nameKu: 'Binemalin Şehîda',    nameEn: 'Martyr Families',    icon: '🏠', percentage: 0 },
  { id: 'education',      nameKu: 'Projeyin Perwerde',    nameEn: 'Education Projects', icon: '📚', percentage: 0 },
  { id: 'health',         nameKu: 'Tenduristî',           nameEn: 'Health Services',    icon: '🏥', percentage: 0 },
  { id: 'orphans',        nameKu: 'Sêwî û Feqîr',        nameEn: 'Orphans & Poor',     icon: '👶', percentage: 0 },
  { id: 'infrastructure', nameKu: 'Binesazî',             nameEn: 'Infrastructure',     icon: '🏗️', percentage: 0 },
  { id: 'defense',        nameKu: 'Parastina Welat',      nameEn: 'National Defense',   icon: '🛡️', percentage: 0 },
  { id: 'diaspora',       nameKu: 'Diaspora',             nameEn: 'Diaspora Support',   icon: '🌍', percentage: 0 },
  { id: 'culture',        nameKu: 'Çand û Huner',         nameEn: 'Culture & Arts',     icon: '🎭', percentage: 0 },
];

export default function TaxZekatPage() {
  const navigate = useNavigate();
  const { api, selectedAccount, getKeyPair } = usePezkuwi();

  const [contributionType, setContributionType] = useState<ContributionType>('zekat');
  const [amount, setAmount] = useState('');
  const [allocations, setAllocations] = useState<AllocationItem[]>(DEFAULT_ALLOCATIONS);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const totalPercentage = useMemo(() =>
    allocations.reduce((sum, a) => sum + a.percentage, 0), [allocations]);

  const isFormValid = useMemo(() => {
    const n = parseFloat(amount);
    return n > 0 && totalPercentage === 100 && termsAccepted && !!selectedAccount;
  }, [amount, totalPercentage, termsAccepted, selectedAccount]);

  const updateAllocation = (id: string, value: string) => {
    const n = Math.min(100, Math.max(0, parseInt(value) || 0));
    setAllocations(prev => prev.map(a => a.id === id ? { ...a, percentage: n } : a));
  };

  const calcAmount = (pct: number) =>
    ((parseFloat(amount) || 0) * pct / 100).toFixed(2);

  const confirmAndSend = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setResult(null);
    try {
      if (!api || !selectedAccount) throw new Error('Wallet not connected');
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) throw new Error('Could not retrieve key pair');

      const allocationData = allocations
        .filter(a => a.percentage > 0)
        .map(a => `${a.id}:${a.percentage}`)
        .join(',');

      const remarkMessage = JSON.stringify({
        type: contributionType,
        allocations: allocationData,
        timestamp: Date.now(),
      });

      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 1e12));

      const treasuryOpt = await api.query.pezTreasury.governmentPotAccountId();
      if (!treasuryOpt || (treasuryOpt as { isEmpty?: boolean }).isEmpty) {
        throw new Error('Government treasury account not found');
      }
      const treasuryAccount = treasuryOpt.toString();

      const txs = [
        api.tx.balances.transferKeepAlive(treasuryAccount, amountInUnits.toString()),
        api.tx.system.remark(remarkMessage),
      ];

      await new Promise<void>((resolve, reject) => {
        api.tx.utility
          .batch(txs)
          .signAndSend(keyPair, { nonce: -1 }, ({ status, dispatchError }: { status: { isInBlock?: boolean; isFinalized?: boolean }; dispatchError?: unknown }) => {
            if (status.isInBlock || status.isFinalized) {
              if (dispatchError) { reject(new Error('Transaction failed')); return; }
              resolve();
            }
          })
          .catch(reject);
      });

      setResult({ ok: true, msg: `${amount} HEZ başarıyla gönderildi. Spas!` });
      setAmount('');
      setAllocations(DEFAULT_ALLOCATIONS);
      setTermsAccepted(false);
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isZekat = contributionType === 'zekat';
  const accentColor = isZekat ? '#00A94F' : '#D4A017';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3" style={{ backgroundColor: accentColor }}>
        <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
        <div>
          <h1 className="font-bold text-lg">
            {isZekat ? '🤲 Zekat' : '📜 Bac / Tax'}
          </h1>
          <p className="text-white/70 text-xs">Komara Dijîtal a Kurdistanê</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Result banner */}
        {result && (
          <div className={`rounded-xl p-4 text-sm font-medium ${result.ok ? 'bg-green-900/60 text-green-300 border border-green-700' : 'bg-red-900/60 text-red-300 border border-red-700'}`}>
            {result.ok ? '✅' : '❌'} {result.msg}
          </div>
        )}

        {/* Description */}
        <div className="bg-gray-900 rounded-xl p-4 border-l-4" style={{ borderColor: accentColor }}>
          <p className="text-sm text-gray-200 leading-relaxed">
            Beşdariya xwe ya bi dilxwazî ji Komara Dijîtaliya Kurdistanê re bişînin.
          </p>
          <p className="text-xs text-gray-400 mt-1 italic">
            Send your voluntary contribution to the Digital Kurdistan Republic.
          </p>
        </div>

        {/* Type selector */}
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-sm font-bold text-gray-300 mb-3">Cureyê Beşdariyê / Contribution Type</p>
          <div className="grid grid-cols-2 gap-3">
            {(['zekat', 'tax'] as ContributionType[]).map(type => (
              <button
                key={type}
                onClick={() => setContributionType(type)}
                className={`rounded-xl p-4 text-center border-2 transition-all ${
                  contributionType === type
                    ? 'border-current bg-white/5'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
                style={{ borderColor: contributionType === type ? accentColor : undefined }}
              >
                <div className="text-3xl mb-1">{type === 'zekat' ? '🤲' : '📜'}</div>
                <p className="font-bold text-white">{type === 'zekat' ? 'Zekat' : 'Bac'}</p>
                <p className="text-xs text-gray-400">{type === 'zekat' ? 'Islamic Zekat' : 'Vergi / Tax'}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-sm font-bold text-gray-300 mb-3">Miqdar / Amount</p>
          <div className="flex items-center bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent px-4 py-3 text-2xl font-semibold text-white outline-none"
            />
            <span className="pr-4 text-lg font-bold" style={{ color: accentColor }}>HEZ</span>
          </div>
          {!selectedAccount && (
            <p className="text-xs text-amber-400 mt-2">⚠️ Cüzdan bağlı değil / Wallet not connected</p>
          )}
        </div>

        {/* Allocation */}
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-gray-300">Dabeşkirina Fonê / Fund Allocation</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              totalPercentage === 100 ? 'bg-green-900 text-green-400' :
              totalPercentage > 100 ? 'bg-red-900 text-red-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {totalPercentage}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Divê bêkêmasî %100 be / Must equal exactly 100%</p>

          <div className="space-y-2">
            {allocations.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.nameKu}</p>
                  <p className="text-xs text-gray-500">{item.nameEn}</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2">
                  <input
                    type="number"
                    value={item.percentage > 0 ? item.percentage : ''}
                    onChange={e => updateAllocation(item.id, e.target.value)}
                    placeholder="0"
                    className="w-10 bg-transparent text-center text-sm font-bold text-white outline-none py-1"
                    min={0}
                    max={100}
                  />
                  <span className="text-gray-400 text-xs">%</span>
                </div>
                {item.percentage > 0 && parseFloat(amount) > 0 && (
                  <span className="text-xs font-semibold min-w-[52px] text-right" style={{ color: accentColor }}>
                    {calcAmount(item.percentage)} HEZ
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Terms */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          style={{ borderColor: isZekat ? '#00A94F30' : '#D4A01730' }}>
          <div className="text-center mb-3">
            <span className="text-4xl">{isZekat ? '🤲' : '📜'}</span>
            <p className="font-bold text-white mt-2">SOZNAME / COMMITMENT</p>
          </div>
          {isZekat ? (
            <p className="text-xs text-gray-400 leading-relaxed">
              Komara Dîjîtal a Kurdistanê SOZ DIDE ku zekata we BI TEMAMÎ li gorî rêjeyên ku we destnîşan kirine dê bê xerckirin, li gorî rêgez û qaîdeyên Îslamî.
              <br /><br />
              <span className="text-gray-500">The Digital Republic of Kurdistan COMMITS to spending your zekat EXACTLY according to the ratios you specify, in accordance with Islamic principles.</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 leading-relaxed">
              Komara Dîjîtal a Kurdistanê SOZ DIDE ku beşdariyên baca we BI QASÎ KU MIMKUN BE li gorî rêjeyên ku we destnîşan kirine dê bê xerckirin. Hemû lêçûn dê bi şefafî li ser blockchain werin tomar kirin.
              <br /><br />
              <span className="text-gray-500">The Digital Republic of Kurdistan COMMITS to using your tax contributions AS CLOSELY AS POSSIBLE according to the ratios you specify. All expenses will be transparently recorded on the blockchain.</span>
            </p>
          )}

          <button
            onClick={() => setTermsAccepted(!termsAccepted)}
            className="flex items-center gap-3 mt-4 w-full bg-gray-800 rounded-xl p-3"
          >
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors`}
              style={{ borderColor: accentColor, backgroundColor: termsAccepted ? accentColor : 'transparent' }}>
              {termsAccepted && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <span className="text-sm text-gray-300 text-left">Min xwend û qebûl dikim / I have read and accept</span>
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={() => isFormValid && setShowConfirm(true)}
          disabled={!isFormValid || isSubmitting}
          className="w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: accentColor }}
        >
          {isSubmitting
            ? '⏳ Tê şandin...'
            : isZekat ? '🤲 ZEKAT BIŞÎNE' : '📤 BAC BIŞÎNE'}
        </button>

        <div className="h-6" />
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-bold text-white text-center mb-4">Piştrast bike / Confirm</h3>

            <div className="bg-gray-800 rounded-xl p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cure / Type:</span>
                <span className="text-white font-semibold">{isZekat ? 'Zekat' : 'Bac / Tax'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Miqdar / Amount:</span>
                <span className="font-bold" style={{ color: accentColor }}>{amount} HEZ</span>
              </div>
              <div className="border-t border-gray-700 pt-2 mt-2">
                <p className="text-gray-400 text-xs mb-2">Dabeşkirin / Allocation:</p>
                {allocations.filter(a => a.percentage > 0).map(a => (
                  <div key={a.id} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-300">{a.icon} {a.nameKu}</span>
                    <span className="text-white font-medium">{calcAmount(a.percentage)} HEZ ({a.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="py-3 rounded-xl bg-gray-800 text-gray-300 font-semibold"
              >
                Betal / Cancel
              </button>
              <button
                onClick={confirmAndSend}
                className="py-3 rounded-xl text-white font-bold"
                style={{ backgroundColor: accentColor }}
              >
                ✓ Piştrast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
