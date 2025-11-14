import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';

  // For large numbers, use K, M, B suffixes
  if (value >= 1e9) {
    return (value / 1e9).toFixed(decimals) + 'B';
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(decimals) + 'M';
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(decimals) + 'K';
  }

  return value.toFixed(decimals);
}
