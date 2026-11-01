// Install flow logic for /install: which apps go in the bulk profile and which need
// Shortcuts, progress maths, file names, step text and the persisted "done" checklist.
// Pure TS (no React Native / Expo). See docs/SPIKE_PROFILE.md for the delivery decision.

import { installMethodFor, type IconSpec } from './iconspec.ts';
import { buildProfiles, removeGuide, type ProfileFile, type WebClipIcon } from './mobileconfig.ts';

export const PHOTOS_ALBUM = 'Glaze icons';
export const PROFILE_MIME = 'application/x-apple-aspen-config';
/** Pixel size of icons inside the profile (keeps the file small). */
export const PROFILE_ICON_SIZE = 180;
/** Pixel size of icons saved to Photos for Shortcuts. */
export const PHOTO_ICON_SIZE = 360;
export const SHORTCUTS_URL = 'shortcuts://';

export type InstallChoice = 'bulk' | 'shortcuts';

/**
 * T202 (owner 1 Nov 10:31, owner-1101d #5, supersedes T183): "Install all at once" (the web clip
 * profile) is ALWAYS the main method whenever it can be used (PROFILE_INSTALL_ENABLED and some
 * picked app has a link). Shortcuts "Open App" (one icon at a time, no Safari hop) stays only as a
 * small fallback link, and covers the apps a profile can't open. Profile icons open their app
 * through a quick Safari tap ("Open in <app>?"): an iOS limitation the install screen states with
 * the count (safariTapCount).
 */
export const DEFAULT_INSTALL_METHOD: InstallChoice = 'bulk';
/** The Shortcuts action every guided shortcut uses (the app is picked from the list, no URL). */
export const SHORTCUT_ACTION = 'Open App';

export type ShortcutReason = 'no-scheme' | 'chosen';

export type InstallPlan = {
  /** Apps that go in the web clip profile (they have a URL scheme). */
  profile: IconSpec[];
  /** Apps that need the Shortcuts app (no URL scheme). */
  shortcuts: IconSpec[];
};

/** Split specs by install method, keeping order. */
export function planInstall(specs: readonly IconSpec[]): InstallPlan {
  const profile: IconSpec[] = [];
  const shortcuts: IconSpec[] = [];
  for (const s of specs) (installMethodFor(s) === 'profile' ? profile : shortcuts).push(s);
  return { profile, shortcuts };
}

/**
 * Specs with override images that are no longer on disk (e.g. deleted or not restored from a
 * backup) fall back to the theme artwork instead of exporting a blank icon. Returns the specs
 * and the app ids that fell back, so the UI can say which icons need a new image.
 */
export function withoutMissingImages(
  specs: readonly IconSpec[],
  missing: ReadonlySet<string>,
): { specs: IconSpec[]; fellBack: string[] } {
  const fellBack: string[] = [];
  const out = specs.map((s) => {
    if (!s.overrideImage || !missing.has(s.overrideImage)) return s;
    fellBack.push(s.appId);
    const copy: IconSpec = { ...s };
    delete copy.overrideImage;
    return copy;
  });
  return { specs: out, fellBack };
}

export type ShortcutItem ={ spec: IconSpec; url: string | null; reason: ShortcutReason };

/**
 * Apps listed on the Shortcuts path for a choice. With 'bulk' only apps without a scheme (the
 * profile can't carry them); with 'shortcuts' (the fallback link) every app. `url` is informational
 * only: every shortcut uses Open App (T183).
 */
export function shortcutItems(specs: readonly IconSpec[], choice: InstallChoice): ShortcutItem[] {
  const out: ShortcutItem[] = [];
  for (const spec of specs) {
    const url = shortcutUrl(spec);
    if (choice === 'shortcuts') out.push({ spec, url, reason: 'chosen' });
    else if (url === null) out.push({ spec, url, reason: 'no-scheme' });
  }
  return out;
}

