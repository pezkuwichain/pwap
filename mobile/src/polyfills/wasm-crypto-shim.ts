/**
 * React Native shim for @pezkuwi/wasm-crypto
 * Provides waitReady() and isReady() using ASM.js
 */
if (__DEV__) console.warn('🔧 [SHIM] ==========================================');
if (__DEV__) console.warn('🔧 [SHIM] WASM-CRYPTO SHIM LOADING...');
if (__DEV__) console.warn('🔧 [SHIM] ==========================================');

if (__DEV__) console.warn('📦 [SHIM] Importing Bridge...');
import { Bridge } from '@pezkuwi/wasm-bridge';
if (__DEV__) console.warn('✅ [SHIM] Bridge imported');

if (__DEV__) console.warn('📦 [SHIM] Importing createWasm (ASM.js)...');
import { createWasm } from '@pezkuwi/wasm-crypto-init/asm';
if (__DEV__) console.warn('✅ [SHIM] createWasm imported');

if (__DEV__) console.warn('🏗️ [SHIM] Creating Bridge instance...');
// Create bridge with ASM.js
export const bridge = new Bridge(createWasm);
if (__DEV__) console.warn('✅ [SHIM] Bridge instance created');

// Export isReady
export function isReady(): boolean {
  const ready = !!bridge.wasm;
  if (__DEV__) console.warn('🔍 [SHIM] isReady() called, result:', ready);
  return ready;
}

// Export waitReady
export async function waitReady(): Promise<boolean> {
  if (__DEV__) console.warn('⏳ [SHIM] waitReady() called');
  try {
    if (__DEV__) console.warn('🔄 [SHIM] Initializing ASM.js bridge...');
    const wasm = await bridge.init(createWasm);
    const success = !!wasm;
    if (__DEV__) console.warn('✅ [SHIM] ASM.js bridge initialized successfully:', success);
    return success;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    if (__DEV__) console.warn('❌ [SHIM] Failed to initialize ASM.js:', errorMessage);
    if (__DEV__) console.warn('❌ [SHIM] Error stack:', errorStack);
    return false;
  }
}

if (__DEV__) console.warn('📦 [SHIM] Re-exporting bundle functions...');
// Re-export all crypto functions from bundle
export * from '@pezkuwi/wasm-crypto/bundle';
if (__DEV__) console.warn('✅ [SHIM] All exports configured');

if (__DEV__) console.warn('🔧 [SHIM] ==========================================');
if (__DEV__) console.warn('🔧 [SHIM] SHIM LOADED SUCCESSFULLY');
if (__DEV__) console.warn('🔧 [SHIM] ==========================================');
