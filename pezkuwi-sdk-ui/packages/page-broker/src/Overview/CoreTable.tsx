// Copyright 2017-2026 @pezkuwi/app-broker authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { PezpalletBrokerConfigRecord } from '@pezkuwi/react-hooks/types';

import React, { useRef } from 'react';

import { Table } from '@pezkuwi/react-components';

import { useTranslation } from '../translate.js';
import { type CoreWorkloadType, type CoreWorkplanType } from '../types.js';
import Workload from './Workload.js';

interface Props {
  api: ApiPromise;
  core: number;
  config: PezpalletBrokerConfigRecord,
  workload?: CoreWorkloadType[],
  workplan?: CoreWorkplanType[],
}

function CoreTable ({ api, config, core, workload, workplan }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const headerRef = useRef<([React.ReactNode?, string?] | false)[]>([[t('core')]]);
  const header: [React.ReactNode?, string?, number?, (() => void)?][] = [
    [
      <div key={`header${core}`}>{headerRef.current} {core} <span></span></div>,
      'core',
      9,
      undefined
    ]
  ];

  return (
    <Table
      emptySpinner={true}
      header={header}
      isSplit={false}
      key={core}
    >
      <Workload
        api={api}
        config={config}
        core={core}
        key={core}
        workload={workload}
        workplan={workplan}
      />

    </Table>
  );
}

export default React.memo(CoreTable);
