// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Preimage } from '@pezkuwi/react-hooks/types';

import React, { useMemo } from 'react';

import { AddressMini, CopyButton, MarkError, MarkWarning, styled } from '@pezkuwi/react-components';
import { ZERO_ACCOUNT } from '@pezkuwi/react-hooks/useWeight';
import { CallExpander } from '@pezkuwi/react-params';
import { Null } from '@pezkuwi/types-codec';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  noTmp?: boolean;
  value?: Preimage;
}

function PreimageCall ({ className = '', value }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();

  const link = useMemo(
    () =>
      value?.proposal
        ? `#/extrinsics/decode/${value?.proposal?.toHex()}`
        : null,
    [value]
  );

  return (
    <>
      <td className={`${className} all`}>
        {value && value.isCompleted
          ? (
            <>
              {value.proposal && (
                <CallExpander
                  labelHash={t('call')}
                  value={value.proposal}
                />
              )}
              {link && (
                <StyledDiv>
                  <a
                    className='isDecoded'
                    href={link}
                    rel='noreferrer'
                  >{link.slice(0, 30)}...</a>
                  <CopyButton value={value.proposal?.toHex()} />
                </StyledDiv>
              )}
              {value.proposalError
                ? <MarkError content={value.proposalError} />
                : value.proposalWarning
                  ? <MarkWarning content={value.proposalWarning} />
                  : null
              }
            </>
          )
          : <div className='--tmp'>balances.transfer</div>
        }
      </td>
      <td className='address media--1300'>
        {value && value.isCompleted
          ? value.deposit
            ? (
              <AddressMini
                // HACK: In the rare case that the value is passed down as a Null Codec type as seen with Tangle
                // We ensure to handle that case. ref: https://github.com/pezkuwi-js/apps/issues/10793
                balance={!(value.deposit.amount instanceof Null) ? value.deposit.amount : undefined}
                value={value.deposit.who}
                withBalance
              />
            )
            : null
          : (
            <AddressMini
              className='--tmp'
              value={ZERO_ACCOUNT}
            />
          )}
      </td>
    </>
  );
}

const StyledDiv = styled.div`
  display: flex;
  align-items: center;
  margin: -0.4rem 0rem -0.4rem 1rem;
  white-space: nowrap;
`;

export default React.memo(PreimageCall);