/** The URL a shortcut (or web clip) opens, or null when the app has no scheme. */
export function shortcutUrl(spec: { urlScheme: string | null }): string | null {
  const s = spec.urlScheme ? spec.urlScheme.trim() : '';
  return s ? s : null;
}

export function reasonText(reason: ShortcutReason): string {
  return reason === 'no-scheme'
    ? 'No known link opens this app, so it uses Shortcuts'
    : 'Opens straight from the Home Screen with Open App';
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One-line summary for the top card, e.g. "12 icons via one profile, 2 via Shortcuts". */
export function planSummary(plan: InstallPlan, profileCount: number = 1): string {
  const p = plan.profile.length;
  const s = plan.shortcuts.length;
  if (p === 0 && s === 0) return 'No apps selected yet';
  const via = profileCount > 1 ? `${profileCount} profiles` : 'one profile';
  if (p === 0) return `${plural(s, 'icon', 'icons')} via Shortcuts`;
  if (s === 0) return `${plural(p, 'icon', 'icons')} via ${via}`;
  return `${plural(p, 'icon', 'icons')} via ${via}, ${s} via Shortcuts`;
}

// ---- profile building ----

/** Pair profile specs with their rendered PNGs (order of `specs`; specs without a PNG are skipped). */
export function webClipIcons(
  specs: readonly IconSpec[],
  rendered: readonly { appId: string; pngBase64: string }[],
): WebClipIcon[] {
  const byId = new Map<string, string>();
  for (const r of rendered) if (r.pngBase64) byId.set(r.appId, r.pngBase64);
  const out: WebClipIcon[] = [];
  for (const s of specs) {
    const url = shortcutUrl(s);
    const png = byId.get(s.appId);
    // T202: the app id keys the web clip's stable payload ids (never the theme or the position).
    if (url && png) out.push({ label: s.label, url, pngBase64: png, key: s.appId });
  }
  return out;
}

/** True when a web clip URL is an app's own scheme (iOS hands it over through Safari's "Open in…?"). */
export function opensViaSafariTap(url: string): boolean {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  return m !== null && !/^https?$/i.test(m[1]);
}

/**
 * T202: how many of the profile's apps open with a quick Safari tap. Web clips only hold a URL, and
 * iOS hands an app-scheme URL over with an "Open in <app>?" tap (Apple's WebClip payload has no key
 * that launches an app by bundle id without MDM). Computed from the data so the screen says it
 * plainly.
 */
export function safariTapCount(profileSpecs: readonly { urlScheme: string | null }[]): { tap: number; total: number } {
  let tap = 0;
  let total = 0;
  for (const s of profileSpecs) {
    const url = shortcutUrl(s);
    if (!url) continue;
    total++;
    if (opensViaSafariTap(url)) tap++;
  }
  return { tap, total };
}

/** Theme name for the profile: the applied theme's name, else "Custom". */
export function profileThemeName(themeName: string | null | undefined): string {
  const t = typeof themeName === 'string' ? themeName.trim() : '';
  return t || 'Custom';
}

/** Build the profile file(s) for the profile half of a plan. */
export function buildInstallProfiles(
  specs: readonly IconSpec[],
  rendered: readonly { appId: string; pngBase64: string }[],
  themeName: string | null | undefined,
  opts: { uuid?: () => string; maxBytes?: number; installId?: string } = {},
): ProfileFile[] {
  const icons = webClipIcons(specs, rendered);
  if (icons.length === 0) return [];
  return buildProfiles({
    themeName: profileThemeName(themeName),
    icons,
    uuid: opts.uuid,
    maxBytes: opts.maxBytes,
    installId: opts.installId,
  });
}

// ---- progress ----

export type InstallPhase = 'idle' | 'rendering' | 'building' | 'saving' | 'sharing' | 'done';

/** done/total as 0..1 (0 when total is 0 or inputs are not finite). */
export function batchFraction(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}

/** Share of the progress bar each phase spans: rendering dominates. */
const PHASE_SPAN: Record<InstallPhase, [number, number]> = {
  idle: [0, 0],
  rendering: [0, 0.85],
  building: [0.85, 0.92],
  saving: [0.92, 0.97],
  sharing: [0.97, 1],
  done: [1, 1],
};

/** Overall 0..1 progress for a phase with done/total steps inside it. */
export function overallProgress(phase: InstallPhase, done: number = 0, total: number = 1): number {
  const [a, b] = PHASE_SPAN[phase];
  return a + (b - a) * batchFraction(done, total);
}

export function progressLabel(phase: InstallPhase, done: number = 0, total: number = 0): string {
  switch (phase) {
    case 'idle':
      return 'Ready';
    case 'rendering':
      return `Drawing icons ${Math.min(done, total)} of ${total}`;
    case 'building':
      return 'Building profile';
    case 'saving':
      return total > 1 ? `Saving file ${Math.min(done + 1, total)} of ${total}` : 'Saving file';
    case 'sharing':
      return total > 1 ? `Sharing file ${Math.min(done + 1, total)} of ${total}` : 'Opening share sheet';
    case 'done':
      return 'Done';
  }
}

/**
 * On-device render timing line shown after a bulk render, so the owner can report it
 * ("Drew 60 icons in 14 s (0.24 s each)"; totals under 10 s keep one decimal, e.g. "8.4 s"). Returns null for no icons or a bad duration.
 */
export function renderTimingText(count: number, ms: number): string | null {
  if (!Number.isFinite(count) || !Number.isFinite(ms) || count < 1 || ms < 0) return null;
  const n = Math.floor(count);
  const secs = ms / 1000;
  const total = secs < 10 ? secs.toFixed(1) : String(Math.round(secs));
  const each = (secs / n).toFixed(2);
  return `Drew ${n} icon${n === 1 ? '' : 's'} in ${total} s (${each} s each)`;
}

/** Percentage text for a 0..1 fraction ("42%"). */
export function percentText(fraction: number): string {
  return `${Math.round(batchFraction(fraction, 1) * 100)}%`;
}

// ---- file names ----

/** File-system-safe ascii slug ("icon" when nothing is left). */
export function fileSlug(s: string): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return slug || 'icon';
}

