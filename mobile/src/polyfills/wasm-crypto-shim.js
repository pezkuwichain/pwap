/**
 * React Native shim for @pezkuwi/wasm-crypto
 * Provides waitReady() and isReady() using ASM.js
 */
console.log('🔧 [SHIM] ==========================================');
console.log('🔧 [SHIM] WASM-CRYPTO SHIM LOADING...');
console.log('🔧 [SHIM] ==========================================');

console.log('📦 [SHIM] Importing Bridge...');
import { Bridge } from '@pezkuwi/wasm-bridge';
console.log('✅ [SHIM] Bridge imported');

console.log('📦 [SHIM] Importing createWasm (ASM.js)...');
import { createWasm } from '@pezkuwi/wasm-crypto-init/asm';
console.log('✅ [SHIM] createWasm imported');

console.log('🏗️ [SHIM] Creating Bridge instance...');
// Create bridge with ASM.js
export const bridge = new Bridge(createWasm);
console.log('✅ [SHIM] Bridge instance created');

// Export isReady
export function isReady() {
  const ready = !!bridge.wasm;
  console.log('🔍 [SHIM] isReady() called, result:', ready);
  return ready;
}

// Export waitReady
export async function waitReady() {
  console.log('⏳ [SHIM] waitReady() called');
  try {
    console.log('🔄 [SHIM] Initializing ASM.js bridge...');
    const wasm = await bridge.init(createWasm);
    const success = !!wasm;
    console.log('✅ [SHIM] ASM.js bridge initialized successfully:', success);
    return success;
  } catch (error) {
    console.error('❌ [SHIM] Failed to initialize ASM.js:', error);
    console.error('❌ [SHIM] Error stack:', error.stack);
    return false;
  }
}

console.log('📦 [SHIM] Re-exporting bundle functions...');
// Re-export all crypto functions from bundle
export * from '@pezkuwi/wasm-crypto/bundle';
console.log('✅ [SHIM] All exports configured');

console.log('🔧 [SHIM] ==========================================');
console.log('🔧 [SHIM] SHIM LOADED SUCCESSFULLY');
console.log('🔧 [SHIM] ==========================================');
