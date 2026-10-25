// First-launch language line (release standard §1): "Language: English · Change" shows on Home during the first
// session only, and never again once "Change" is tapped. The flag is written as soon as the line is claimed, so the
// next launch never shows it, even if the person never taps it.

export const LANG_HINT_KEY = 'backspin.langHint.v1';

type Storage = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };

/**
 * Whether to show the language line this session. Only a fresh install (intro not yet seen when the app loaded)
 * gets it. Marks it as shown, so later sessions return false. If storage can't be read, it stays hidden rather
 * than appearing on every launch.
 */
export async function claimLangHint(storage: Storage, freshInstall: boolean): Promise<boolean> {
  let seen: string | null;
  try {
    seen = await storage.get(LANG_HINT_KEY);
  } catch {
    return false;
  }
  if (seen) return false;
  try {
    await storage.set(LANG_HINT_KEY, freshInstall ? 'shown' : 'skipped');
  } catch {
    // shows this session only; the next launch may offer it once more
  }
  return freshInstall;
}

/** The person tapped "Change": never show it again. */
export async function dismissLangHint(storage: Storage): Promise<void> {
  try {
    await storage.set(LANG_HINT_KEY, 'dismissed');
  } catch {
    // already hidden for this session
  }
}
