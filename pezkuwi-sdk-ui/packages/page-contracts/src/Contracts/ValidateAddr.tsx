// Copyright 2017-2026 @pezkuwi/app-contracts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { ContractInfo } from '@pezkuwi/types/interfaces';

import React, { useEffect, useState } from 'react';

import { InfoForInput } from '@pezkuwi/react-components';
import { useApi, useCall } from '@pezkuwi/react-hooks';
import { keyring } from '@pezkuwi/ui-keyring';

import { useTranslation } from '../translate.js';

interface Props {
  address?: string | null;
  onChange: (isValid: boolean) => void;
}

function ValidateAddr ({ address, onChange }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const { api } = useApi();
  const contractInfo = useCall<Option<ContractInfo>>(api.query.contracts.contractInfoOf, [address]);
  const [isAddress, setIsAddress] = useState(false);
  const [isStored, setIsStored] = useState(false);

  useEffect((): void => {
    try {
      keyring.decodeAddress(address || '');
      setIsAddress(true);
    } catch {
      setIsAddress(false);
    }
  }, [address]);

  useEffect((): void => {
    setIsStored(!!contractInfo?.isSome);
  }, [contractInfo]);

  useEffect((): void => {
    onChange(isAddress && isStored);
  }, [isAddress, isStored, onChange]);

  if (isStored || !isAddress) {
    return null;
  }

  return (
    <InfoForInput type='error'>
      {isAddress
        ? t('Unable to find deployed contract code at the specified address')
        : t('The value is not in a valid address format')
      }
    </InfoForInput>
  );
}

export default React.memo(ValidateAddr);
