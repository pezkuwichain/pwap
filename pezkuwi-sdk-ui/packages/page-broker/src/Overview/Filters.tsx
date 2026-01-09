// Copyright 2017-2026 @pezkuwi/app-broker authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { CoreInfo } from '../types.js';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Dropdown, Input, styled } from '@pezkuwi/react-components';
import { useDebounce } from '@pezkuwi/react-hooks';

import { useTranslation } from '../translate.js';

const StyledDiv = styled.div`
  @media (max-width: 768px) {
    max-width: 100%:
  }
`;

interface Props {
  data: CoreInfo[];
  onFilter: (data: CoreInfo[]) => void
}

const filterLoad = (teyrchainId: string, data: CoreInfo[], workloadCoreSelected: number): CoreInfo[] => {
  if (teyrchainId) {
    return data.filter(({ workload, workplan }) => !!workload?.filter(({ info }) => info.task === teyrchainId).length || !!workplan?.filter(({ info }) => info.task === teyrchainId).length);
  }

  if (workloadCoreSelected === -1) {
    return data;
  }

  return data.filter((one) => one.core === workloadCoreSelected);
};

function Filters ({ data, onFilter }: Props): React.ReactElement<Props> {
  const [workloadCoreSelected, setWorkloadCoreSelected] = useState(-1);
  const [_teyrchainId, setTeyrChainId] = useState<string>('');

  const coreArr: number[] = useMemo(() =>
    data?.length
      ? Array.from({ length: data.length || 0 }, (_, index) => index)
      : []
  , [data]);

  const { t } = useTranslation();
  const teyrchainId = useDebounce(_teyrchainId);

  const workloadCoreOpts = useMemo(
    () => coreArr && [{ text: t('All active/available cores'), value: -1 }].concat(
      coreArr
        .map((c) => (
          {
            text: `Core ${c}`,
            value: c
          }
        ))
        .filter((v): v is { text: string, value: number } => !!v.text)
    ),
    [coreArr, t]
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    const filtered = filterLoad(teyrchainId, data, workloadCoreSelected);

    onFilter(filtered);
  }, [data, workloadCoreSelected, teyrchainId, onFilter]);

  const onDropDownChange = useCallback((v: number) => {
    setWorkloadCoreSelected(v);
    setTeyrChainId('');
  }, []);

  const onInputChange = useCallback((v: string) => {
    setTeyrChainId(v);
    setWorkloadCoreSelected(-1);
  }, []);

  return (
    <StyledDiv style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxWidth: '300px' }}>
      <Dropdown
        className='isSmall'
        label={t('selected core')}
        onChange={onDropDownChange}
        options={workloadCoreOpts}
        value={workloadCoreSelected}
      />
      <div style={{ minWidth: '150px' }}>
        <Input
          className='full isSmall'
          label={t('teyrchain id')}
          onChange={onInputChange}
          placeholder={t('teyrchain id')}
          value={_teyrchainId}
        />
      </div>
    </StyledDiv>

  );
}

export default React.memo(Filters);
