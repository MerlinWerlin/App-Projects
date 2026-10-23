// In-app feedback email (owner requirement B, docs/feedback/2026-10-12-feedback-email.md).
// Pure builders for the subject, body and mailto fallback. The UI (app/feedback.tsx) gathers
// the device facts and hands them in; the address lives in src/config/feedback.ts.
// Nothing here sends anything: the user sends the email from their own Mail app.

export const FEEDBACK_TYPES = ['bug', 'idea', 'theme', 'icon', 'other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  idea: 'Idea',
  theme: 'Theme request',
  icon: 'Icon request',
  other: 'Other',
};

/** Every subject starts with this, so the owner's inbox can filter on it. */
export const SUBJECT_PREFIX = 'Glaze feedback';
/** En dash between subject parts, as in the owner's example. */
export const SUBJECT_SEP = ' – ';

export const DIAG_BEGIN = '----- glaze-diagnostics v1 (please keep) -----';
export const DIAG_END = '----- end glaze-diagnostics -----';

export type FeedbackRuntime = 'expo-go' | 'standalone';

export type FeedbackDiagnostics = {
  appVersion: string;
  build: string;
  os: string;
  osVersion: string;
  deviceModel: string;
  themeId: string | null;
  iconShape: string | null;
  runtime: FeedbackRuntime;
};

export type FeedbackDraft = {
  type: FeedbackType;
  message: string;
  /** Only used for Icon request: the app the user wants an icon for. */
  appName?: string;
};

export const MAX_APP_NAME = 40;

export function isFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(v);
}

/** Collapse whitespace/newlines so a value can't break a subject line or a key: value line. */
export function oneLine(v: string | null | undefined, max = 80): string {
  const s = (v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function orUnknown(v: string | null | undefined): string {
  const s = oneLine(v);
  return s === '' ? 'unknown' : s;
}

/** Type part of the subject; Icon request carries the app name when given. */
export function subjectTypePart(draft: FeedbackDraft): string {
  const label = FEEDBACK_TYPE_LABELS[draft.type] ?? FEEDBACK_TYPE_LABELS.other;
  if (draft.type !== 'icon') return label;
  const app = oneLine(draft.appName, MAX_APP_NAME);
  return app ? `${label} (${app})` : label;
}

/** "Glaze feedback – Bug – v1.0.0 (build 12)". Always starts with SUBJECT_PREFIX. */
export function buildSubject(draft: FeedbackDraft, diag: Pick<FeedbackDiagnostics, 'appVersion' | 'build'>): string {
  const version = orUnknown(diag.appVersion).replace(/^v/i, '');
  const build = orUnknown(diag.build);
  return [SUBJECT_PREFIX, subjectTypePart(draft), `v${version} (build ${build})`].join(SUBJECT_SEP);
}

/** The machine-readable block: one `key: value` per line between fixed delimiters. */
export function diagnosticsBlock(draft: FeedbackDraft, diag: FeedbackDiagnostics): string {
  const rows: [string, string][] = [
    ['type', draft.type],
    ...(draft.type === 'icon' ? ([['app_name', orUnknown(draft.appName)]] as [string, string][]) : []),
    ['app_version', orUnknown(diag.appVersion)],
    ['build', orUnknown(diag.build)],
    ['os', orUnknown(diag.os)],
    ['os_version', orUnknown(diag.osVersion)],
    ['device_model', orUnknown(diag.deviceModel)],
    ['theme_id', diag.themeId ? oneLine(diag.themeId) || 'none' : 'none'],
    ['icon_shape', orUnknown(diag.iconShape)],
    ['runtime', diag.runtime],
  ];
  return [DIAG_BEGIN, ...rows.map(([k, v]) => `${k}: ${v}`), DIAG_END].join('\n');
}

/** Body: the user's message, a blank line, then the diagnostics block. */
export function buildBody(draft: FeedbackDraft, diag: FeedbackDiagnostics): string {
  const message = draft.message.replace(/\r\n?/g, '\n').trim();
  return `${message}\n\n${diagnosticsBlock(draft, diag)}\n`;
}

export function buildFeedbackEmail(
  draft: FeedbackDraft,
  diag: FeedbackDiagnostics,
): { subject: string; body: string } {
  return { subject: buildSubject(draft, diag), body: buildBody(draft, diag) };
}

/** Parse a diagnostics block back into key/value pairs (what an inbox rule or script would do). */
export function parseDiagnostics(body: string): Record<string, string> | null {
  const start = body.indexOf(DIAG_BEGIN);
  const end = body.indexOf(DIAG_END, start);
  if (start < 0 || end < 0) return null;
  const out: Record<string, string> = {};
  for (const line of body.slice(start + DIAG_BEGIN.length, end).split('\n')) {
    const m = /^([a-z_]+): (.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** mailto: fallback for when the in-app composer is unavailable. */
export function buildMailtoUrl(address: string, subject: string, body: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Why Send is disabled, or null when the draft is ready. */
export function draftProblem(draft: FeedbackDraft): string | null {
  if (draft.type === 'icon' && oneLine(draft.appName) === '') return 'Add the app name for your icon request.';
  if (draft.message.trim() === '') return 'Write a short message first.';
  return null;
}

/** expo-constants executionEnvironment: 'storeClient' means the app is running inside Expo Go. */
export function runtimeFrom(executionEnvironment: string | null | undefined): FeedbackRuntime {
  return executionEnvironment === 'storeClient' ? 'expo-go' : 'standalone';
}

/** "ios" -> "iOS", "android" -> "Android"; anything else passes through. */
export function osName(platformOs: string | null | undefined): string {
  if (platformOs === 'ios') return 'iOS';
  if (platformOs === 'android') return 'Android';
  return orUnknown(platformOs);
}

/**
 * Device model from react-native Platform.constants. Android exposes Manufacturer/Model;
 * iOS exposes no model there, so it reports "unknown" (we don't add a device-info package).
 */
export function deviceModelFrom(constants: Record<string, unknown> | null | undefined): string {
  if (!constants) return 'unknown';
  const str = (k: string): string => (typeof constants[k] === 'string' ? oneLine(constants[k] as string) : '');
  const model = str('Model') || str('model');
  const maker = str('Manufacturer') || str('Brand');
  if (!model) return 'unknown';
  return maker && !model.toLowerCase().startsWith(maker.toLowerCase()) ? `${maker} ${model}` : model;
}

/** Build number from app config (ios.buildNumber / android.versionCode), else "dev". */
export function buildFrom(
  platformOs: string | null | undefined,
  config: { ios?: { buildNumber?: string | null } | null; android?: { versionCode?: number | null } | null } | null | undefined,
): string {
  const ios = config?.ios?.buildNumber;
  const android = config?.android?.versionCode;
  if (platformOs === 'android' && typeof android === 'number') return String(android);
  if (ios) return oneLine(ios);
  if (typeof android === 'number') return String(android);
  return 'dev';
}
