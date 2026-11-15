// Values for the three Node globals that some browser dependencies reference as free
// identifiers (WalletConnect calls `Buffer.from(...)` unguarded; a few libraries probe
// `global` / `process`). vite.config.ts injects these as scoped imports into exactly the
// modules that reference them - the build through @rollup/plugin-inject, the dev pre-bundle
// through esbuild's `inject` - so nothing is assigned onto `globalThis`.
//
// Nothing here may read the bare `process` / `global` / `Buffer` identifiers at runtime:
// the injector would rewrite them into a self-import. Use bracket access on globalThis.
import { Buffer } from 'buffer';

const g = globalThis as unknown as Record<string, unknown>;

const nodeGlobal = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeProcess = (g['process'] ?? { env: {} }) as any;

export { Buffer, nodeGlobal as global, nodeProcess as process };
