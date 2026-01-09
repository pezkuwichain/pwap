// Copyright 2017-2026 @pezkuwi/app-js authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { SubmittableExtrinsic } from '@pezkuwi/api/types';

import React, { useCallback, useState } from 'react';

import { Button, Icon, styled, Toggle, TxButton } from '@pezkuwi/react-components';
import { useApi, useToggle } from '@pezkuwi/react-hooks';
import { Extrinsic } from '@pezkuwi/react-params';
import { isFunction } from '@pezkuwi/util';

import { useTranslation } from './translate.js';

interface Props {
  className?: string;
  isMine: boolean;
  sudoKey?: string;
}

function Sudo ({ className, isMine, sudoKey }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const [withWeight, toggleWithWeight] = useToggle();
  const [extrinsic, setExtrinsic] = useState<SubmittableExtrinsic<'promise'> | null>(null);

  const _onChangeExtrinsic = useCallback(
    (method?: SubmittableExtrinsic<'promise'>) => {
      setExtrinsic(() => method || null);
    },
    []
  );

  return isMine
    ? (
      <StyledSection className={className}>
        <Extrinsic
          defaultValue={withWeight ? api.tx.sudo.sudoUncheckedWeight : api.tx.sudo.sudo}
          isDisabled
          key={String(withWeight)}
          label={t('submit the following change')}
          onChange={_onChangeExtrinsic}
        />
        {isFunction(api.tx.sudo.sudoUncheckedWeight) && (
          <Toggle
            className='sudoToggle'
            label={t('with weight override')}
            onChange={toggleWithWeight}
            value={withWeight}
          />
        )}
        <Button.Group>
          <TxButton
            accountId={sudoKey}
            extrinsic={extrinsic}
            icon='sign-in-alt'
            isDisabled={!extrinsic}
            label={
              withWeight
                ? t('Submit Sudo Unchecked')
                : t('Submit Sudo')
            }
          />
        </Button.Group>
      </StyledSection>
    )
    : (
      <article className='error padded'>
        <div>
          <Icon icon='ban' />
          {t('You do not have access to the current sudo key')}
        </div>
      </article>
    );
}

const StyledSection = styled.section`
  .sudoToggle {
    width: 100%;
    text-align: right;
    padding-top: 1rem;
  }
`;

export default React.memo(Sudo);
