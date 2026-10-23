// Device facts for the feedback email (T23). Reads only what's on the phone already
// (app config, OS, Platform constants, the saved studio style); nothing leaves the device
// unless the user sends the email themselves.
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { FEEDBACK_ADDRESS } from '../config/feedback';
import {
  buildFeedbackEmail,
  buildFrom,
  buildMailtoUrl,
  deviceModelFrom,
  osName,
  runtimeFrom,
  type FeedbackDiagnostics,
  type FeedbackDraft,
} from '../core/feedback';
import { composeMail, type ComposeOutcome } from '../native/mail';
import { t } from '../i18n';
import { loadStudio } from '../store/studio';

export function deviceDiagnostics(themeId: string | null, iconShape: string | null): FeedbackDiagnostics {
  let appVersion = 'unknown';
  let build = 'dev';
  let runtime: FeedbackDiagnostics['runtime'] = 'standalone';
  let deviceModel = 'unknown';
  try {
    const cfg = Constants.expoConfig;
    appVersion = cfg?.version ?? 'unknown';
    build = buildFrom(Platform.OS, cfg ?? null);
    runtime = runtimeFrom(String(Constants.executionEnvironment ?? ''));
  } catch {
    // Keep defaults.
  }
  try {
    deviceModel = deviceModelFrom((Platform as unknown as { constants?: Record<string, unknown> }).constants);
  } catch {
    deviceModel = 'unknown';
  }
  return {
    appVersion,
    build,
    os: osName(Platform.OS),
    osVersion: String(Platform.Version ?? 'unknown'),
    deviceModel,
    themeId,
    iconShape,
    runtime,
  };
}

/** Diagnostics including the saved theme id and icon shape (never throws). */
export async function loadDiagnostics(): Promise<FeedbackDiagnostics> {
  try {
    const s = await loadStudio();
    return deviceDiagnostics(s.themeId ?? null, s.style?.shape ?? null);
  } catch {
    return deviceDiagnostics(null, null);
  }
}

export function feedbackMailto(draft: FeedbackDraft, diag: FeedbackDiagnostics): string {
  const { subject, body } = buildFeedbackEmail(draft, diag);
  return buildMailtoUrl(FEEDBACK_ADDRESS, subject, body);
}

/** Best effort: open the default mail app with a mailto: link. Resolves false if it couldn't. */
export async function openMailto(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * One-tap "Report a problem" for error screens: works without the router. Opens the in-app
 * composer pre-filled as a Bug; if Mail isn't set up, falls back to a mailto: link.
 */
export async function reportProblem(errorText: string): Promise<ComposeOutcome | 'mailto' | 'failed'> {
  const draft: FeedbackDraft = {
    type: 'bug',
    message: t('ui.error.reportTemplate', { error: errorText }),
  };
  const diag = await loadDiagnostics();
  const { subject, body } = buildFeedbackEmail(draft, diag);
  const outcome = await composeMail({ recipients: [FEEDBACK_ADDRESS], subject, body });
  if (outcome !== 'unavailable' && outcome !== 'failed') return outcome;
  return (await openMailto(buildMailtoUrl(FEEDBACK_ADDRESS, subject, body))) ? 'mailto' : 'failed';
}
