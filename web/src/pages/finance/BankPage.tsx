import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface SavingsAccount {
  id: string;
  nameKu: string;
  name: string;
  apy: string;
  minDeposit: string;
  lockPeriod: string;
  totalDeposited: string;
  emoji: string;
}

interface LendingPool {
  id: string;
  nameKu: string;
  name: string;
  borrowRate: string;
  collateralRatio: string;
  available: string;
  emoji: string;
}

const SAVINGS: SavingsAccount[] = [
  { id: 's1', emoji: '🌱', nameKu: 'Teserûfa Destpêk',   name: 'Starter Savings', apy: '4.5%',  minDeposit: '100 HEZ',    lockPeriod: 'None',     totalDeposited: '125,430 HEZ' },
  { id: 's2', emoji: '🌿', nameKu: 'Teserûfa Navîn',     name: 'Growth Savings',  apy: '8.2%',  minDeposit: '1,000 HEZ',  lockPeriod: '90 days',  totalDeposited: '892,100 HEZ' },
  { id: 's3', emoji: '🌳', nameKu: 'Teserûfa Zêrîn',    name: 'Gold Savings',    apy: '12.0%', minDeposit: '10,000 HEZ', lockPeriod: '365 days', totalDeposited: '2,340,000 HEZ' },
];

const LENDING: LendingPool[] = [
  { id: 'l1', emoji: '💳', nameKu: 'Deyna Bilez',       name: 'Flash Loan',     borrowRate: '0.1%', collateralRatio: 'None', available: '50,000 HEZ' },
  { id: 'l2', emoji: '🏠', nameKu: 'Deyna Kesane',      name: 'Personal Loan',  borrowRate: '5.5%', collateralRatio: '150%', available: '200,000 HEZ' },
  { id: 'l3', emoji: '🏢', nameKu: 'Deyna Karsaziyê',  name: 'Business Loan',  borrowRate: '3.8%', collateralRatio: '200%', available: '500,000 HEZ' },
];

const TREASURY_ALLOCATIONS = [
  { labelKu: 'Perwerde', labelEn: 'Education',   pct: '25%', color: '#00A94F' },
  { labelKu: 'Teknolojî', labelEn: 'Technology', pct: '30%', color: '#2196F3' },
  { labelKu: 'Ewlehî',   labelEn: 'Security',    pct: '15%', color: '#EE2A35' },
  { labelKu: 'Civak',    labelEn: 'Community',   pct: '20%', color: '#9C27B0' },
  { labelKu: 'Pareztî',  labelEn: 'Reserve',     pct: '10%', color: '#FFD700' },
];

type Tab = 'savings' | 'lending' | 'treasury';

export default function BankPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('savings');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'savings',  label: t('bank.tab.savings', 'Savings') },
    { key: 'lending',  label: t('bank.tab.lending', 'Lending') },
    { key: 'treasury', label: t('bank.tab.treasury', 'Treasury') },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-xl leading-none">←</button>
          <span className="text-sm text-white/70">{t('bank.breadcrumb', 'Finance')}</span>
        </div>
        <div className="text-center">
          <span className="text-5xl block mb-2">🏦</span>
          <h1 className="text-2xl font-bold text-white">{t('bank.title', 'Digital Bank')}</h1>
          <p className="text-white/70 text-sm mt-0.5">{t('bank.subtitle', 'Digital Bank of Kurdistan')}</p>
        </div>
        <div className="mt-4 bg-white/10 rounded-2xl p-4 text-center">
          <p className="text-white/60 text-xs">{t('bank.totalValue', 'Total Value')}</p>
          <p className="text-3xl font-bold text-white mt-1">24,580.00 HEZ</p>
          <p className="text-yellow-400 text-sm mt-0.5">~ $1,229.00</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex bg-gray-900 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">

        {/* Savings */}
        {activeTab === 'savings' && (
          <>
            <div className="mb-1">
              <h2 className="font-bold text-white text-base">{t('bank.savings.title', 'Savings Accounts')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('bank.savings.desc', 'Stake your tokens and earn annual rewards.')}</p>
            </div>
            {SAVINGS.map(account => (
              <div key={account.id} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{account.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-white">{account.nameKu}</p>
                    <p className="text-xs text-gray-400">{account.name}</p>
                  </div>
                  <div className="bg-green-900/50 px-3 py-1 rounded-full">
                    <span className="text-green-400 text-sm font-bold">{account.apy} APY</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-gray-800 rounded-xl p-3 mb-3">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.savings.min', 'Min')}</p>
                    <p className="text-xs font-semibold text-gray-300">{account.minDeposit}</p>
                  </div>
                  <div className="text-center border-x border-gray-700">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.savings.lock', 'Lock')}</p>
                    <p className="text-xs font-semibold text-gray-300">{account.lockPeriod}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.savings.total', 'Total')}</p>
                    <p className="text-xs font-semibold text-gray-300">{account.totalDeposited}</p>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-white font-semibold text-sm transition-colors">
                  {t('bank.savings.deposit', 'Deposit')}
                </button>
              </div>
            ))}
          </>
        )}

        {/* Lending */}
        {activeTab === 'lending' && (
          <>
            <div className="mb-1">
              <h2 className="font-bold text-white text-base">{t('bank.lending.title', 'Lending Pools')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('bank.lending.desc', 'Borrow through smart contracts with collateral.')}</p>
            </div>
            {LENDING.map(pool => (
              <div key={pool.id} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{pool.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-white">{pool.nameKu}</p>
                    <p className="text-xs text-gray-400">{pool.name}</p>
                  </div>
                  <div className="bg-blue-900/50 px-3 py-1 rounded-full">
                    <span className="text-blue-400 text-sm font-bold">{pool.borrowRate}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-gray-800 rounded-xl p-3 mb-3">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.lending.rate', 'Rate')}</p>
                    <p className="text-xs font-semibold text-gray-300">{pool.borrowRate}</p>
                  </div>
                  <div className="text-center border-x border-gray-700">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.lending.collateral', 'Collateral')}</p>
                    <p className="text-xs font-semibold text-gray-300">{pool.collateralRatio}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">{t('bank.lending.available', 'Available')}</p>
                    <p className="text-xs font-semibold text-gray-300">{pool.available}</p>
                  </div>
                </div>
                <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-sm transition-colors">
                  {t('bank.lending.borrow', 'Borrow')}
                </button>
              </div>
            ))}
          </>
        )}

        {/* Treasury */}
        {activeTab === 'treasury' && (
          <>
            <div className="mb-1">
              <h2 className="font-bold text-white text-base">{t('bank.treasury.title', 'Community Treasury')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('bank.treasury.desc', 'The public treasury of the Digital Kurdistan Republic.')}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 text-center">
              <p className="text-xs text-gray-400">{t('bank.treasury.balance', 'Treasury Balance')}</p>
              <p className="text-3xl font-bold text-green-400 mt-2">12,450,000 HEZ</p>
              <p className="text-gray-400 text-sm mt-1">~ $622,500</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="font-bold text-white mb-3">{t('bank.treasury.allocation', 'Allocation')}</p>
              <div className="space-y-3">
                {TREASURY_ALLOCATIONS.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 text-sm text-gray-300">{item.labelKu} / {item.labelEn}</span>
                    <span className="font-bold text-white text-sm">{item.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="h-10" />
    </div>
  );
}
