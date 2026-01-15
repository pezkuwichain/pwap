/**
 * Type augmentations for Polkadot.js Codec type
 * These extend the base Codec type with Option-like methods
 */

import '@pezkuwi/types';

declare module '@pezkuwi/types/types/codec' {
  interface Codec {
    // Option methods
    isNone: boolean;
    isSome: boolean;
    isEmpty: boolean;
    unwrap(): any;
    unwrapOr<T>(defaultValue: T): any;
    unwrapOrDefault(): any;

    // Primitive conversions
    toNumber(): number;
    toBigInt(): bigint;
    toJSON(): any;
    toString(): string;
    toHex(): string;

    // Common properties
    data?: any;
    free?: any;
    balance?: any;
    commission?: any;
    keys?: any;

    // Delegation checks
    isDelegating?: boolean;
    asDelegating?: any;

    // Iterator support
    [Symbol.iterator]?(): Iterator<any>;
    map?<T>(fn: (value: any) => T): T[];
  }
}

declare module '@pezkuwi/types-codec' {
  interface Codec {
    isNone: boolean;
    isSome: boolean;
    isEmpty: boolean;
    unwrap(): any;
    unwrapOr<T>(defaultValue: T): any;
    unwrapOrDefault(): any;
    toNumber(): number;
    toBigInt(): bigint;
    toJSON(): any;
    toString(): string;
    toHex(): string;
    data?: any;
    free?: any;
    balance?: any;
    commission?: any;
    keys?: any;
    isDelegating?: boolean;
    asDelegating?: any;
    [Symbol.iterator]?(): Iterator<any>;
    map?<T>(fn: (value: any) => T): T[];
  }
}
