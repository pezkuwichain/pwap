// Copyright 2017-2026 @pezkuwi/test-support authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* global jest, fail */

import type { RenderResult } from '@testing-library/react';
import type { ApiProps } from '@pezkuwi/react-api/types';
import type { PartialQueueTxExtrinsic, QueueProps, QueueTxExtrinsicAdd } from '@pezkuwi/react-components/Status/types';
import type { UseAccountInfo } from '@pezkuwi/react-hooks/types';
import type { AccountOverrides } from '../utils/accountDefaults.js';

import { queryByAttribute, render, screen } from '@testing-library/react';
import React, { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { POLKADOT_GENESIS } from '@pezkuwi/apps-config';
import { AccountSidebar, lightTheme } from '@pezkuwi/react-components';
import { ApiCtx } from '@pezkuwi/react-hooks/ctx/Api';
import { QueueCtx } from '@pezkuwi/react-hooks/ctx/Queue';
import { TypeRegistry } from '@pezkuwi/types/create';
import { keyring } from '@pezkuwi/ui-keyring';
import { BN } from '@pezkuwi/util';

import { alice, bob, charlie, ferdie } from '../keyring/index.js';
import { Table } from '../pagesElements/index.js';
import { mockAccountHooks } from '../utils/accountDefaults.js';
import { mockApiHooks } from '../utils/mockApiHooks.js';

let queueExtrinsic: (value: PartialQueueTxExtrinsic) => void;

class NotYetRendered extends Error {
}

jest.mock('@pezkuwi/react-hooks/useAccounts', () => ({
  useAccounts: () => mockAccountHooks.useAccounts
}));

jest.mock('@pezkuwi/react-hooks/useAccountInfo', () => {
  // eslint-disable-next-line func-call-spacing
  const actual = jest.requireActual<UseAccountInfo>('@pezkuwi/react-hooks/useAccountInfo');

  return ({
    useAccountInfo: (address: string) => {
      const mockInfo = mockAccountHooks.accountsMap[address];

      return mockInfo
        ? {
          ...actual.useAccountInfo(address),
          flags: { ...actual.useAccountInfo(address).flags, ...(mockInfo.info.flags) },
          identity: {
            ...actual.useAccountInfo(address).identity,
            ...(mockInfo.info.identity),
            judgements: [
              ...(actual.useAccountInfo(address).identity?.judgements || []),
              ...(mockApiHooks.judgements || [])
            ]
          },
          tags: [...actual.useAccountInfo(address).tags, ...(mockInfo.info.tags)]
        }
        : actual.useAccountInfo(address);
    }
  });
});

jest.mock('@pezkuwi/react-hooks/useNextTick', () => ({
  useNextTick: () => true
}));

jest.mock('@pezkuwi/react-hooks/useBalancesAll', () => ({
  useBalancesAll: (address: string) => mockAccountHooks.accountsMap[address].balance
}));

jest.mock('@pezkuwi/react-hooks/useStakingInfo', () => ({
  useStakingInfo: (address: string) => mockAccountHooks.accountsMap[address].staking
}));

jest.mock('@pezkuwi/react-hooks/useBestNumber', () => ({
  useBestNumber: () => 1
}));

jest.mock('@pezkuwi/react-hooks/useSubidentities', () => ({
  useSubidentities: () => mockApiHooks.subs
}));

jest.mock('@pezkuwi/app-accounts/Accounts/useMultisigApprovals', () => ({
  __esModule: true,
  default: () => mockApiHooks.multisigApprovals
}));

jest.mock('@pezkuwi/react-hooks/useDelegations', () => ({
  useDelegations: () => mockApiHooks.delegations
}));

jest.mock('@pezkuwi/react-hooks/useProxies', () => ({
  useProxies: () => mockApiHooks.proxies
}));

jest.mock('@pezkuwi/react-hooks/useSubidentities', () => ({
  useSubidentities: () => mockApiHooks.subs
}));

jest.mock('@pezkuwi/react-hooks/useRegistrars', () => ({
  useRegistrars: () => ({
    isRegistrar: false,
    registrars: mockApiHooks.registrars
  })
}));

jest.mock('@pezkuwi/react-hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    themeClassName: 'theme--light'
  })
}));