/** PNG name for a Photos icon: "glaze-03-spotify.png" (index is 0-based, sorts in order). */
export function iconFilename(label: string, index: number): string {
  const n = Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0)) + 1;
  return `glaze-${String(n).padStart(2, '0')}-${fileSlug(label)}.png`;
}

/** Join a directory URI (with or without trailing slash) and a file name. */
export function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

// ---- Shortcuts steps ----

/**
 * Exact steps to build one Home Screen shortcut with our icon. T183 (owner 1 Nov): always the
 * "Open App" action with the app chosen from the list, never "Open URL": a URL shortcut can hop
 * through Safari, Open App launches the app directly. `_url` is ignored (kept for old callers).
 */
export function shortcutSteps(label: string, _url?: string | null): string[] {
  const name = label.trim() || 'App';
  return [
    'Open the Shortcuts app and tap + (top right).',
    `Tap Add Action, search for "${SHORTCUT_ACTION}" and tap it.`,
    `Tap "App" and choose ${name} from the list.`,
    `Tap the name at the top, choose Rename and type ${name}.`,
    'Tap the Share button (or ⋯ / the name menu) and choose Add to Home Screen.',
    'Tap the small icon next to the name, then Choose Photo.',
    `Open the "${PHOTOS_ALBUM}" album and pick the ${name} icon. Tap Choose.`,
    'Tap Add. The new icon appears on your Home Screen.',
  ];
}

// ---- profile step cards ----

export type Illustration =
  | 'share-files'
  | 'files-tap'
  | 'settings-row'
  | 'install-button'
  | 'not-verified'
  | 'home-remove'
  | 'remove-profile'
  | 'safari-page'
  | 'allow-dialog'
  | 'home-icons';

