// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { HexString } from '@pezkuwi/util/types';

import React, { useCallback, useMemo } from 'react';

import { useApi } from '@pezkuwi/react-hooks';
import { chains } from '@pezkuwi/ui-settings/defaults/chains';

import { styled } from './styled.js';
import Toggle from './Toggle.js';
import { useTranslation } from './translate.js';

interface Props {
  className?: string;
  genesisHash: string | null;
  isDisabled?: boolean;
  onChange: (genesisHash: HexString | null) => void;
}

function calcLock (apiGenesis: string, genesisHash: string | null): boolean {
  if (!genesisHash) {
    return false;
  }

  return (
    Object.values(chains).find((hashes): boolean =>
      hashes.includes(apiGenesis)
    ) || [apiGenesis]
  ).includes(genesisHash);
}

function ChainLock ({ className = '', genesisHash, isDisabled, onChange }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const { api, isDevelopment } = useApi();

  const isTiedToChain = useMemo(
    () => calcLock(api.genesisHash.toHex(), genesisHash),
    [api, genesisHash]
  );

  const _onChange = useCallback(
    (isTiedToChain: boolean) =>
      onChange(
        isTiedToChain
          ? api.genesisHash.toHex()
          : null
      ),
    [api, onChange]
  );

  if (isDevelopment) {
    return null;
  }

  return (
    <StyledToggle
      className={className}
      isDisabled={isDisabled}
      label={t('only this network')}
      onChange={_onChange}
      preventDefault
      value={isTiedToChain}
    />
  );
}

const StyledToggle = styled(Toggle)`
  text-align: right;
`;

export default React.memo(ChainLock);
