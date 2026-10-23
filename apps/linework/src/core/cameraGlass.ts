// Camera glass material for the Trace screen (docs/DESIGN_V2.md §4 "Materials", §7 Trace row; oversight D72-3).
// Pure so node can test it. The camera view itself is never covered: this only styles the small controls on top.
//
// Blur rule is the same as GlassBar/GlassSheet (src/core/materials.ts shouldBlur): iOS + expo-blur + no Reduce
// Transparency. Without blur the v1 dark-glass fills are kept exactly, so Android and Reduce Transparency look
// as before.

/** expo-blur tint + intensity for every camera-screen pill, button and sheet (always dark, any app scheme). */
export function cameraBlurMaterial(): { tint: string; intensity: number } {
  return { tint: 'systemUltraThinMaterialDark', intensity: 40 };
}

export type CameraGlassKind = 'pill' | 'banner' | 'sheet';

/** v1 solid fills (kept when no blur is drawn). */
export const CAMERA_FALLBACK: Record<CameraGlassKind, string> = {
  pill: 'rgba(20,19,15,0.55)',
  banner: 'rgba(20,19,15,0.82)',
  sheet: 'rgba(20,19,15,0.94)',
};

/** Dark wash drawn over the blur: lighter than the fallback (the blur adds the separation) but never below 30%. */
export const CAMERA_WASH: Record<CameraGlassKind, string> = {
  pill: 'rgba(20,19,15,0.35)',
  banner: 'rgba(20,19,15,0.55)',
  sheet: 'rgba(20,19,15,0.7)',
};

export function cameraGlassFill(blur: boolean, kind: CameraGlassKind): string {
  return blur ? CAMERA_WASH[kind] : CAMERA_FALLBACK[kind];
}

/** Hairline and "on" fill shared by every camera control (unchanged from v1 so captions and states read the same). */
export const cameraGlass = {
  border: 'rgba(255,255,255,0.18)',
  /** v2 top highlight on the dark material. */
  highlight: 'rgba(255,255,255,0.10)',
  fillActive: 'rgba(35,70,168,0.85)',
  icon: '#FFFFFF',
  text: '#EEE8DE',
  muted: '#C9C1B4',
  primary: '#8FA8FF',
  onPrimary: '#14130F',
  secondary: 'rgba(255,255,255,0.08)',
  /** Shadow under control captions so they read on any camera view. */
  captionShadow: 'rgba(0,0,0,0.85)',
  /** Letterbox behind a contained photo (Compare side by side). */
  backdrop: '#000000',
  /** Opacity slider: percent bubble fill and the unfilled track (T95, values unchanged from T84 / T91). */
  bubble: 'rgba(20,19,15,0.82)',
  track: 'rgba(255,255,255,0.25)',
  /** Light scrim behind the touch-lock intro sheet: the camera stays visible. */
  scrim: 'rgba(0,0,0,0.3)',
  /** Touch-lock exit hold ring: white rim over a faint dark wash. */
  ringBorder: 'rgba(255,255,255,0.9)',
  ringWash: 'rgba(20,19,15,0.25)',
} as const;
