// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Abi } from '@pezkuwi/api-contract';
import { statics } from '@pezkuwi/react-api/statics';

import { getAddressMeta } from './getAddressMeta.js';

export function getContractAbi (address: string | null): Abi | null {
  if (!address) {
    return null;
  }

  let abi: Abi | undefined;
  const meta = getAddressMeta(address, 'contract');

  try {
    const data = (meta.contract && JSON.parse(meta.contract.abi)) as string;

    abi = new Abi(data, statics.api.registry.getChainProperties());
  } catch (error) {
    console.error(error);
  }

  return abi || null;
}
