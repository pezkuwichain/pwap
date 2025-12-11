/**
 * Formatting utilities
 */

/**
 * Format a blockchain address for display
 * @param address - Full blockchain address
 * @param chars - Number of characters to show at start and end
 * @returns Formatted address (e.g., "0x1234...5678")
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format a number with thousand separators
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a token amount with proper decimals
 * @param amount - Amount in smallest unit
 * @param decimals - Token decimals (e.g., 18 for most tokens)
 * @returns Formatted token amount
 */
export function formatTokenAmount(amount: string | number, decimals = 18): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return formatNumber(value / Math.pow(10, decimals), 4);
}

/**
 * Format a date for display
 * @param dateString - ISO date string or Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param dateString - ISO date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string | Date): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
