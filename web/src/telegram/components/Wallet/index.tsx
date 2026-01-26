import { useState, useEffect } from 'react';
import { Wallet as WalletIcon, Send, ArrowDownToLine, RefreshCw, Copy, Check, Loader2, TrendingUp, Clock, ExternalLink } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { usePezkuwiApi } from '../../hooks/usePezkuwiApi';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { formatBalance, CHAIN_CONFIG, formatAddress } from '@shared/lib/wallet';
import { getStakingInfo, StakingInfo } from '@shared/lib/staking';
import { cn } from '@/lib/utils';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceUsd?: string;
  icon?: string;
  isNative?: boolean;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'stake' | 'unstake' | 'claim';
  amount: string;
  symbol: string;
  address?: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
}

// Mock recent transactions - will be replaced with actual data
const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'receive',
    amount: '100.00',
    symbol: 'HEZ',
    address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'confirmed',
  },
  {
    id: '2',
    type: 'stake',
    amount: '50.00',
    symbol: 'HEZ',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    status: 'confirmed',
  },
  {
    id: '3',
    type: 'claim',
    amount: '5.25',
    symbol: 'PEZ',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    status: 'confirmed',
  },
];

export function Wallet() {
  const { hapticNotification, hapticImpact, showAlert, openLink } = useTelegram();
  const { api, isReady: isApiReady } = usePezkuwiApi();
  const { selectedAccount, connectWallet, disconnectWallet } = usePezkuwi();

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = !!selectedAccount;
  const address = selectedAccount?.address;

  // Fetch balances when connected
  useEffect(() => {
    if (!api || !isApiReady || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch native balance
        const accountInfo = await api.query.system.account(address);
        const { data } = accountInfo.toJSON() as { data: { free: string; reserved: string } };
        const freeBalance = BigInt(data.free || 0);

        const nativeBalance: TokenBalance = {
          symbol: CHAIN_CONFIG.symbol,
          name: 'Hezar Token',
          balance: formatBalance(freeBalance.toString()),
          isNative: true,
        };

        setBalances([nativeBalance]);

        // Fetch staking info
        const staking = await getStakingInfo(api, address);
        setStakingInfo(staking);
      } catch (err) {
        console.error('Failed to fetch wallet data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [api, isApiReady, address]);

  const handleRefresh = async () => {
    if (!api || !address || isRefreshing) return;

    setIsRefreshing(true);
    hapticNotification('success');

    try {
      const accountInfo = await api.query.system.account(address);
      const { data } = accountInfo.toJSON() as { data: { free: string } };
      const freeBalance = BigInt(data.free || 0);

      setBalances([{
        symbol: CHAIN_CONFIG.symbol,
        name: 'Hezar Token',
        balance: formatBalance(freeBalance.toString()),
        isNative: true,
      }]);

      const staking = await getStakingInfo(api, address);
      setStakingInfo(staking);
    } catch (err) {
      showAlert('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      hapticNotification('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert('Failed to copy address');
    }
  };

  const handleConnect = () => {
    hapticImpact('medium');
    connectWallet();
  };

  const handleDisconnect = () => {
    hapticImpact('medium');
    disconnectWallet();
  };

  const handleOpenExplorer = () => {
    if (!address) return;
    hapticImpact('light');
    openLink(`https://explorer.pezkuwichain.io/account/${address}`);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'send':
        return <Send className="w-4 h-4 text-red-400" />;
      case 'receive':
        return <ArrowDownToLine className="w-4 h-4 text-green-400" />;
      case 'stake':
        return <TrendingUp className="w-4 h-4 text-blue-400" />;
      case 'unstake':
        return <Clock className="w-4 h-4 text-orange-400" />;
      case 'claim':
        return <ArrowDownToLine className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-4 border-b border-gray-800">
          <WalletIcon className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Wallet</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
            <WalletIcon className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-white font-medium mb-2">Connect Your Wallet</h3>
          <p className="text-gray-400 text-sm text-center mb-6">
            Connect your Pezkuwi wallet to view balances, stake tokens, and manage your assets.
          </p>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <WalletIcon className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <WalletIcon className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Wallet</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', isRefreshing && 'animate-spin')} />
          </button>
          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-500 hover:text-gray-400"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Address Card */}
            <div className="p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 text-sm">
                    {selectedAccount?.meta?.name || 'Account'}
                  </span>
                  <button
                    onClick={handleOpenExplorer}
                    className="text-gray-500 hover:text-gray-400"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-white text-sm flex-1 truncate">
                    {formatAddress(address || '')}
                  </code>
                  <button
                    onClick={handleCopyAddress}
                    className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Balance Card */}
            <div className="px-4 pb-4">
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-4">
                <div className="text-green-100 text-sm mb-1">Total Balance</div>
                <div className="text-3xl font-bold text-white mb-1">
                  {balances[0]?.balance || '0.00'} {CHAIN_CONFIG.symbol}
                </div>
                {stakingInfo && parseFloat(stakingInfo.bonded) > 0 && (
                  <div className="text-green-200 text-sm">
                    Staked: {stakingInfo.bonded} {CHAIN_CONFIG.symbol}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => showAlert('Send feature coming soon!')}
                  className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-xs text-gray-400">Send</span>
                </button>
                <button
                  onClick={() => showAlert('Receive feature coming soon!')}
                  className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                    <ArrowDownToLine className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-xs text-gray-400">Receive</span>
                </button>
                <button
                  onClick={() => showAlert('Stake feature coming soon!')}
                  className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-xs text-gray-400">Stake</span>
                </button>
              </div>
            </div>

            {/* Staking Info */}
            {stakingInfo && parseFloat(stakingInfo.bonded) > 0 && (
              <div className="px-4 pb-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    <span className="text-white font-medium">Staking Overview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Bonded</div>
                      <div className="text-white font-medium">{stakingInfo.bonded}</div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Active</div>
                      <div className="text-white font-medium">{stakingInfo.active}</div>
                    </div>
                    {stakingInfo.stakingScore !== null && (
                      <div className="bg-gray-900 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Staking Score</div>
                        <div className="text-green-500 font-medium">{stakingInfo.stakingScore}</div>
                      </div>
                    )}
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Nominations</div>
                      <div className="text-white font-medium">{stakingInfo.nominations.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="px-4 pb-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-medium">Recent Activity</h3>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No recent transactions
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {transactions.map(tx => (
                      <div key={tx.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div>
                            <div className="text-white text-sm font-medium capitalize">
                              {tx.type}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {formatTimestamp(tx.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn(
                            'font-medium text-sm',
                            tx.type === 'send' || tx.type === 'stake' ? 'text-red-400' : 'text-green-400'
                          )}>
                            {tx.type === 'send' || tx.type === 'stake' ? '-' : '+'}
                            {tx.amount} {tx.symbol}
                          </div>
                          <div className={cn(
                            'text-xs',
                            tx.status === 'confirmed' ? 'text-gray-500' :
                            tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                          )}>
                            {tx.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Wallet;
