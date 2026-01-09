// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletBrokerScheduleItem } from '@pezkuwi/types/lookup';

import { BN } from '@pezkuwi/util';

export function hexToBin (hex: string): string {
  return parseInt(hex, 16).toString(2);
}

export function processHexMask (mask: PezpalletBrokerScheduleItem['mask'] | undefined): string[] {
  if (!mask) {
    return [];
  }

  const trimmedHex: string = mask.toHex().slice(2);
  const arr: string[] = trimmedHex.split('');
  const buffArr: string[] = [];

  arr.forEach((bit) => {
    hexToBin(bit).split('').forEach((v) => buffArr.push(v));
  });
  buffArr.filter((v) => v === '1');

  return buffArr;
}

export function stringToBN (value: string | undefined): BN {
  if (!value) {
    return new BN(0);
  }

  const sanitized = value.trim().replace(/,/g, '');

  if (!/^\d+$/.test(sanitized)) {
    throw new Error(`Invalid input for BN conversion: "${sanitized}"`);
  }

  return new BN(sanitized);
}
