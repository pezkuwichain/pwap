import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Blocks,
  ArrowRightLeft,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Copy,
  Activity,
  Database,
  Timer,
  Hash,
  Wallet,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BlockInfo {
  number: number;
  hash: string;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
  extrinsicsCount: number;
  timestamp: number;
  author?: string;
}

interface ExtrinsicInfo {
  hash: string;
  blockNumber: number;
  index: number;
  section: string;
  method: string;
  signer?: string;
  success: boolean;
  timestamp: number;
  args?: string;
}

interface NetworkStats {
  bestBlock: number;
  finalizedBlock: number;
  totalExtrinsics: number;
  activeValidators: number;
  avgBlockTime: number;
  tps: number;
  totalAccounts: number;
  era: number;
}

const Explorer: React.FC = () => {
  const navigate = useNavigate();
  const { api, isApiReady } = usePolkadot();

  const [stats, setStats] = useState<NetworkStats>({
    bestBlock: 0,
    finalizedBlock: 0,
    totalExtrinsics: 0,
    activeValidators: 0,
    avgBlockTime: 6,
    tps: 0,
    totalAccounts: 0,
    era: 0,
  });

  const [recentBlocks, setRecentBlocks] = useState<BlockInfo[]>([]);
  const [recentExtrinsics, setRecentExtrinsics] = useState<ExtrinsicInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Fetch network stats
  const fetchStats = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      const [header, finalizedHash, validators, currentEra] = await Promise.all([
        api.rpc.chain.getHeader(),
        api.rpc.chain.getFinalizedHead(),
        api.query.session?.validators?.() || Promise.resolve([]),
        api.query.staking?.currentEra?.() || Promise.resolve(null),
      ]);

      const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);

      setStats(prev => ({
        ...prev,
        bestBlock: header.number.toNumber(),
        finalizedBlock: finalizedHeader.number.toNumber(),
        activeValidators: Array.isArray(validators) ? validators.length : 0,
        era: currentEra ? currentEra.unwrapOr(0).toNumber() : 0,
      }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [api, isApiReady]);

  // Fetch recent blocks
  const fetchRecentBlocks = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      const header = await api.rpc.chain.getHeader();
      const currentBlock = header.number.toNumber();
      const blocks: BlockInfo[] = [];

      // Fetch last 10 blocks
      for (let i = 0; i < 10 && currentBlock - i > 0; i++) {
        const blockNumber = currentBlock - i;
        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await api.rpc.chain.getBlock(blockHash);

        // Try to get timestamp from block
        let timestamp = Date.now() - i * 6000; // Fallback: estimate based on 6s blocks
        const timestampExtrinsic = signedBlock.block.extrinsics.find(
          ext => ext.method.section === 'timestamp' && ext.method.method === 'set'
        );
        if (timestampExtrinsic) {
          timestamp = Number(timestampExtrinsic.method.args[0].toString());
        }

        blocks.push({
          number: blockNumber,
          hash: blockHash.toString(),
          parentHash: signedBlock.block.header.parentHash.toString(),
          stateRoot: signedBlock.block.header.stateRoot.toString(),
          extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toString(),
          extrinsicsCount: signedBlock.block.extrinsics.length,
          timestamp,
        });
      }

      setRecentBlocks(blocks);

      // Calculate TPS from recent blocks
      if (blocks.length >= 2) {
        const timeDiff = (blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / 1000;
        const totalExts = blocks.reduce((sum, b) => sum + b.extrinsicsCount, 0);
        const tps = timeDiff > 0 ? totalExts / timeDiff : 0;
        setStats(prev => ({ ...prev, tps: Math.round(tps * 100) / 100 }));
      }
    } catch (error) {
      console.error('Error fetching blocks:', error);
    }
  }, [api, isApiReady]);

  // Fetch recent extrinsics
  const fetchRecentExtrinsics = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      const header = await api.rpc.chain.getHeader();
      const currentBlock = header.number.toNumber();
      const extrinsics: ExtrinsicInfo[] = [];

      // Fetch extrinsics from last 5 blocks
      for (let i = 0; i < 5 && currentBlock - i > 0 && extrinsics.length < 15; i++) {
        const blockNumber = currentBlock - i;
        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        const apiAt = await api.at(blockHash);
        const allRecords = await apiAt.query.system.events();

        // Get timestamp
        let timestamp = Date.now() - i * 6000;
        const timestampExtrinsic = signedBlock.block.extrinsics.find(
          ext => ext.method.section === 'timestamp' && ext.method.method === 'set'
        );
        if (timestampExtrinsic) {
          timestamp = Number(timestampExtrinsic.method.args[0].toString());
        }

        signedBlock.block.extrinsics.forEach((ext, index) => {
          // Skip timestamp and inherent extrinsics for cleaner display
          if (ext.method.section === 'timestamp' || ext.method.section === 'parachainSystem') {
            return;
          }

          // Check if extrinsic succeeded
          const events = (allRecords as unknown as Array<{ phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { eq: (n: number) => boolean } }; event: { section: string; method: string } }>)
            .filter(({ phase }) =>
              phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)
            );

          const success = events.some(({ event }) =>
            event.section === 'system' && event.method === 'ExtrinsicSuccess'
          );
          const failed = events.some(({ event }) =>
            event.section === 'system' && event.method === 'ExtrinsicFailed'
          );

          extrinsics.push({
            hash: ext.hash.toString(),
            blockNumber,
            index,
            section: ext.method.section,
            method: ext.method.method,
            signer: ext.isSigned ? ext.signer.toString() : undefined,
            success: success || !failed,
            timestamp,
          });
        });
      }

      setRecentExtrinsics(extrinsics.slice(0, 15));
      setStats(prev => ({ ...prev, totalExtrinsics: extrinsics.length }));
    } catch (error) {
      console.error('Error fetching extrinsics:', error);
    }
  }, [api, isApiReady]);

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim() || !api || !isApiReady) return;

    setIsSearching(true);
    setSearchError('');

    try {
      const query = searchQuery.trim();

      // Check if it's a block number
      if (/^\d+$/.test(query)) {
        const blockNumber = parseInt(query);
        const header = await api.rpc.chain.getHeader();
        if (blockNumber <= header.number.toNumber()) {
          navigate(`/explorer/block/${blockNumber}`);
          return;
        } else {
          setSearchError('Block number does not exist yet');
        }
      }
      // Check if it's a hash (block or extrinsic)
      else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        // Try as block hash first
        try {
          const block = await api.rpc.chain.getBlock(query);
          if (block) {
            navigate(`/explorer/block/${block.block.header.number.toNumber()}`);
            return;
          }
        } catch {
          // Not a block hash, might be extrinsic hash
          navigate(`/explorer/tx/${query}`);
          return;
        }
      }
      // Check if it's an address
      else if (query.length >= 47 && query.length <= 48) {
        navigate(`/explorer/account/${query}`);
        return;
      }
      else {
        setSearchError('Invalid search query. Enter a block number, hash, or address.');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Subscribe to new blocks
  useEffect(() => {
    if (!api || !isApiReady) return;

    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      unsubscribe = await api.rpc.chain.subscribeNewHeads(() => {
        fetchStats();
        fetchRecentBlocks();
        fetchRecentExtrinsics();
        setLastUpdate(new Date());
      });
    };

    subscribe();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api, isApiReady, fetchStats, fetchRecentBlocks, fetchRecentExtrinsics]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStats(),
        fetchRecentBlocks(),
        fetchRecentExtrinsics(),
      ]);
      setIsLoading(false);
    };

    if (isApiReady) {
      loadData();
    }
  }, [isApiReady, fetchStats, fetchRecentBlocks, fetchRecentExtrinsics]);

  // Refresh handler
  const handleRefresh = () => {
    fetchStats();
    fetchRecentBlocks();
    fetchRecentExtrinsics();
    setLastUpdate(new Date());
  };

  if (!isApiReady) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Connecting to Blockchain</h2>
            <p className="text-gray-400">Please wait while we establish connection...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Blocks className="w-8 h-8 text-green-500" />
                Block Explorer
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Live
                </span>
                <span className="text-gray-500 text-sm">
                  Last updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </span>
              </div>
            </div>

            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Search Bar */}
          <Card className="bg-gray-900 border-gray-800 mb-8">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search by Block Number / Hash / Address"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
              {searchError && (
                <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {searchError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-800 rounded animate-pulse mb-2 w-1/2"></div>
                    <div className="h-8 bg-gray-800 rounded animate-pulse w-3/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Database className="w-4 h-4" />
                    Best Block
                  </div>
                  <p className="text-2xl font-bold text-white">
                    #{stats.bestBlock.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Finalized
                  </div>
                  <p className="text-2xl font-bold text-white">
                    #{stats.finalizedBlock.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Users className="w-4 h-4 text-blue-500" />
                    Validators
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.activeValidators}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Activity className="w-4 h-4 text-purple-500" />
                    Era
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.era}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Timer className="w-4 h-4 text-yellow-500" />
                    Block Time
                  </div>
                  <p className="text-2xl font-bold text-white">
                    ~{stats.avgBlockTime}s
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Zap className="w-4 h-4 text-orange-500" />
                    TPS
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.tps.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800 col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <ArrowRightLeft className="w-4 h-4 text-cyan-500" />
                    Recent Extrinsics
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {recentExtrinsics.length} in last {recentBlocks.length} blocks
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Blocks and Extrinsics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Blocks */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Blocks className="w-5 h-5 text-green-500" />
                  Recent Blocks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ))
                ) : recentBlocks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No blocks found
                  </div>
                ) : (
                  recentBlocks.slice(0, 8).map((block) => (
                    <div
                      key={block.number}
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/explorer/block/${block.number}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                            #{block.number.toLocaleString()}
                          </Badge>
                          <span className="text-gray-400 text-sm">
                            {formatDistanceToNow(new Date(block.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-green-400 transition-colors" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="w-3 h-3 text-gray-500" />
                          <span className="font-mono text-gray-400">
                            {formatAddress(block.hash)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(block.hash);
                            }}
                            className="text-gray-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm">
                          <span className="text-gray-500">Extrinsics:</span>{' '}
                          <span className="text-green-400 font-semibold">{block.extrinsicsCount}</span>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Extrinsics */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-purple-500" />
                  Recent Extrinsics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ))
                ) : recentExtrinsics.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No extrinsics found
                  </div>
                ) : (
                  recentExtrinsics.slice(0, 8).map((ext, idx) => (
                    <div
                      key={`${ext.hash}-${idx}`}
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/explorer/tx/${ext.hash}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {ext.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <Badge
                            variant="outline"
                            className={`${
                              ext.success
                                ? 'border-green-500/50 text-green-400'
                                : 'border-red-500/50 text-red-400'
                            }`}
                          >
                            {ext.section}.{ext.method}
                          </Badge>
                        </div>
                        <span className="text-gray-400 text-sm">
                          Block #{ext.blockNumber.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="w-3 h-3 text-gray-500" />
                          <span className="font-mono text-purple-400">
                            {formatAddress(ext.hash)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(ext.hash);
                            }}
                            className="text-gray-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {ext.signer && (
                          <div className="flex items-center gap-1 text-sm">
                            <Wallet className="w-3 h-3 text-gray-500" />
                            <span className="font-mono text-gray-400">
                              {formatAddress(ext.signer)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card className="bg-gray-900 border-gray-800 mt-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-green-500" />
                Quick Links
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a
                  href="https://telemetry.pezkuwichain.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition-colors"
                >
                  <Activity className="w-4 h-4 text-red-400" />
                  Telemetry
                </a>
                <a
                  href="/governance"
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition-colors"
                >
                  <Users className="w-4 h-4 text-blue-400" />
                  Governance
                </a>
                <a
                  href="/wallet"
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition-colors"
                >
                  <Wallet className="w-4 h-4 text-yellow-400" />
                  Wallet
                </a>
                <a
                  href="/docs"
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition-colors"
                >
                  <Blocks className="w-4 h-4 text-purple-400" />
                  Documentation
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Explorer;
