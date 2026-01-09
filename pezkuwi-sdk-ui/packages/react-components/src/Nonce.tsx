// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, AccountIndex, Address } from '@pezkuwi/types/interfaces';

import React from 'react';

import { Nonce } from '@pezkuwi/react-query';

export interface Props {
  className?: string;
  label?: React.ReactNode;
  params?: AccountId | AccountIndex | Address | string | Uint8Array | null;
}

function NonceDisplay ({ className = '', label, params }: Props): React.ReactElement<Props> | null {
  if (!params) {
    return null;
  }

  return (
    <Nonce
      className={`${className} ui--Nonce`}
      label={label}
      params={params.toString()}
    />
  );
}

export default React.memo(NonceDisplay);
