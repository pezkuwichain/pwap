import { useTranslation } from 'react-i18next';
import { Lock, CheckCircle } from 'lucide-react';
import type { DecryptedMessage } from '@/hooks/useMessaging';

interface InboxMessageProps {
  message: DecryptedMessage;
  currentBlock?: number;
}

function formatAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTimeAgo(blockNumber: number, currentBlock: number): string {
  const blocksDiff = currentBlock - blockNumber;
  if (blocksDiff < 0) return '';
  const seconds = blocksDiff * 12; // ~12s per block
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function InboxMessage({ message, currentBlock }: InboxMessageProps) {
  const { t } = useTranslation();
  const isDecrypted = message.plaintext !== null;

  return (
    <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isDecrypted ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Lock className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-400" title={message.sender}>
            {formatAddress(message.sender)}
          </span>
          {currentBlock && message.blockNumber > 0 && (
            <span className="text-xs text-gray-600">
              {formatTimeAgo(message.blockNumber, currentBlock)}
            </span>
          )}
        </div>
        {isDecrypted ? (
          <p className="text-sm text-gray-200 break-words whitespace-pre-wrap">
            {message.plaintext}
          </p>
        ) : (
          <p className="text-sm text-gray-500 italic">
            {t('messaging.encrypted', '[Encrypted]')}
          </p>
        )}
      </div>

      {/* Block number */}
      <div className="flex-shrink-0">
        <span className="text-[10px] text-gray-600 font-mono">
          #{message.blockNumber}
        </span>
      </div>
    </div>
  );
}
