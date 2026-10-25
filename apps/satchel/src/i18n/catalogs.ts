// Bundled translations (synchronous, so startup never waits on them). English is the source in en.ts.
// Translations arrive from the OpenAI spec lane (T21); until then every language falls back to English.
import type { Catalog, Lang } from './core.ts';

export const CATALOGS: Partial<Record<Lang, Catalog>> = {};
