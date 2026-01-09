// Copyright 2017-2026 @pezkuwi/app-accounts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { WithTranslation } from 'react-i18next';
import type { ActionStatus } from '@pezkuwi/react-components/Status/types';
import type { KeyringAddress } from '@pezkuwi/ui-keyring/types';

export type { AppProps as ComponentProps } from '@pezkuwi/react-components/types';

export interface BareProps {
  className?: string;
}

export interface I18nProps extends BareProps, WithTranslation {}

export interface ModalProps {
  onClose: () => void;
  onStatusChange: (status: ActionStatus) => void;
}

export interface SortedAccount {
  account: KeyringAddress;
  children: SortedAccount[];
  isFavorite: boolean;
}

export interface AmountValidateState {
  error: string | null;
  warning: string | null;
}
