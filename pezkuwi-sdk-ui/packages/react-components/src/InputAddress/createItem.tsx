// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { KeyringSectionOption } from '@pezkuwi/ui-keyring/options/types';
import type { Option } from './types.js';

import React from 'react';

import { keyring } from '@pezkuwi/ui-keyring';
import { decodeAddress } from '@pezkuwi/util-crypto';

import KeyPair from './KeyPair.js';

export default function createItem (option: KeyringSectionOption, isUppercase = true): Option | null {
  const allowedLength = keyring.keyring.type === 'ethereum'
    ? 20
    : 32;

  try {
    if (decodeAddress(option.key).length >= allowedLength) {
      return {
        ...option,
        text: (
          <KeyPair
            address={option.key || ''}
            isUppercase={isUppercase}
            name={option.name}
          />
        )
      };
    }
  } catch {
    // ignore
  }

  return null;
}
