// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { AccountId, HeadData, ParaId } from '@pezkuwi/types/interfaces';
import type { PezkuwiRuntimeCommonParasRegistrarParaInfo, PezkuwiRuntimeTeyrchainsParasParaGenesisArgs, PezkuwiRuntimeTeyrchainsParasParaLifecycle } from '@pezkuwi/types/lookup';

import { createNamedHook, useApi, useCallMulti } from '@pezkuwi/react-hooks';

interface Result {
  headHex: string | null;
  lifecycle: PezkuwiRuntimeTeyrchainsParasParaLifecycle | null;
  manager: AccountId | null;
}

const OPT_MULTI = {
  defaultValue: {
    headHex: null,
    lifecycle: null,
    manager: null
  },
  transform: ([optHead, optGenesis, optLifecycle, optInfo]: [Option<HeadData>, Option<PezkuwiRuntimeTeyrchainsParasParaGenesisArgs>, Option<PezkuwiRuntimeTeyrchainsParasParaLifecycle>, Option<PezkuwiRuntimeCommonParasRegistrarParaInfo>]): Result => ({
    headHex: optHead.isSome
      ? optHead.unwrap().toHex()
      : optGenesis.isSome
        ? optGenesis.unwrap().genesisHead.toHex()
        : null,
    lifecycle: optLifecycle.unwrapOr(null),
    manager: optInfo.isSome
      ? optInfo.unwrap().manager
      : null
  })
};

function useThreadInfoImpl (id: ParaId): Result {
  const { api } = useApi();

  return useCallMulti<Result>([
    [api.query.paras.heads, id],
    [api.query.paras.upcomingParasGenesis, id],
    [api.query.paras.paraLifecycles, id],
    [api.query.registrar.paras, id]
  ], OPT_MULTI);
}

export default createNamedHook('useThreadInfo', useThreadInfoImpl);
