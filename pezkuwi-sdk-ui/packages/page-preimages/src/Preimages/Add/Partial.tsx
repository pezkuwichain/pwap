// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import type { BN } from '@pezkuwi/util';
import type { HexString } from '@pezkuwi/util/types';
import type { HashState } from './types.js';

import React, { useCallback, useState } from 'react';

import { InputBalance, Modal, Static } from '@pezkuwi/react-components';
import { useApi } from '@pezkuwi/react-hooks';
import { Extrinsic } from '@pezkuwi/react-params';
import { BN_ZERO } from '@pezkuwi/util';
import { blake2AsHex } from '@pezkuwi/util-crypto';

import { useTranslation } from '../../translate.js';

interface Props {
  className?: string;
  onChange: (state: HashState) => void;
}

const EMPTY_HASH = blake2AsHex('');

export const EMPTY_PROPOSAL: HashState = {
  encodedHash: EMPTY_HASH,
  encodedLength: 0,
  encodedProposal: null,
  notePreimageTx: null,
  storageFee: BN_ZERO
};

function getState (api: ApiPromise, proposal?: SubmittableExtrinsic<'promise'>): HashState {
  let encodedHash = EMPTY_HASH;
  let encodedProposal: HexString | null = null;
  let encodedLength = 0;
  let notePreimageTx: SubmittableExtrinsic<'promise'> | null = null;
  let storageFee = BN_ZERO;

  if (proposal) {
    encodedProposal = proposal.method.toHex();
    encodedLength = Math.ceil((encodedProposal.length - 2) / 2);
    encodedHash = blake2AsHex(encodedProposal);
    notePreimageTx = api.tx.preimage.notePreimage(encodedProposal);

    // we currently don't have a constant exposed, however match to Bizinikiwi
    storageFee = ((api.consts.preimage?.baseDeposit || BN_ZERO) as unknown as BN).add(
      ((api.consts.preimage?.byteDeposit || BN_ZERO) as unknown as BN).muln(encodedLength)
    );
  }

  return {
    encodedHash,
    encodedLength,
    encodedProposal,
    notePreimageTx,
    storageFee
  };
}

function Partial ({ className, onChange }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api, apiDefaultTxSudo } = useApi();
  const [{ encodedHash, encodedLength, storageFee }, setState] = useState<HashState>(EMPTY_PROPOSAL);

  const changeState = useCallback(
    (state: HashState): void => {
      setState(state);
      onChange(state);
    },
    [onChange]
  );

  const setProposal = useCallback(
    (proposal?: SubmittableExtrinsic<'promise'>) =>
      changeState(getState(api, proposal)),
    [api, changeState]
  );

  return (
    <>
      <Modal.Columns
        className={className}
        hint={
          <>
            <p>{t('The image (proposal) will be stored on-chain against the hash of the contents.')}</p>
            <p>{t('When submitting a proposal the hash needs to be known. Proposals can be submitted with hash-only, but upon dispatch the preimage needs to be available.')}</p>
          </>
        }
      >
        <Extrinsic
          defaultValue={apiDefaultTxSudo}
          label={t('propose')}
          onChange={setProposal}
        />
        <Static
          label={t('preimage hash')}
          value={encodedHash}
          withCopy
        />
        <Static
          label={t('preimage length')}
          value={encodedLength || '0'}
          withCopy
        />
      </Modal.Columns>
      {!storageFee.isZero() && (
        <Modal.Columns
          className={className}
          hint={t('The calculated storage costs based on the base and the per-bytes fee.')}
        >
          <InputBalance
            defaultValue={storageFee}
            isDisabled
            label={t('calculated storage fee')}
          />
        </Modal.Columns>
      )}
    </>
  );
}

export default React.memo(Partial);
