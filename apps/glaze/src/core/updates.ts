// Over-the-air update rules (owner request R2, T41). Pure logic: src/native/updates.ts feeds it
// what the running app knows about itself and acts on the answer. No Expo imports here.

/** Result of a manual "Check for updates" tap. */
export type UpdateCheckOutcome = 'none' | 'downloaded' | 'unavailable' | 'error';

/** Why updates are off for this run (null when they are on). */
export type UpdatesOffReason = 'expo-go' | 'dev' | 'no-module' | 'disabled' | 'not-configured' | null;

export type UpdatesEnvironment = {
  /** expo-constants executionEnvironment: 'storeClient' is Expo Go, 'standalone'/'bare' are real builds. */
  executionEnvironment: string | null | undefined;
  /** __DEV__ in the running bundle. */
  isDev: boolean;
  /** Whether the expo-updates native module could be loaded at all. */
  moduleLoaded: boolean;
  /** expo-updates' own isEnabled flag (false in builds made without an updates URL). */
  moduleEnabled: boolean;
  /** The updates.url from app config, if known. */
  updatesUrl?: string | null;
};

export const PLACEHOLDER_PROJECT_ID = 'REPLACE_WITH_EAS_PROJECT_ID';

/** True when the updates URL is missing or still the placeholder that `eas update:configure` fills in. */
export function isPlaceholderUpdatesUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes(PLACEHOLDER_PROJECT_ID) || !/^https:\/\/u\.expo\.dev\/[0-9a-f-]{8,}$/i.test(url);
}

/** Decide whether this run may talk to EAS Update. Expo Go and dev runs never do. */
export function updatesOffReason(env: UpdatesEnvironment): UpdatesOffReason {
  if (env.executionEnvironment === 'storeClient') return 'expo-go';
  if (env.isDev) return 'dev';
  if (!env.moduleLoaded) return 'no-module';
  if (!env.moduleEnabled) return 'disabled';
  if (env.updatesUrl !== undefined && isPlaceholderUpdatesUrl(env.updatesUrl)) return 'not-configured';
  return null;
}

export function updatesEnabled(env: UpdatesEnvironment): boolean {
  return updatesOffReason(env) === null;
}

/** Plain-words toast text for each outcome of a manual check. */
export function updateCheckMessage(outcome: UpdateCheckOutcome): string {
  switch (outcome) {
    case 'none':
      return 'Glaze is up to date';
    case 'downloaded':
      return 'Update ready. Restarting Glaze…';
    case 'unavailable':
      return 'Updates arrive with TestFlight and App Store builds';
    case 'error':
      return 'Couldn’t check for updates. Try again later.';
  }
}
