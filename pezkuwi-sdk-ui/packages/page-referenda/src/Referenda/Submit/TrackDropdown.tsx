// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';
import type { PezpalletReferenda, TrackDescription } from '../../types.js';

import React from 'react';

import { Dropdown, styled } from '@pezkuwi/react-components';

import { useTranslation } from '../../translate.js';
import useTrackOptions from './useTrackOptions.js';

interface Props {
  className?: string;
  exclude?: (BN | number)[];
  include?: (BN | number)[];
  onChange: (trackId: number) => void;
  palletReferenda: PezpalletReferenda;
  tracks: TrackDescription[];
}

function TrackDropdown ({ className, exclude, include, onChange, palletReferenda, tracks }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const trackOpts = useTrackOptions(palletReferenda, tracks, include, exclude);

  return (
    <Dropdown
      className={className}
      defaultValue={trackOpts[0].value}
      label={t('submission track')}
      onChange={onChange}
      options={trackOpts}
    />
  );
}

const StyledTrackDropdown: React.FC<Props> = styled(TrackDropdown)`
  .trackOption {
    .faded {
      font-size: var(--font-size-small);
      font-weight: var(--font-weight-normal);
      margin-top: 0.125rem;
      opacity: 0.6;
    }
  }
`;

export default React.memo(StyledTrackDropdown);
