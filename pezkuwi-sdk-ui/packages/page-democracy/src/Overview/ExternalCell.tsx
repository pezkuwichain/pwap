// Copyright 2017-2026 @pezkuwi/app-democracy authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveProposalImage } from '@pezkuwi/api-derive/types';
import type { Hash } from '@pezkuwi/types/interfaces';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';
import { CallExpander, Holder } from '@pezkuwi/react-params';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  value: Hash;
}

function ExternalCell ({ className = '', value }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const { api } = useApi();
  const preimage = useCall<DeriveProposalImage>(api.derive.democracy.preimage, [value]);

  if (!preimage?.proposal) {
    return null;
  }

  return (
    <Holder
      className={className}
      withBorder
      withPadding
    >
      <CallExpander
        labelHash={t('proposal hash')}
        value={preimage.proposal}
        withHash
      />
    </Holder>
  );
}

export default React.memo(ExternalCell);
