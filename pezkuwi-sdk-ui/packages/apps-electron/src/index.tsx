// Copyright 2017-2026 @pezkuwi/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

// setup these right at front
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Warned on by nodenext resolution (while package does build in bundler mode)
import '@pezkuwi/apps/initSettings';
import 'semantic-ui-css/semantic.min.css';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Warned on by nodenext resolution (while package does build in bundler mode)
import '@pezkuwi/react-components/i18n';

import React from 'react';
import { createRoot } from 'react-dom/client';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Warned on by nodenext resolution (while package does build in bundler mode)
import Root from '@pezkuwi/apps/Root';

import { electronMainApi } from './api/global-exported-api.js';
import { RemoteElectronStore } from './renderer/remote-electron-store.js';

const rootId = 'root';
const rootElement = document.getElementById(rootId);

if (!rootElement) {
  throw new Error(`Unable to find element with id '${rootId}'`);
}

const store = new RemoteElectronStore(electronMainApi.accountStore);

createRoot(rootElement).render(
  <Root
    isElectron
    store={store}
  />
);