export type StepCardData = { id: string; title: string; body: string; illustration: Illustration };

/** T126: the exact on-screen steps when the profile is served to Safari from the iPhone. */
export const SAFARI_PROFILE_STEPS: readonly string[] = Object.freeze([
  // T156: the page requests the profile as it opens, so Safari may ask before Install is tapped.
  'Safari opens the Glaze page and may ask to download the profile straight away. If it doesn’t, tap Install.',
  'Safari asks to allow a configuration profile download, sometimes before you tap Install: tap Allow, then Close.',
  'Open Settings: tap “Profile Downloaded” near the top (or General > VPN & Device Management), tap Install, enter your passcode, Install.',
  'Your icons appear on the Home Screen.',
]);

/** Cards shared by both delivery routes, after the route-specific ones. */
function commonProfileCards(): StepCardData[] {
  return [
    {
      id: 'not-verified',
      title: 'Why "Not Verified"?',
      body: 'Glaze makes the profile on your iPhone, so it is not signed by a company certificate and iOS labels it "Not Verified". It only adds Home Screen shortcuts that open your apps. It does not manage your device and cannot read any of your data. You can remove it any time.',
      illustration: 'not-verified',
    },
    {
      id: 'hide-old',
      title: 'Hide the old icons',
      body: 'Long-press an original app icon, tap Remove App, then Remove from Home Screen. The app stays installed in the App Library with all its data.',
      illustration: 'home-remove',
    },
    {
      id: 'remove',
      title: 'To remove later',
      body: removeGuide().join(' '),
      illustration: 'remove-profile',
    },
  ];
}

/**
 * Illustrated steps for the bulk profile flow. `route` 'safari' (T126, the profile is served to
 * Safari from this iPhone) gives the four Safari steps; 'share' (fallback builds) keeps the
 * share sheet / Files steps.
 */
export function profileStepCards(profileCount: number = 1, route: 'safari' | 'share' = 'share'): StepCardData[] {
  if (route === 'safari') {
    const [safari, allow, settings, home] = SAFARI_PROFILE_STEPS;
    return [
      { id: 'safari', title: 'Install in Safari', body: safari, illustration: 'safari-page' },
      { id: 'allow', title: 'Allow the download', body: allow, illustration: 'allow-dialog' },
      { id: 'settings', title: 'Install in Settings', body: settings, illustration: 'install-button' },
      { id: 'home', title: 'Your icons appear', body: home, illustration: 'home-icons' },
      ...commonProfileCards(),
    ];
  }
  return [...shareProfileCards(profileCount), ...commonProfileCards()];
}

function shareProfileCards(profileCount: number): StepCardData[] {
  const many = profileCount > 1;
  return [
    {
      id: 'save',
      title: 'Save to Files',
      body: many
        ? `In the share sheet tap Save to Files, pick a folder and tap Save. Do this for each of the ${profileCount} files. AirDrop to your own iPhone or emailing it to yourself in Mail also works.`
        : 'In the share sheet tap Save to Files, pick a folder and tap Save. AirDrop to your own iPhone or emailing it to yourself in Mail also works.',
      illustration: 'share-files',
    },
    {
      id: 'open',
      title: 'Open the file',
      body: 'Open the Files app, go to that folder and tap the Glaze file. iOS says "Profile Downloaded". Install it within a few minutes or iOS discards it and you open it again.',
      illustration: 'files-tap',
    },
    {
      id: 'install',
      title: 'Install in Settings',
      body: 'Open Settings and tap "Profile Downloaded" near the top (or General > VPN & Device Management). Tap Install, enter your passcode, tap Install again, then Done. Not there? Fully close Settings, open it again and go to General > VPN & Device Management > Downloaded Profile. iOS deletes a downloaded profile after about 8 minutes, so if it is gone, tap the file in Files again and go straight to Settings.',
      illustration: 'install-button',
    },
  ];
}

// ---- persisted checklist ----

export const INSTALL_STORE_VERSION = 1;

