/**
 * Type declarations for external modules
 */

// Pezkuwi extension types
declare module '@pezkuwi/extension-inject/types' {
  import type { Signer } from '@pezkuwi/api/types';

  export interface InjectedAccountWithMeta {
    address: string;
    meta: {
      name?: string;
      source: string;
      genesisHash?: string;
    };
  }

  export interface InjectedExtension {
    name: string;
    version: string;
    accounts: {
      get: () => Promise<InjectedAccountWithMeta[]>;
      subscribe: (cb: (accounts: InjectedAccountWithMeta[]) => void) => () => void;
    };
    signer: Signer;
  }
}

declare module '@pezkuwi/extension-dapp' {
  import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';

  interface InjectedWeb3 {
    signer: any;
    name: string;
    version: string;
  }

  export function web3Enable(appName: string): Promise<InjectedWeb3[]>;
  export function web3Accounts(): Promise<InjectedAccountWithMeta[]>;
  export function web3FromAddress(address: string): Promise<InjectedWeb3>;
  export function web3FromSource(source: string): Promise<InjectedWeb3>;
}

// Path alias for shared lib - used in web context
declare module '@/lib/supabase' {
  export const supabase: any;
}

// Import.meta.env for Vite-like environments
interface ImportMetaEnv {
  readonly VITE_PINATA_API_KEY?: string;
  readonly VITE_PINATA_SECRET_KEY?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
