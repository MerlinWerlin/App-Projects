// How to get a loop onto the iPhone Lock Screen, per iOS version and Glaze build (T30, T127).
// Pure TS (no React Native imports) so the copy and the decisions are unit-tested.
//
// The honest facts (docs/OWNER_1024E.md (part C), Apple support article 120734):
// - No app can set a wallpaper, and no app can make the Lock Screen play a video or a GIF.
// - What Glaze can do: save the loop as a Live Photo (TestFlight / full build, videos only,
//   modules/glaze-livephoto). The user sets it themselves: Photos › Share › Use as Wallpaper,
//   with the Live Photo button on. On iOS 17 or later it plays briefly when the iPhone wakes,
//   then rests on the still frame. It never loops forever. iOS 16 shows Live Photo wallpapers
//   as stills.
// - T127: the old Now Playing "Live Lock Screen" (modules/glaze-livelock) is no longer part of
//   any flow: the owner found a media player over the normal wallpaper confusing, and tapping
//   it did nothing. The native module stays in the repo, unused by the UI.
// - Expo Go (the trial): preview only; you can save a still-frame wallpaper and the clip itself.

export type LiveBuild = 'expo-go' | 'full';
export type LiveKind = 'video' | 'gif';

/** First iOS version whose Lock Screen plays Live Photo wallpapers again (Apple support 120734). */
export const LIVE_PHOTO_WALLPAPER_MIN_IOS = 17;

export const WALLPAPER_PATH = 'Settings › Wallpaper › Add New Wallpaper › Photos';

/**
 * iOS major version from Platform.Version ('26.0', '17.4.1', 18, '18'). Anything unreadable
 * gives 0 ("unknown").
 */