export type InstallState = {
  /** Done step ids per profile key (profile filename). */
  profileSteps: Record<string, string[]>;
  /** App ids ticked off on the Shortcuts checklist. */
  shortcutsDone: string[];
  /** Last method the person picked. */
  choice: InstallChoice;
  /** T126: present (true) once the person tapped a method card; absent while `choice` is the default. */
  choiceExplicit?: true;
  /**
   * T183: the method-choice generation the explicit pick was made in. Picks from before the
   * latest switch (absent or older; T202 bumped it) are ignored, so everyone starts on Install all
   * at once.
   */
  choiceEpoch?: number;
};

export function defaultInstallState(): InstallState {
  return { profileSteps: {}, shortcutsDone: [], choice: DEFAULT_INSTALL_METHOD };
}

const MAX_IDS = 400;
const MAX_PROFILES = 50;

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v.length > 0 && v.length <= 200 && !out.includes(v)) out.push(v);
    if (out.length >= MAX_IDS) break;
  }
  return out;
}

export function sanitizeInstallState(raw: unknown): InstallState {
  const s = defaultInstallState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  const r = raw as Record<string, unknown>;
  if (r.profileSteps && typeof r.profileSteps === 'object' && !Array.isArray(r.profileSteps)) {
    let n = 0;
    for (const [k, v] of Object.entries(r.profileSteps as Record<string, unknown>)) {
      if (!k || k.length > 200) continue;
      const list = stringList(v);
      if (list.length > 0) {
        s.profileSteps[k] = list;
        if (++n >= MAX_PROFILES) break;
      }
    }
  }
  s.shortcutsDone = stringList(r.shortcutsDone);
  if (r.choice === 'bulk' || r.choice === 'shortcuts') s.choice = r.choice;
  if (r.choiceExplicit === true) s.choiceExplicit = true;
  if (typeof r.choiceEpoch === 'number' && Number.isInteger(r.choiceEpoch) && r.choiceEpoch > 0 && r.choiceEpoch < 1000) {
    s.choiceEpoch = r.choiceEpoch;
  }
  return s;
}

export function parseInstallState(json: string | null | undefined): InstallState {
  if (!json) return defaultInstallState();
  try {
    const v: unknown = JSON.parse(json);
    if (v && typeof v === 'object' && (v as { v?: unknown }).v === INSTALL_STORE_VERSION) {
      return sanitizeInstallState(v);
    }
    return defaultInstallState();
  } catch {
    return defaultInstallState();
  }
}

export function serializeInstallState(s: InstallState): string {
  return JSON.stringify({ v: INSTALL_STORE_VERSION, ...s });
}

function toggleIn(list: readonly string[], id: string, on?: boolean): string[] {
  const has = list.includes(id);
  const want = on ?? !has;
  if (want === has) return [...list];
  return want ? [...list, id] : list.filter((x) => x !== id);
}

export function toggleProfileStep(s: InstallState, profileKey: string, stepId: string, on?: boolean): InstallState {
  const next = toggleIn(s.profileSteps[profileKey] ?? [], stepId, on);
  const profileSteps = { ...s.profileSteps };
  if (next.length > 0) profileSteps[profileKey] = next;
  else delete profileSteps[profileKey];
  return { ...s, profileSteps };
}

export function toggleShortcutDone(s: InstallState, appId: string, on?: boolean): InstallState {
  return { ...s, shortcutsDone: toggleIn(s.shortcutsDone, appId, on) };
}

export function isProfileStepDone(s: InstallState, profileKey: string, stepId: string): boolean {
  return (s.profileSteps[profileKey] ?? []).includes(stepId);
}

/** Done/total for a list of ids against a done list. */
export function checklistCount(ids: readonly string[], done: readonly string[]): { done: number; total: number } {
  const set = new Set(done);
  let n = 0;
  for (const id of ids) if (set.has(id)) n++;
  return { done: n, total: ids.length };
}
