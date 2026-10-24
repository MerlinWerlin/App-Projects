// Save to Photos pipeline (fb-1024 C, T119). Pure TypeScript: the steps (permission, capture, file name, save) are
// injected, so the error handling is unit-tested in Node and the same order runs in Expo Go and in the store build.
//
// Owner, 24 Oct: "attempting to save the wallpaper to photos to trial a theme failed". Causes found in the code:
// - the wallpaper is rendered off screen (left: -10000) for capture; on iOS view-shot's default snapshot
//   (drawViewHierarchyInRect) fails for a view outside the window, so the first attempt now uses renderInContext
//   (works off screen) and the default strategy is the fallback;
// - any failure showed one generic line, so the real reason was lost. Every failure now maps to a plain-words reason
//   with Try again, plus Open Settings when Photos access is the problem.

export type PhotoAccess = 'granted' | 'denied' | 'blocked';

export type SaveFailure = 'denied' | 'capture' | 'storage' | 'unreadable' | 'timeout' | 'busy' | 'unknown';

export type SaveOutcome =
  | { ok: true; uri: string }
  | { ok: false; reason: SaveFailure; detail?: string };

export type CaptureAttempt = { useRenderInContext: boolean };

/** iOS: renderInContext first (captures off-screen views), then the default snapshot. Android: the default only. */
export function captureAttempts(platform: string): CaptureAttempt[] {
  return platform === 'ios' ? [{ useRenderInContext: true }, { useRenderInContext: false }] : [{ useRenderInContext: false }];
}

/** A `file://` URI ending in an image extension (Photos refuses a file it cannot identify). */
export function withImageExtension(uri: string, ext: 'png' | 'jpg' = 'png'): string {
  const file = /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `file://${uri.startsWith('/') ? '' : '/'}${uri}`;
  const path = file.split(/[?#]/)[0] ?? file;
  return /\.(png|jpe?g|heic)$/i.test(path) ? file : `${path}.${ext}`;
}

/** True when the URI already names an image file (no copy needed). */
export function hasImageExtension(uri: string): boolean {
  const path = uri.split(/[?#]/)[0] ?? uri;
  return /\.(png|jpe?g|heic)$/i.test(path);
}

/** Turn a thrown error's message into a reason the owner can act on. */
export function classifySaveError(message: string, stage: 'permission' | 'capture' | 'save' = 'save'): SaveFailure {
  const m = message.toLowerCase();
  if (/permission|not authori[sz]ed|denied|access/.test(m)) return 'denied';
  if (/did not render in time|did not load in time|timed? ?out/.test(m)) return 'timeout';
  if (/could not be read|unreadable/.test(m)) return 'unreadable';
  if (/already saving/.test(m)) return 'busy';
  if (/space|disk|storage|quota|full/.test(m)) return 'storage';
  if (stage === 'capture' || /snapshot|capture|drawviewhierarchy|not mounted|view/.test(m)) return 'capture';
  if (stage === 'permission') return 'denied';
  return 'unknown';
}

/** i18n key of the plain-words reason shown under the Save button. */
export function saveFailureKey(reason: SaveFailure): string {
  return `theme.save.why.${reason}`;
}

/** Open Settings is offered only when Photos access is what failed. */
export function offersOpenSettings(reason: SaveFailure): boolean {
  return reason === 'denied';
}

/** Try again is offered for everything except a refused permission that cannot be asked again. */
export function offersTryAgain(reason: SaveFailure): boolean {
  return reason !== 'busy';
}

export const SAVE_FAILURES: readonly SaveFailure[] = ['denied', 'capture', 'storage', 'unreadable', 'timeout', 'busy', 'unknown'];

export type SaveSteps = {
  /** Ask for add-only Photos access. */
  access: () => Promise<PhotoAccess>;
  /** Render (mount + wait) — throws on a timeout or an unreadable image. */
  render: () => Promise<void>;
  /** Capture the rendered view to a temp file; may be called once per attempt. */
  capture: (attempt: CaptureAttempt) => Promise<string>;
  /** Copy a file to a name with an image extension (only called when the capture has none). */
  rename: (from: string, to: string) => Promise<void>;
  /** Add the file to Photos. */
  save: (uri: string) => Promise<void>;
  platform: string;
};

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Run the save in order; never throws. */
export async function runPhotoSave(steps: SaveSteps): Promise<SaveOutcome> {
  let access: PhotoAccess;
  try {
    access = await steps.access();
  } catch (e) {
    return { ok: false, reason: classifySaveError(msg(e), 'permission'), detail: msg(e) };
  }
  if (access !== 'granted') return { ok: false, reason: 'denied', detail: access };

  try {
    await steps.render();
  } catch (e) {
    const reason = classifySaveError(msg(e), 'capture');
    return { ok: false, reason, detail: msg(e) };
  }

  let uri = '';
  let lastError = '';
  for (const attempt of captureAttempts(steps.platform)) {
    try {
      uri = await steps.capture(attempt);
      if (uri) break;
    } catch (e) {
      lastError = msg(e);
    }
  }
  if (!uri) return { ok: false, reason: 'capture', detail: lastError || 'empty capture' };

  let file = withImageExtension(uri);
  if (!hasImageExtension(uri)) {
    try {
      await steps.rename(/^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `file://${uri}`, file);
    } catch (e) {
      return { ok: false, reason: classifySaveError(msg(e), 'save'), detail: msg(e) };
    }
  }

  try {
    await steps.save(file);
  } catch (e) {
    return { ok: false, reason: classifySaveError(msg(e), 'save'), detail: msg(e) };
  }
  return { ok: true, uri: file };
}
