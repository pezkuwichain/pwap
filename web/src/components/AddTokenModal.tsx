import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Search, CheckCircle, Loader2 } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';

interface TokenInfo {
  assetId: number;
  symbol: string;
  name: string;
  decimals: number;
  exists: boolean;
}

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToken: (assetId: number) => Promise<void>;
}

export const AddTokenModal: React.FC<AddTokenModalProps> = ({
  isOpen,
  onClose,
  onAddToken,
}) => {
  const { assetHubApi, isAssetHubReady } = usePezkuwi();
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Helper to decode hex string to UTF-8
  const hexToString = (hex: string): string => {
    if (!hex || hex === '0x') return '';
    try {
      const hexStr = hex.startsWith('0x') ? hex.slice(2) : hex;
      const bytes = new Uint8Array(hexStr.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');
    } catch {
      return '';
    }
  };

  const handleSearch = async () => {
    setError('');
    setTokenInfo(null);

    const id = parseInt(assetId);
    if (isNaN(id) || id < 0) {
      setError('Please enter a valid asset ID (positive number)');
      return;
    }

    if (!assetHubApi || !isAssetHubReady) {
      setError('Asset Hub connection not ready. Please wait...');
      return;
    }

    setIsSearching(true);
    try {
      // Check if asset exists
      const assetInfo = await assetHubApi.query.assets.asset(id);

      if (!assetInfo || assetInfo.isNone) {
        setError(`Asset #${id} not found on blockchain`);
        setIsSearching(false);
        return;
      }

      // Get asset metadata
      const metadata = await assetHubApi.query.assets.metadata(id);
      const metaJson = metadata.toJSON() as { symbol?: string; name?: string; decimals?: number };

      // Decode hex strings
      let symbol = metaJson.symbol || '';
      let name = metaJson.name || '';

      if (typeof symbol === 'string' && symbol.startsWith('0x')) {
        symbol = hexToString(symbol);
      }
      if (typeof name === 'string' && name.startsWith('0x')) {
        name = hexToString(name);
      }

      // Fallback if no metadata
      if (!symbol) symbol = `Asset #${id}`;
      if (!name) name = `Unknown Asset`;

      setTokenInfo({
        assetId: id,
        symbol: symbol.trim(),
        name: name.trim(),
        decimals: metaJson.decimals || 12,
        exists: true,
      });
    } catch (err) {
      console.error('Failed to fetch asset:', err);
      setError('Failed to fetch asset from blockchain');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!tokenInfo) return;

    setIsAdding(true);
    try {
      await onAddToken(tokenInfo.assetId);
      handleClose();
    } catch {
      setError('Failed to add token');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setAssetId('');
    setError('');
    setTokenInfo(null);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Custom Token</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter the asset ID to fetch token details from blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="assetId" className="text-sm text-gray-300">
              Asset ID
            </Label>
            <div className="flex gap-2">
              <Input
                id="assetId"
                type="number"
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value);
                  setTokenInfo(null);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 1001"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
                min="0"
              />
              <Button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !assetId}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Known assets: 1001 (DOT), 1002 (ETH), 1003 (BTC)
            </p>
          </div>

          {/* Token Info Display */}
          {tokenInfo && (
            <div className="p-4 bg-gray-800/50 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-medium">Token Found!</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Symbol:</span>
                  <span className="text-white font-semibold">{tokenInfo.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white">{tokenInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Decimals:</span>
                  <span className="text-white">{tokenInfo.decimals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Asset ID:</span>
                  <span className="text-white font-mono">#{tokenInfo.assetId}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isAdding}
              className="border border-gray-700 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!tokenInfo || isAdding}
              className="bg-green-600 hover:bg-green-700"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Token'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
