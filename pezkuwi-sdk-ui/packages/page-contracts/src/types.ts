// Copyright 2017-2026 @pezkuwi/app-contracts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type React from 'react';
import type { Abi } from '@pezkuwi/api-contract';
import type { WeightV2 } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface CodeJson {
  abi?: string | null;
  codeHash: string;
  name: string;
  genesisHash: string;
  tags: string[];
  whenCreated: number;
}

export interface CodeStored {
  json: CodeJson;
  contractAbi?: Abi;
}

export interface ContractJsonOld {
  genesisHash: string;
  abi: string;
  address: string;
  name: string;
}

export interface UseWeight {
  executionTime: number;
  isEmpty: boolean;
  isValid: boolean;
  isWeightV2: boolean;
  megaGas: BN;
  megaRefTime: BN;
  proofSize: BN;
  percentage: number;
  setIsEmpty: React.Dispatch<boolean>
  setMegaGas: React.Dispatch<BN | undefined>;
  setMegaRefTime: React.Dispatch<BN | undefined>;
  setProofSize: React.Dispatch<BN | undefined>;
  weight: BN;
  weightV2: WeightV2;
}
