// Copyright 2017-2026 @pezkuwi/app-settings authors & contributors
// SPDX-License-Identifier: Apache-2.0

// import type { RawMetadataDef } from '@pezkuwi/extension-inject/types';
import type { HexString } from '@pezkuwi/util/types';

import { useEffect, useState } from 'react';

import { createNamedHook, useApi } from '@pezkuwi/react-hooks';

function useRawMetadataImpl (): HexString | null {
  const { api, isApiReady } = useApi();
  const [state, setState] = useState<HexString | null>(null);

  useEffect(
    (): void => {
      isApiReady &&
        api.call.metadata.metadataAtVersion &&
          api.call.metadata.metadataAtVersion(15).then((opaque) => {
            const raw = opaque.toHex();

            setState(raw);
          }).catch(console.error);
    },
    [api, isApiReady]
  );

  return state;
}

export default createNamedHook('useRawMetadata', useRawMetadataImpl);
