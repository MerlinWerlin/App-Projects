/**
 * Apps tab empty states (premium polish P5): which designed empty state to show and its copy.
 * Pure TS (no React Native) so the selection is unit-tested in Node.
 */
import type { MessageKey } from '../../i18n/core';
import { withCopy } from '../lazyCopy';

/** Same shape as AppsLoad.kind from src/core/apps, plus `null` while loading. */
export type AppsLoadKind = 'ok' | 'unsupported' | 'none' | 'error';

export type AppsEmptyKind = 'noTv' | 'demoEmpty' | 'unsupported' | 'error' | 'empty';

/** What the action button does; the screen maps it to a handler. */
export type AppsEmptyAction = 'openTvs' | 'retry';

export interface EmptyCopy {
  title: string;
  body: string;
  action?: { label: string; does: AppsEmptyAction };
}

/** Message keys per state (src/i18n/catalog/en/ui.ts). Bodies keep the screen's earlier wording. */
export const APPS_EMPTY_KEYS: Readonly<
  Record<AppsEmptyKind, { title: MessageKey; body: MessageKey; action?: { label: MessageKey; does: AppsEmptyAction } }>
> = {
  noTv: {
    title: 'ui.apps.empty.noTv.title',
    body: 'ui.apps.empty.noTv.body',
    action: { label: 'ui.apps.empty.noTv.action', does: 'openTvs' },
  },
  demoEmpty: {
    title: 'ui.apps.empty.demo.title',
    body: 'ui.apps.empty.demo.body',
    action: { label: 'ui.apps.empty.demo.action', does: 'openTvs' },
  },
  unsupported: { title: 'ui.apps.empty.unsupported.title', body: 'ui.apps.empty.unsupported.body' },
  error: {
    title: 'ui.apps.empty.error.title',
    body: 'ui.apps.empty.error.body',
    action: { label: 'ui.apps.empty.error.action', does: 'retry' },
  },
  empty: { title: 'ui.apps.empty.empty.title', body: 'ui.apps.empty.empty.body' },
};

function lazyCopy(kind: AppsEmptyKind): EmptyCopy {
  const k = APPS_EMPTY_KEYS[kind];
  const copy = withCopy({ title: '', body: '' } as EmptyCopy, { title: k.title, body: k.body });
  if (k.action) copy.action = withCopy({ label: '', does: k.action.does }, { label: k.action.label });
  return copy;
}

/** Copy table: the text is read through t() on every access, so it follows the active language. */
export const APPS_EMPTY_COPY: Readonly<Record<AppsEmptyKind, EmptyCopy>> = {
  noTv: lazyCopy('noTv'),
  demoEmpty: lazyCopy('demoEmpty'),
  unsupported: lazyCopy('unsupported'),
  error: lazyCopy('error'),
  empty: lazyCopy('empty'),
};

export interface AppsViewInput {
  /** null while the app list is loading. */
  kind: AppsLoadKind | null;
  /** Number of apps after loading (ignored unless kind is 'ok'). */
  appCount: number;
  demo: boolean;
}

/** The empty state to show, or null when loading or when there are apps to show. */
export function appsEmptyKind(input: AppsViewInput): AppsEmptyKind | null {
  switch (input.kind) {
    case null:
      return null;
    case 'none':
      return 'noTv';
    case 'unsupported':
      return 'unsupported';
    case 'error':
      return 'error';
    case 'ok':
      if (input.appCount > 0) return null;
      return input.demo ? 'demoEmpty' : 'empty';
    default:
      return null;
  }
}

/** Copy for an empty state; an error's own message (if any) replaces the generic body. */
export function appsEmptyCopy(kind: AppsEmptyKind, errorMessage?: string | null): EmptyCopy {
  const base = APPS_EMPTY_COPY[kind];
  const msg = typeof errorMessage === 'string' ? errorMessage.trim() : '';
  if (kind === 'error' && msg !== '') return { ...base, body: msg };
  return base;
}