export abstract class Page {
  private renderResult?: RenderResult;
  protected readonly defaultAddresses = [alice, bob, charlie, ferdie];

  protected constructor (private readonly overview: React.ReactElement, private readonly rowClassName: string) {
    this.overview = overview;
    this.rowClassName = rowClassName;
  }

  render (accounts: [string, AccountOverrides][]): void {
    mockAccountHooks.setAccounts(accounts);

    accounts.forEach(([address, { meta }]) => {
      keyring.addExternal(address, meta);
    });

    const noop = () => Promise.resolve(() => { /**/ });
    const registry = new TypeRegistry();
    const api = {
      consts: {
        babe: {
          expectedBlockTime: new BN(1)
        },
        democracy: {
          enactmentPeriod: new BN(1)
        },
        proxy: {
          proxyDepositBase: new BN(1),
          proxyDepositFactor: new BN(1)
        }
      },
      createType: () => ({
        defKeys: []
      }),
      derive: {
        accounts: {
          info: noop
        },
        balances: {
          all: noop
        },
        chain: {
          bestNumber: noop
        },
        democracy: {
          locks: noop
        },
        staking: {
          account: noop
        }
      },
      genesisHash: registry.createType('Hash', POLKADOT_GENESIS),
      query: {
        democracy: {
          votingOf: noop
        },
        identity: {
          identityOf: noop
        }
      },
      registry: {
        chainDecimals: [12],
        chainTokens: ['Unit'],
        createType: (...args: Parameters<typeof registry.createType>) =>
          registry.createType(...args),
        lookup: {
          names: []
        }
      },
      tx: {
        council: {},
        democracy: {
          delegate: noop
        },
        multisig: {
          approveAsMulti: Object.assign(noop, { meta: { args: [] } })
        },
        proxy: {
          removeProxies: noop
        },
        utility: noop
      }
    };
    const mockApi: ApiProps = {
      api,
      apiSystem: {
        ...api,
        isReady: Promise.resolve(api)
      },
      isApiConnected: true,
      isApiInitialized: true,
      isApiReady: true,
      isEthereum: false,
      systemName: 'bizinikiwi'
    } as unknown as ApiProps;

    queueExtrinsic = jest.fn() as QueueTxExtrinsicAdd;
    const queue = {
      queueExtrinsic
    } as QueueProps;

    this.renderResult = render(
      <>
        <div id='tooltips' />
        <Suspense fallback='...'>
          <QueueCtx.Provider value={queue}>
            <MemoryRouter>
              <ThemeProvider theme={lightTheme}>
                <ApiCtx.Provider value={mockApi}>
                  <AccountSidebar>
                    {React.cloneElement(this.overview, { onStatusChange: noop }) }
                  </AccountSidebar>
                </ApiCtx.Provider>
              </ThemeProvider>
            </MemoryRouter>
          </QueueCtx.Provider>
        </Suspense>
      </>
    );
  }

  async getTable (): Promise<Table> {
    this.assertRendered();

    return new Table(await screen.findByRole('table'), this.rowClassName);
  }

  clearAccounts (): void {
    this.defaultAddresses.forEach((address) => keyring.forgetAccount(address));
  }

  getById (id: string | RegExp): HTMLElement | null {
    this.assertRendered();
    const getById = queryByAttribute.bind(null, 'id');

    return getById(this.renderResult?.container ?? fail('Page render failed'), id);
  }

  protected assertRendered (): void {
    if (this.renderResult === undefined) {
      throw new NotYetRendered();
    }
  }
}