export function parseIosMajor(version: unknown): number {
  if (typeof version === 'number') return Number.isFinite(version) && version > 0 ? Math.floor(version) : 0;
  if (typeof version !== 'string') return 0;
  const m = /^\s*(\d{1,3})(?:\.\d+)*\s*$/.exec(version);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// The Live Photo guide (T127): one honest sentence, three illustrated steps, short notes.

export type GuideStepId = 'photos' | 'share' | 'lock';
export type GuideStep = { id: GuideStepId; title: string; body: string };
export type GuideNoteId = 'moves' | 'needs' | 'old-ios' | 'alt-path';
/** Why Glaze can't save the Live Photo here (null = it can). */
export type GuideNotice = 'needs-full' | 'needs-build' | 'gif' | null;

/** English source of the guide; liveUi.guide.* in every catalogue carries the same text. */
export const GUIDE_TEXT = {
  title: 'Put it on your Lock Screen',
  honest:
    'iOS doesn’t let any app set your wallpaper or play a video on the Lock Screen. Glaze saves your loop as a Live Photo, and you set it yourself in three quick steps.',
  needsFull: 'Saving a Live Photo needs the Glaze TestFlight app. In this preview, use Save to Photos to keep a still frame or the clip.',
  needsBuild:
    'This build of Glaze can’t save Live Photos. Install the latest Glaze TestFlight build; meanwhile, Save to Photos keeps a still frame or the clip.',
  moves: 'It moves for a moment when you wake your iPhone, then rests on the still frame. It doesn’t loop forever.',
  needs:
    'Live Photo wallpapers move on iOS 17 or later. Low Power Mode or Reduce Motion keeps it still, and if iOS says Motion not available, it stays a still picture.',
  oldIos: 'On iOS {version}, Live Photo wallpapers stay still. Update to iOS 17 or later to see it move.',
  altPath: 'You can also start from {path} › Live Photo.',
} as const;

export const GUIDE_STEPS: readonly GuideStep[] = [
  { id: 'photos', title: 'Open it in Photos', body: 'Open the Photos app and tap the Live Photo Glaze saved. It’s the newest item in Recents.' },
  { id: 'share', title: 'Share › Use as Wallpaper', body: 'Tap the Share button, scroll down and tap Use as Wallpaper.' },
  {
    id: 'lock',
    title: 'Turn on Live Photo, then Add',
    body: 'Check the Live Photo button at the bottom is on (not crossed out), then tap Add and Set as Wallpaper Pair.',
  },
];

export type GuideInput = {
  iosMajor: number;
  build: LiveBuild;
  kind: LiveKind;
  /** false when this full build has no GlazeLivePhoto module; omit while unknown. */
  moduleReady?: boolean;
};

export type LivePhotoGuide = {
  /** Glaze can save this loop as a Live Photo here. */
  canSave: boolean;
  notice: GuideNotice;
  steps: GuideStep[];
  notes: GuideNoteId[];
};

/**
 * The Live Lock Screen guide for this device. Always three steps (Photos, Share › Use as
 * Wallpaper, Live Photo on); the notice says when Glaze itself can't save the Live Photo.
 */
export function livePhotoGuide(input: GuideInput): LivePhotoGuide {
  const ios = parseIosMajor(input.iosMajor);
  const notice: GuideNotice =
    input.build === 'expo-go' ? 'needs-full' : input.moduleReady === false ? 'needs-build' : input.kind === 'gif' ? 'gif' : null;
  const notes: GuideNoteId[] = ['moves', ios > 0 && ios < LIVE_PHOTO_WALLPAPER_MIN_IOS ? 'old-ios' : 'needs', 'alt-path'];
  return { canSave: notice === null, notice, steps: GUIDE_STEPS.map((s) => ({ ...s })), notes };
}

// ---------------------------------------------------------------------------
// What can be saved

export type SaveOptionId = 'live-photo' | 'still-frame' | 'clip';

export type SaveOption = {
  id: SaveOptionId;
  label: string;
  detail: string;
  available: boolean;
  /** Why it is not available here (only when available is false). */
  unavailableReason?: string;
};

/**
 * What this build can save for a video or GIF. T127: there is no "looping Lock Screen" option
 * any more (Now Playing is gone from the UI); a Live Photo is the moving option.
 */
export function saveOptions(build: LiveBuild, kind: LiveKind): SaveOption[] {
  const full = build === 'full';
  const livePhotoOk = full && kind === 'video';
  return [
    {
      id: 'still-frame',
      label: 'Still frame wallpaper',
      detail: kind === 'gif'
        ? 'The first frame of the GIF, framed for your Lock Screen at your iPhone’s screen size.'
        : 'The frame at the current position, framed for your Lock Screen at your iPhone’s screen size.',
      available: true,
    },
    {
      id: 'clip',
      label: kind === 'gif' ? 'Save the GIF' : 'Save the clip',
      detail: kind === 'gif'
        ? 'A copy of the original GIF, to keep or use elsewhere.'
        : 'A copy of the original video (untrimmed), to keep for the full build or other uses.',
      available: true,
    },
    {
      id: 'live-photo',
      label: 'Live Photo',
      detail: 'The first 3 seconds as a Live Photo wallpaper that moves briefly.',
      available: livePhotoOk,
      unavailableReason: livePhotoOk
        ? undefined
        : !full
          ? 'Needs the full Glaze build.'
          : 'Live Photos need a video, not a GIF.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Save helpers

const VIDEO_EXTS = ['mov', 'mp4', 'm4v', '3gp'] as const;

export type ClipSaveCheck = { ok: true; ext: string } | { ok: false; reason: 'unsupported' | 'missing' };

/** Lower-case file extension of a URI or path ('' when none). */
export function fileExtension(uri: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri ?? '');
  return m ? m[1].toLowerCase() : '';
}

/** Whether Photos can take this source copy as-is: videos as mov/mp4/m4v/3gp, GIFs as .gif. */
export function checkClipForPhotos(uri: string, kind: LiveKind): ClipSaveCheck {
  if (typeof uri !== 'string' || uri.trim() === '') return { ok: false, reason: 'missing' };
  if (/^https?:/i.test(uri)) return { ok: false, reason: 'unsupported' };
  const ext = fileExtension(uri);
  if (kind === 'gif') return ext === 'gif' ? { ok: true, ext } : { ok: false, reason: 'unsupported' };
  return (VIDEO_EXTS as readonly string[]).includes(ext) ? { ok: true, ext } : { ok: false, reason: 'unsupported' };
}

/**
 * Seconds to grab the still frame at: the player's position, kept inside the trimmed range
 * (and the clip). Non-finite input falls back to the trim start.
 */
export function stillFrameSeconds(currentSec: number, trim: { startMs: number; endMs: number }, durationMs: number): number {
  const start = Math.max(0, trim.startMs);
  let end = trim.endMs > start ? trim.endMs : durationMs > start ? durationMs : start;
  if (durationMs > 0) end = Math.min(end, durationMs);
  const ms = Number.isFinite(currentSec) ? currentSec * 1000 : start;
  const clamped = Math.min(Math.max(ms, start), Math.max(start, end - 1));
  return Math.round(clamped) / 1000;
}

/** One honest line under the Themes hero card for this device and build. */
export function heroSubline(build: LiveBuild, iosMajor: number): string {
  const ios = parseIosMajor(iosMajor);
  if (build === 'expo-go') {
    return 'Frame and preview it here, then save a still wallpaper and the clip. The full Glaze build saves it as a Live Photo.';
  }
  if (ios > 0 && ios < LIVE_PHOTO_WALLPAPER_MIN_IOS) {
    return `On iOS ${ios} a Live Photo wallpaper stays still. It moves on iOS 17 or later.`;
  }
  return 'Saved as a Live Photo you set as your wallpaper. It moves when you wake your iPhone.';
}
