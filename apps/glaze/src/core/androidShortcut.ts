// Android targets are separate from the iPhone catalogue. Keep package visibility
// in modules/glaze-android/android/src/main/AndroidManifest.xml in sync.
const PACKAGES: Readonly<Record<string, string>> = {
  spotify: 'com.spotify.music',
  youtube: 'com.google.android.youtube',
  instagram: 'com.instagram.android',
  whatsapp: 'com.whatsapp',
  chrome: 'com.android.chrome',
  gmail: 'com.google.android.gm',
};

export type AndroidShortcutTarget = { packageName: string } | { url: string };

/** Unsupported catalogue entries are omitted, never pinned with an iPhone-only URL. */
export function androidShortcutTarget(spec: { appId: string; urlScheme: string | null }): AndroidShortcutTarget | null {
  if (Object.hasOwn(PACKAGES, spec.appId)) return { packageName: PACKAGES[spec.appId] };
  const standard: Record<string, string> = { phone: 'tel:', messages: 'sms:', mail: 'mailto:', maps: 'geo:0,0' };
  if (Object.hasOwn(standard, spec.appId)) return { url: standard[spec.appId] };
  const url = spec.urlScheme?.trim() ?? '';
  // User/catalogue web links may be opened by the browser or a verified Android app link.
  if (/^https?:\/\/[^\s/]+(?:\/|$)/i.test(url)) return { url };
  return null;
}
