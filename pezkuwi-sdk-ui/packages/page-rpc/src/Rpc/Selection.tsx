// Copyright 2017-2026 @pezkuwi/app-rpc authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { QueueTxRpcAdd } from '@pezkuwi/react-components/Status/types';
import type { ParamDef, RawParam } from '@pezkuwi/react-params/types';
import type { DefinitionRpcExt } from '@pezkuwi/types/types';

import React, { useCallback, useMemo, useState } from 'react';

import { Button, InputRpc } from '@pezkuwi/react-components';
import Params from '@pezkuwi/react-params';
import { getTypeDef } from '@pezkuwi/types/create';
import jsonrpc from '@pezkuwi/types/interfaces/jsonrpc';
import { isNull } from '@pezkuwi/util';

import { useTranslation } from '../translate.js';

interface Props {
  queueRpc: QueueTxRpcAdd;
}

interface State {
  isValid: boolean;
  rpc: DefinitionRpcExt;
  values: RawParam[];
}

const defaultMethod = jsonrpc.author.submitExtrinsic;

function Selection ({ queueRpc }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const [{ isValid, rpc, values }, setState] = useState<State>({
    isValid: false,
    rpc: defaultMethod,
    values: []
  });

  const params = useMemo(
    () => rpc.params.map(({ isOptional, name, type }): ParamDef => ({
      name,
      type: getTypeDef(isOptional ? `Option<${type}>` : type)
    })),
    [rpc]
  );

  const _nextState = useCallback(
    (newState: Partial<State>) => setState((prevState: State): State => {
      const { rpc = prevState.rpc, values = prevState.values } = newState;
      const reqCount = rpc.params.reduce((count, { isOptional }) => count + (isOptional ? 0 : 1), 0);
      const isValid = values.reduce((isValid, value) => isValid && value.isValid === true, reqCount <= values.length);

      return {
        isValid,
        rpc,
        values
      };
    }),
    []
  );

  const _onChangeMethod = useCallback(
    (rpc: DefinitionRpcExt) => _nextState({ rpc, values: [] }),
    [_nextState]
  );

  const _onChangeValues = useCallback(
    (values: RawParam[]) => _nextState({ values }),
    [_nextState]
  );

  const _onSubmit = useCallback(
    (): void => queueRpc({
      rpc,
      values: values
        .filter(({ value }, idx) => !rpc.params[idx].isOptional || !isNull(value))
        .map(({ value }): any => value)
    }),
    [queueRpc, rpc, values]
  );

  return (
    <section className='rpc--Selection'>
      <InputRpc
        defaultValue={defaultMethod}
        label={t('call the selected endpoint')}
        onChange={_onChangeMethod}
      />
      <Params
        key={`${rpc.section}.${rpc.method}:params` /* force re-render on change */}
        onChange={_onChangeValues}
        params={params}
      />
      <Button.Group>
        <Button
          icon='sign-in-alt'
          isDisabled={!isValid}
          label={t('Submit RPC call')}
          onClick={_onSubmit}
        />
      </Button.Group>
    </section>
  );
}

export default React.memo(Selection);
