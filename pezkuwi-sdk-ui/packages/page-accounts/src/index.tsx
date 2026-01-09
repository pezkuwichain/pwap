// Copyright 2017-2026 @pezkuwi/app-accounts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AppProps as Props } from '@pezkuwi/react-components/types';

import React, { useRef } from 'react';
import { Route, Routes } from 'react-router';

import { Tabs } from '@pezkuwi/react-components';
import { useAccounts, useIpfs } from '@pezkuwi/react-hooks';

import Accounts from './Accounts/index.js';
import Vanity from './Vanity/index.js';
import { useTranslation } from './translate.js';
import useCounter from './useCounter.js';

export { useCounter };

const HIDDEN_ACC = ['vanity'];

function AccountsApp ({ basePath, onStatusChange }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { hasAccounts } = useAccounts();
  const { isIpfs } = useIpfs();

  const tabsRef = useRef([
    {
      isRoot: true,
      name: 'overview',
      text: t('My accounts')
    },
    {
      name: 'vanity',
      text: t('Vanity generator')
    }
  ]);

  return (
    <main className='accounts--App'>
      <Tabs
        basePath={basePath}
        hidden={(hasAccounts && !isIpfs) ? undefined : HIDDEN_ACC}
        items={tabsRef.current}
      />
      <Routes>
        <Route path={basePath}>
          <Route
            element={
              <Vanity onStatusChange={onStatusChange} />
            }
            path='vanity'
          />
          <Route
            element={
              <Accounts onStatusChange={onStatusChange} />
            }
            index
          />
        </Route>
      </Routes>
    </main>
  );
}

export default React.memo(AccountsApp);
