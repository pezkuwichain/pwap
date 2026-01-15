/**
 * Shared theme colors for all platforms
 */

// Kurdistan Flag Colors + Extended Palette
export const KurdistanColors = {
  kesk: '#00A94F',    // Green - Primary
  sor: '#EE2A35',     // Red - Accent
  zer: '#FFD700',     // Gold - Secondary
  spi: '#FFFFFF',     // White - Background
  reş: '#000000',     // Black - Text
  // Extended colors
  mor: '#9C27B0',     // Purple - For special actions
  şîn: '#2196F3',     // Blue - For info/links
  gewr: '#9E9E9E',    // Gray - For disabled states
};

// Light theme color palette
export const LightColors = {
  primary: KurdistanColors.kesk,
  secondary: KurdistanColors.zer,
  accent: KurdistanColors.sor,
  background: '#F5F5F5',
  surface: KurdistanColors.spi,
  text: KurdistanColors.reş,
  textSecondary: '#666666',
  border: '#E0E0E0',
  error: KurdistanColors.sor,
  success: KurdistanColors.kesk,
  warning: KurdistanColors.zer,
  info: '#2196F3',
};

// Dark theme color palette
export const DarkColors = {
  primary: KurdistanColors.kesk,
  secondary: KurdistanColors.zer,
  accent: KurdistanColors.sor,
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  border: '#333333',
  error: KurdistanColors.sor,
  success: KurdistanColors.kesk,
  warning: KurdistanColors.zer,
  info: '#2196F3',
};

// Default to light theme for backward compatibility
export const AppColors = LightColors;

export default AppColors;
