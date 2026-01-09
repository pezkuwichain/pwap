// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

/// <reference types="@pezkuwi/dev-test/globals.d.ts" />

import '@pezkuwi/react-components/i18n';

import { render } from '@testing-library/react';
import React, { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { ApiCtxRoot } from '@pezkuwi/react-api';
import { lightTheme } from '@pezkuwi/react-components';
import { createApi } from '@pezkuwi/test-support/api';
import { aliceSigner, MemoryStore } from '@pezkuwi/test-support/keyring';
import { WaitForApi } from '@pezkuwi/test-support/react';
import { execute } from '@pezkuwi/test-support/transaction';
import { BN } from '@pezkuwi/util';

import BountiesApp from './index.js';

const SUBSTRATE_PORT = Number.parseInt(process.env.TEST_SUBSTRATE_PORT || '30333');

const renderBounties = () => {
  const memoryStore = new MemoryStore();

  return render(
    <Suspense fallback='...'>
      <MemoryRouter>
        <ThemeProvider theme={lightTheme}>
          <ApiCtxRoot
            apiUrl={`ws://127.0.0.1:${SUBSTRATE_PORT}`}
            isElectron={false}
            store={memoryStore}
          >
            <WaitForApi>
              <div>
                <BountiesApp basePath='/bounties' />
              </div>
            </WaitForApi>
          </ApiCtxRoot>
        </ThemeProvider>
      </MemoryRouter>
    </Suspense>
  );
};

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('--SLOW--: Bounties', () => {
  it('list shows an existing bounty', async () => {
    const api = await createApi();

    await execute(api.tx.bounties.proposeBounty(new BN(500_000_000_000_000), 'a short bounty title'), aliceSigner());

    const { findByText } = renderBounties();

    expect(await findByText('a short bounty title', {}, { timeout: 20_000 })).toBeTruthy();
  });
});
