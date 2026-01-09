// Copyright 2017-2026 @pezkuwi/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Warned on by nodenext resolution (while package does build in bundler mode)
import type { KeyringJson } from '@pezkuwi/ui-keyring/types';

export interface AccountStoreApi {
  all: () => Promise<{ key: string, value: KeyringJson }[]>
  get: (key: string) => Promise<KeyringJson>
  remove: (key: string) => Promise<void>
  set: (key: string, value: KeyringJson) => Promise<void>
}
