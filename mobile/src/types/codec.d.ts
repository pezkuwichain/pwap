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
    unwrap(): unknown;
    unwrapOr<T>(defaultValue: T): T | unknown;
    unwrapOrDefault(): unknown;

    // Primitive conversions
    toNumber(): number;
    toBigInt(): bigint;
    toJSON(): unknown;
    toString(): string;
    toHex(): string;

    // Common properties
    data?: { free?: Codec; balance?: Codec };
    free?: Codec;
    balance?: Codec;
    commission?: Codec;
    keys?: Codec[];

    // Delegation checks
    isDelegating?: boolean;
    asDelegating?: { target: Codec; balance: Codec; conviction: Codec };

    // Iterator support
    [Symbol.iterator]?(): Iterator<unknown>;
    map?<T>(fn: (value: unknown) => T): T[];
  }
}

declare module '@pezkuwi/types-codec' {
  interface Codec {
    isNone: boolean;
    isSome: boolean;
    isEmpty: boolean;
    unwrap(): unknown;
    unwrapOr<T>(defaultValue: T): T | unknown;
    unwrapOrDefault(): unknown;
    toNumber(): number;
    toBigInt(): bigint;
    toJSON(): unknown;
    toString(): string;
    toHex(): string;
    data?: { free?: Codec; balance?: Codec };
    free?: Codec;
    balance?: Codec;
    commission?: Codec;
    keys?: Codec[];
    isDelegating?: boolean;
    asDelegating?: { target: Codec; balance: Codec; conviction: Codec };
    [Symbol.iterator]?(): Iterator<unknown>;
    map?<T>(fn: (value: unknown) => T): T[];
  }
}
