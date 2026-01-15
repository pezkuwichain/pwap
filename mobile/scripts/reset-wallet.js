/**
 * Reset Wallet Script
 *
 * Clears all wallet data from AsyncStorage for testing purposes.
 * Run with: node scripts/reset-wallet.js
 *
 * Note: This only works in development. For the actual app,
 * you need to clear the app data or use the in-app reset.
 */

console.log('='.repeat(50));
console.log('WALLET RESET INSTRUCTIONS');
console.log('='.repeat(50));
console.log('');
console.log('To reset wallet data in the app, do ONE of these:');
console.log('');
console.log('1. Clear App Data (Easiest):');
console.log('   - iOS Simulator: Device > Erase All Content and Settings');
console.log('   - Android: Settings > Apps > Pezkuwi > Clear Data');
console.log('   - Expo Go: Shake device > Clear AsyncStorage');
console.log('');
console.log('2. In Expo Go, run this in the console:');
console.log('   AsyncStorage.multiRemove([');
console.log('     "@pezkuwi_wallets",');
console.log('     "@pezkuwi_selected_account",');
console.log('     "@pezkuwi_selected_network"');
console.log('   ])');
console.log('');
console.log('3. Add temp reset button (already added to Settings)');
console.log('');
console.log('='.repeat(50));
