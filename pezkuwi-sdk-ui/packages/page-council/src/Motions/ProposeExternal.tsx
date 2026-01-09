// Copyright 2017-2026 @pezkuwi/app-council authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import type { BN } from '@pezkuwi/util';
import type { HexString } from '@pezkuwi/util/types';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getProposalThreshold } from '@pezkuwi/apps-config';
import { Button, Input, InputAddress, InputNumber, Modal, TxButton } from '@pezkuwi/react-components';
import { useApi, useCollectiveInstance, usePreimage, useToggle } from '@pezkuwi/react-hooks';
import { BN_ZERO, isFunction, isHex } from '@pezkuwi/util';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  isMember: boolean;
  members: string[];
}

interface HashState {
  hash?: HexString | null;
  isHashValid: boolean;
}

interface ImageState {
  imageLen: BN;
  imageLenDefault?: BN;
  isImageLenValid: boolean;
}

interface ProposalState {
  proposal?: SubmittableExtrinsic<'promise'> | null;
  proposalLength: number;
}

function ProposeExternal ({ className = '', isMember, members }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();
  const { api } = useApi();
  const [isVisible, toggleVisible] = useToggle();
  const [accountId, setAcountId] = useState<string | null>(null);
  const [{ proposal, proposalLength }, setProposal] = useState<ProposalState>({ proposalLength: 0 });
  const [{ hash, isHashValid }, setHash] = useState<HashState>({ isHashValid: false });
  const [{ imageLen, imageLenDefault, isImageLenValid }, setImageLen] = useState<ImageState>({ imageLen: BN_ZERO, isImageLenValid: false });
  const modLocation = useCollectiveInstance('council');
  const preimage = usePreimage(hash);

  const threshold = Math.min(members.length, Math.ceil((members.length || 0) * getProposalThreshold(api)));

  const isCurrentPreimage = useMemo(
    () => isFunction(api.tx.preimage?.notePreimage) && !isFunction(api.tx.democracy?.notePreimage),
    [api]
  );

  const _onChangeHash = useCallback(
    (hash?: string): void =>
      setHash({ hash: hash as HexString, isHashValid: isHex(hash, 256) }),
    []
  );

  const _onChangeImageLen = useCallback(
    (value?: BN): void => {
      value && setImageLen((prev) => ({
        imageLen: value,
        imageLenDefault: prev.imageLenDefault,
        isImageLenValid: !value.isZero()
      }));
    },
    []
  );

  useEffect((): void => {
    preimage?.proposalLength && setImageLen((prev) => ({
      imageLen: prev.imageLen,
      imageLenDefault: preimage.proposalLength,
      isImageLenValid: prev.isImageLenValid
    }));
  }, [preimage]);

  useEffect((): void => {
    if (isHashValid && hash) {
      const proposal = isCurrentPreimage
        ? preimage && api.tx.democracy.externalProposeMajority({
          Lookup: {
            hash: preimage.proposalHash,
            len: preimage.proposalLength || imageLen
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : api.tx.democracy.externalProposeMajority(hash as any);

      if (proposal) {
        return setProposal({
          proposal,
          proposalLength: proposal.encodedLength || 0
        });
      }
    }

    setProposal({
      proposal: null,
      proposalLength: 0
    });
  }, [api, hash, isCurrentPreimage, isHashValid, imageLen, preimage]);

  if (!modLocation) {
    return null;
  }

  return (
    <>
      <Button
        icon='plus'
        isDisabled={!isMember}
        label={t('Propose external')}
        onClick={toggleVisible}
      />
      {isVisible && (
        <Modal
          className={className}
          header={t('Propose external (majority)')}
          onClose={toggleVisible}
          size='large'
        >
          <Modal.Content>
            <Modal.Columns hint={t('The council account for the proposal. The selection is filtered by the current members.')}>
              <InputAddress
                filter={members}
                label={t('propose from account')}
                onChange={setAcountId}
                type='account'
                withLabel
              />
            </Modal.Columns>
            <Modal.Columns hint={t('The hash of the proposal image, either already submitted or valid for the specific call.')}>
              <Input
                autoFocus
                isError={!isHashValid}
                label={t('preimage hash')}
                onChange={_onChangeHash}
                value={hash}
              />
              {isCurrentPreimage && (
                <InputNumber
                  defaultValue={imageLenDefault}
                  isDisabled={!!preimage?.proposalLength && !preimage?.proposalLength.isZero() && isHashValid && isImageLenValid}
                  isError={!isImageLenValid}
                  key='inputLength'
                  label={t('preimage length')}
                  onChange={_onChangeImageLen}
                  value={imageLen}
                />
              )}
            </Modal.Columns>
          </Modal.Content>
          <Modal.Actions>
            <TxButton
              accountId={accountId}
              icon='plus'
              isDisabled={!threshold || !members.includes(accountId || '') || !proposal || (isCurrentPreimage && !isImageLenValid)}
              label={t('Propose')}
              onStart={toggleVisible}
              params={
                api.tx[modLocation].propose.meta.args.length === 3
                  ? [threshold, proposal, proposalLength]
                  : [threshold, proposal]
              }
              tx={api.tx[modLocation].propose}
            />
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
}

export default React.memo(ProposeExternal);
