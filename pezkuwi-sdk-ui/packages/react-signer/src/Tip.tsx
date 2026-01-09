// Copyright 2017-2026 @pezkuwi/react-signer authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

import React, { useEffect, useState } from 'react';

import { InputBalance, Modal, Toggle } from '@pezkuwi/react-components';
import { BN_ZERO } from '@pezkuwi/util';

import { useTranslation } from './translate.js';

interface Props {
  className?: string;
  onChange: (tip?: BN) => void;
}

function Tip ({ className, onChange }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const [tip, setTip] = useState<BN | undefined>();
  const [showTip, setShowTip] = useState(false);

  useEffect((): void => {
    onChange(showTip ? tip : BN_ZERO);
  }, [onChange, showTip, tip]);

  return (
    <Modal.Columns
      className={className}
      hint={t('Adding an optional tip to the transaction could allow for higher priority, especially when the chain is busy.')}
    >
      <Toggle
        className='tipToggle'
        label={
          showTip
            ? t('Include an optional tip for faster processing')
            : t('Do not include a tip for the block author')
        }
        onChange={setShowTip}
        value={showTip}
      />
      {showTip && (
        <InputBalance
          isZeroable
          label={t('Tip (optional)')}
          onChange={setTip}
        />
      )}
    </Modal.Columns>
  );
}

export default React.memo(Tip);
