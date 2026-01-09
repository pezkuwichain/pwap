// Copyright 2017-2026 @pezkuwi/app-assets authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletAssetsAssetDetails, PezpalletAssetsAssetMetadata } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

import React from 'react';

import { Button } from '@pezkuwi/react-components';
import { useToggle } from '@pezkuwi/react-hooks';

import { useTranslation } from '../../translate.js';
import Modal from './Mint.js';

interface Props {
  className?: string;
  details: PezpalletAssetsAssetDetails;
  id: BN;
  metadata: PezpalletAssetsAssetMetadata;
}

function Mint ({ className, details, id, metadata }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const [isOpen, toggleOpen] = useToggle();

  return (
    <>
      <Button
        icon='plus'
        isDisabled={metadata.isFrozen.isTrue}
        label={t('Mint')}
        onClick={toggleOpen}
      />
      {isOpen && (
        <Modal
          className={className}
          details={details}
          id={id}
          metadata={metadata}
          onClose={toggleOpen}
        />
      )}
    </>
  );
}

export default React.memo(Mint);
