// Android adapter (docs/ANDROID.md, T13): video live wallpaper + pinned shortcuts.
// The native module `GlazeAndroid` (modules/glaze-android) only exists in an Android
// development/production build. Everywhere else, including Expo Go and iOS, this adapter
// reports "unavailable" and never throws.
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { pinShortcutJson, wallpaperJson } from '../core/androidPayload';
import { androidShortcutTarget } from '../core/androidShortcut';
import { withMonogram, type IconSpec } from '../core/iconspec';
import type { LoopProject } from '../core/loop';

export type AndroidReason = 'expo-go' | 'ios' | 'not-built' | null;
export type AndroidAvailability = { available: boolean; reason: AndroidReason };
/** Native results plus the adapter's own: 'unavailable' (no module) and 'not-playable' (GIF / no file). */
export type AndroidResult = 'requested' | 'unsupported' | 'unavailable' | 'not-playable' | 'no-link' | `error:${string}`;

/** Shape the Kotlin module exposes (mirrors modules/glaze-android/index.ts). */
type NativeAndroid = {
  setVideoWallpaper(json: string): Promise<string>;
  isPinShortcutSupported(): Promise<boolean>;
  pinShortcut(json: string): Promise<string>;
};

export const isAndroid: boolean = Platform.OS === 'android';

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeAndroid | null | undefined;

function loadNative(): NativeAndroid | null {
  if (cached !== undefined) return cached;
  let found: NativeAndroid | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeAndroid>('GlazeAndroid')
        : null;
    found =
      mod && typeof mod.setVideoWallpaper === 'function' && typeof mod.pinShortcut === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

/** Synchronous availability (safe to call during render). */
export function androidStatus(): AndroidAvailability {
  try {
    if (Platform.OS !== 'android') return { available: false, reason: 'ios' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

function asResult(v: unknown): AndroidResult {
  const s = typeof v === 'string' ? v : '';
  if (s === 'requested' || s === 'unsupported' || s === 'no-link') return s;
  return s.startsWith('error:') ? (s as AndroidResult) : 'error:unknown';
}

function errResult(e: unknown): AndroidResult {
  const msg = e instanceof Error ? e.message : String(e);
  return `error:${msg.slice(0, 120) || 'unknown'}`;
}

export const WHY_UNAVAILABLE: Record<Exclude<AndroidReason, null>, string> = {
  'expo-go': 'You are trying Glaze in the Expo Go preview. This arrives with the full Glaze build for Android.',
  ios: 'This is an Android feature.',
  'not-built': 'This build of Glaze does not include the Android features yet.',
};

export const androidNative = {
  isAndroid,
  status: androidStatus,

  async isAvailable(): Promise<AndroidAvailability> {
    return androidStatus();
  },

  isPinShortcutSupported,
  setVideoWallpaper,
  pinShortcut,
  setVideoWallpaperWithFeedback,
  pinAllWithFeedback,
};

async function isPinShortcutSupported(): Promise<boolean> {
  const mod = androidStatus().available ? loadNative() : null;
  if (!mod) return false;
  try {
    return (await mod.isPinShortcutSupported()) === true;
  } catch {
    return false;
  }
}

/** Save the loop for the wallpaper service and open the system live wallpaper picker. */
async function setVideoWallpaper(project: LoopProject): Promise<AndroidResult> {
  const mod = androidStatus().available ? loadNative() : null;
  if (!mod) return 'unavailable';
  const json = wallpaperJson(project);
  if (!json) return 'not-playable';
  try {
    return asResult(await mod.setVideoWallpaper(json));
  } catch (e) {
    return errResult(e);
  }
}

/** Ask the launcher to pin one icon. The launcher shows its own confirmation dialog. */
async function pinShortcut(spec: IconSpec, pngBase64: string): Promise<AndroidResult> {
  const mod = androidStatus().available ? loadNative() : null;
  if (!mod) return 'unavailable';
  const json = pinShortcutJson(spec, pngBase64);
  if (!json) return 'no-link';
  try {
    return asResult(await mod.pinShortcut(json));
  } catch (e) {
    return errResult(e);
  }
}

/** "Set as live wallpaper" button handler: runs setVideoWallpaper and explains any failure. */
async function setVideoWallpaperWithFeedback(project: LoopProject): Promise<AndroidResult> {
  const status = androidStatus();
  if (!status.available) {
    Alert.alert('Live wallpaper needs the full build', WHY_UNAVAILABLE[status.reason ?? 'not-built']);
    return 'unavailable';
  }
  const r = await setVideoWallpaper(project);
  if (r === 'not-playable') {
    Alert.alert('Pick a video', 'Live wallpapers play videos. GIFs can be saved as a still wallpaper instead.');
  } else if (r === 'unsupported') {
    Alert.alert('Not supported here', 'This phone or launcher does not offer live wallpapers.');
  } else if (r.startsWith('error:')) {
    Alert.alert('Could not set the live wallpaper', 'Try again, or pick the video again in the editor.');
  }
  return r;
}

/**
 * Pin icons one by one. Launchers show one confirmation at a time, so each icon gets its own
 * "Pin <name>?" prompt before the launcher dialog. `render` draws PNGs (base64) for the specs.
 */
async function pinAllWithFeedback(
  specs: readonly IconSpec[],
  render: (specs: IconSpec[]) => Promise<{ appId: string; pngBase64: string }[]>,
): Promise<number> {
  const status = androidStatus();
  if (!status.available) {
    Alert.alert('Pinning needs the full build', WHY_UNAVAILABLE[status.reason ?? 'not-built']);
    return 0;
  }
  if (!(await isPinShortcutSupported())) {
    Alert.alert('Not supported here', 'Your launcher does not accept pinned shortcuts.');
    return 0;
  }
  // T82: the pinned PNGs letter monogram apps exactly as the iOS install path does.
  const linkable = specs.filter((s) => androidShortcutTarget(s) !== null).map((s) => withMonogram(s));
  if (linkable.length === 0) {
    Alert.alert('Nothing to pin', 'These icons do not have supported Android destinations yet. Try Phone, Messages, Mail, Maps, Spotify, YouTube, Instagram, WhatsApp, Chrome or Gmail.');
    return 0;
  }
  let rendered: { appId: string; pngBase64: string }[];
  try {
    rendered = await render(linkable);
  } catch {
    Alert.alert('Could not draw the icons', 'Try again in a moment.');
    return 0;
  }
  let pinned = 0;
  for (const spec of linkable) {
    const png = rendered.find((r) => r.appId === spec.appId)?.pngBase64 ?? '';
    const go = await new Promise<'pin' | 'skip' | 'stop'>((resolve) =>
      Alert.alert(`Pin ${spec.label}?`, 'Your launcher will ask you to confirm.', [
        { text: 'Stop', style: 'cancel', onPress: () => resolve('stop') },
        { text: 'Skip', onPress: () => resolve('skip') },
        { text: 'Pin', onPress: () => resolve('pin') },
      ], { cancelable: true, onDismiss: () => resolve('stop') }),
    );
    if (go === 'stop') break;
    if (go === 'skip') continue;
    const result = await pinShortcut(spec, png);
    if (result === 'requested') pinned += 1;
    else if (result === 'no-link') Alert.alert(`Cannot open ${spec.label}`, 'Install the matching app first, then try pinning this icon again.');
    else Alert.alert('Could not request this icon', 'The launcher could not accept this shortcut. Try again.');
  }
  return pinned;
}
