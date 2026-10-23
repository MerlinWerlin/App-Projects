import { appEn } from './app';
import { coreEn } from './core';
import { uiEn } from './ui';

/** The English catalogue is the source of truth: every key and placeholder starts here. */
export const en = { ...coreEn, ...uiEn, ...appEn } as const;
export type MessageKey = keyof typeof en;
