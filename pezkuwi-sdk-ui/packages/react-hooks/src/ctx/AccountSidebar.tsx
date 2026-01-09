// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

type SetStateContext = undefined | (([address, onUpdateName]: [string | null, (() => void) | null]) => void);

export const AccountSidebarCtx = React.createContext<SetStateContext>(undefined);
