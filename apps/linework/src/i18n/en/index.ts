// English source catalogue = the union of the area files. Each area is owned by its screen(s) so parallel work
// never edits the same file. Keys are globally unique because each is prefixed with its area name.
import { common } from './common.ts';
import { home } from './home.ts';
import { templates } from './templates.ts';
import { settings } from './settings.ts';
import { plus } from './plus.ts';
import { prepare } from './prepare.ts';
import { trace } from './trace.ts';
import { lightbox } from './lightbox.ts';
import { drawings } from './drawings.ts';
import type { Message } from '../core.ts';

export const en = {
  ...common,
  ...home,
  ...templates,
  ...settings,
  ...plus,
  ...prepare,
  ...trace,
  ...lightbox,
  ...drawings,
} as const;

export type MessageKey = keyof typeof en;
/** A translated catalogue must cover every English key (checked at runtime by catalogs.test.ts). */
export type Translation = Partial<Record<MessageKey, Message>>;
