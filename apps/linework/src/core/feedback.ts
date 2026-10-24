// In-app feedback by email (owner 24 Oct 2026: "provide a feedback option which sends emails to my email, we may
// get random requests which we can add quickly"). Same design as Glaze's feedback: pure builders for the subject,
// body and mailto: link; the screen (app/feedback.tsx) hands in the device facts. Nothing here sends anything: the
// user sends the email from their own Mail app. Pure TS, tested in feedback.test.ts.

/** Where feedback goes (the owner's inbox). */
export const FEEDBACK_ADDRESS = 'jaredbradley272@gmail.com';

export const FEEDBACK_TYPES = ['idea', 'bug', 'other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** English labels used in the subject, so the owner's inbox reads the same whatever language the user has. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = { idea: 'Idea', bug: 'Bug', other: 'Other' };

/** En dash between subject parts. */
export const SUBJECT_SEP = ' – ';

export type FeedbackDiagnostics = {
  appVersion: string;
  os: string;
  osVersion: string;
  deviceModel: string;
  language: string;
};

export type FeedbackDraft = { type: FeedbackType; message: string };

export function isFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(v);
}

/** Collapse control characters and whitespace so a value can't break the subject or a `key: value` line. */
export function oneLine(v: string | null | undefined, max = 80): string {
  const s = (v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const orUnknown = (v: string | null | undefined) => oneLine(v) || 'unknown';

/** "Linework feedback – Idea – v1.0.0". */
export function buildSubject(app: string, draft: FeedbackDraft, appVersion: string): string {
  const label = FEEDBACK_TYPE_LABELS[draft.type] ?? FEEDBACK_TYPE_LABELS.other;
  return [`${oneLine(app) || 'App'} feedback`, label, `v${orUnknown(appVersion).replace(/^v/i, '')}`].join(SUBJECT_SEP);
}

/** Body: the user's message, a blank line, then one `key: value` line per device fact. */
export function buildBody(app: string, draft: FeedbackDraft, diag: FeedbackDiagnostics): string {
  const message = draft.message.replace(/\r\n?/g, '\n').trim();
  const rows: [string, string][] = [
    ['app', oneLine(app) || 'App'],
    ['type', draft.type],
    ['app_version', orUnknown(diag.appVersion)],
    ['os', orUnknown(diag.os)],
    ['os_version', orUnknown(diag.osVersion)],
    ['device_model', orUnknown(diag.deviceModel)],
    ['language', orUnknown(diag.language)],
  ];
  return `${message}\n\n-----\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n`;
}

/** mailto: link with the subject and body encoded (works without any native mail module). */
export function buildMailtoUrl(address: string, subject: string, body: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function feedbackMailto(app: string, draft: FeedbackDraft, diag: FeedbackDiagnostics, address = FEEDBACK_ADDRESS): string {
  return buildMailtoUrl(address, buildSubject(app, draft, diag.appVersion), buildBody(app, draft, diag));
}

/** True when the draft has something to send. */
export function draftReady(draft: FeedbackDraft): boolean {
  return draft.message.trim().length > 0;
}
