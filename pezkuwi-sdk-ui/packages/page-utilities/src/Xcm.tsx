// Copyright 2017-2026 @pezkuwi/app-utilities authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { RawParamOnChangeValue } from '@pezkuwi/react-params/types';
import type { HexString } from '@pezkuwi/util/types';

import React, { useCallback, useState } from 'react';

import { statics } from '@pezkuwi/react-api';
import { Output } from '@pezkuwi/react-components';
import { createValue, Holder, ParamComp } from '@pezkuwi/react-params';
import { getTypeDef } from '@pezkuwi/types/create';
import { u8aToHex } from '@pezkuwi/util';

function Xcm (): React.ReactElement {
  const VersionedXcmTypeDef = getTypeDef('XcmVersionedXcm');
  const [encodedXcm, setEncodedXcm] = useState<HexString>('0x');

  const onChange = useCallback(
    (_index: number, rawXcm: RawParamOnChangeValue): void => {
      const xcm = statics.api.createType(VersionedXcmTypeDef.type, rawXcm.value);

      setEncodedXcm(u8aToHex(xcm.toU8a()));
    },
    [VersionedXcmTypeDef.type]
  );

  return (
    <Holder>
      <ParamComp
        defaultValue={ createValue(statics.api.registry, { type: VersionedXcmTypeDef }) }
        index={0}
        onChange={onChange}
        registry={statics.api.registry}
        type={VersionedXcmTypeDef}
      />
      <Output
        isDisabled={true}
        value={encodedXcm}
        withCopy={true}
      />
    </Holder>
  );
}

export default React.memo(Xcm);
