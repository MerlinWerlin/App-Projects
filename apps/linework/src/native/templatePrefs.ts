// Favourite and recently traced templates, stored locally in AsyncStorage as JSON (T24).
// Bad or stale data is tolerated: malformed entries and ids that are no longer in the catalogue are ignored.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTemplate } from '../core/templates';
import {
  addRecentTemplate,
  parseFavorites,
  parseRecentTemplates,
  serializeFavorites,
  serializeRecentTemplates,
  toggleFavorite as toggleInList,
  type RecentTemplate,
} from '../core/templateSearch';

export const TEMPLATE_KEYS = {
  favorites: 'linework.templateFavorites.v1',
  recent: 'linework.recentTemplates.v1',
} as const;

const known = (id: string) => getTemplate(id) !== undefined;

// Serialise read-modify-write updates so quick taps (heart toggles, opening a template) never lose a write.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore: worst case a favourite or recent entry is not remembered
  }
}

/** Favourite template ids, newest first, limited to templates that still exist. */
export function loadFavorites(): Promise<string[]> {
  return serial(async () => parseFavorites(await read(TEMPLATE_KEYS.favorites), known));
}

/** Adds or removes a favourite and returns the new list. */
export function toggleFavorite(id: string): Promise<string[]> {
  return serial(async () => {
    const next = toggleInList(parseFavorites(await read(TEMPLATE_KEYS.favorites), known), id);
    await write(TEMPLATE_KEYS.favorites, serializeFavorites(next));
    return next;
  });
}

/** Recently traced templates, newest first (cap 12), limited to templates that still exist. */
export function loadRecentTemplates(): Promise<RecentTemplate[]> {
  return serial(async () => parseRecentTemplates(await read(TEMPLATE_KEYS.recent), known));
}

/** Records that a template was opened to trace; returns the new recent list. */
export function recordTemplateUse(id: string): Promise<RecentTemplate[]> {
  return serial(async () => {
    const next = addRecentTemplate(parseRecentTemplates(await read(TEMPLATE_KEYS.recent), known), id, Date.now());
    await write(TEMPLATE_KEYS.recent, serializeRecentTemplates(next));
    return next;
  });
}
