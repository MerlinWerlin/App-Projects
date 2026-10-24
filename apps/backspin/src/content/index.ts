// Content bundled with the app: 950+ challenge lines in packs and the verdict lines.
// Written by StarNet Luna (gpt-6-luna), screened by a Luna GUARD pass and Claude; see ops/luna/.
import { buildPacks, type Line, type Quips } from '../core/game.ts';
import lines from './lines.json';
import quips from './quips.json';

export const PACKS = buildPacks(lines as unknown as Record<string, Line[]>);
export const QUIPS = quips as unknown as Quips;
