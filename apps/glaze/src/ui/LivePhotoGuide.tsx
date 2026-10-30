// Live Photo guide (T127, reworded T147 / fb-1025 C): Glaze saves the loop as a Live Photo that
// moves when you press it in Photos. These three illustrated steps show how to TRY it as a
// wallpaper (Photos › Share › Use as Wallpaper › Live Photo on), and the notes say plainly that
// iPhone often keeps app-made Live Photos still there ("Motion not available"), so the still
// wallpaper packs are the reliable wallpaper. No promise of a moving Lock Screen.
// Copy comes from src/core/liveSteps.ts (livePhotoGuide) via liveContext.localizedGuide.
// The pictures are original, simple shapes drawn with react-native-svg (no logos, no
// screenshots). Expo Go safe: the only native call is the livephoto adapter's isAvailable(),
// which never throws.
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { GuideStepId, LiveKind } from '../core/liveSteps';
import { livephoto } from '../native/livephoto';
import { useT } from '../i18n';
import { circleRadius, continuous, radiusV2, spaceV2, textV2, type PaletteV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedGuide, type LocalizedGuideStep } from './liveContext';

type Props = {
  /** Fixed source kind (the editor). Omit on the Live tab (assumes a video). */
  kind?: LiveKind;
};

/** Whether this build carries the GlazeLivePhoto module (undefined while checking). */
function useModuleReady(): boolean | undefined {
  const [ready, setReady] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    livephoto
      .isAvailable()
      .then((s) => {
        if (alive) setReady(s.available);
      })
      .catch(() => {
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/** The full guide card: honest intro, notice when Glaze can't save here, 3 steps, notes. */
export function LivePhotoGuide({ kind = 'video' }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const ctx = useMemo(() => liveContext(), []);
  const moduleReady = useModuleReady();
  const guide = useMemo(
    () =>
      localizedGuide(t, {
        iosMajor: ctx.iosMajor,
        build: ctx.build,
        kind,
        // Expo Go has its own notice; only a full build can be "missing the module".
        moduleReady: ctx.build === 'full' ? moduleReady : undefined,
      }),
    [t, ctx, kind, moduleReady],
  );

  // Live Photos and these steps are iPhone-only; Android has its own live wallpaper button.
  if (!ctx.isIos) return null;

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
      <Text accessibilityRole="header" style={[...ts('headline'), { color: c.ink }]}>
        {t('liveUi.guide.title')}
      </Text>
      <Text style={[...ts('body'), { color: c.inkSecondary }]}>{t('liveUi.guide.honest')}</Text>
      {guide.noticeText ? (
        <View style={[styles.notice, continuous, { backgroundColor: c.tintSoft }]} accessibilityLiveRegion="polite">
          <Text style={[...ts('subhead'), { color: c.onTintSoft }]}>{guide.noticeText}</Text>
        </View>
      ) : null}
      <LivePhotoGuideSteps steps={guide.steps} />
      <View style={[styles.notes, { borderColor: c.separator }]}>
        {guide.notes.map((n, i) => (
          <Text key={i} style={[...ts('footnote'), { color: c.inkSecondary }]}>
            {`• ${n}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Just the three illustrated steps (also shown in the "Saved" sheet). */
export function LivePhotoGuideSteps({ steps }: { steps: LocalizedGuideStep[] }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => (
        <View
          key={s.id}
          style={styles.step}
          accessible
          accessibilityLabel={t('liveUi.guide.stepA11y', { n: String(i + 1), title: s.title, body: s.body })}
        >
          <StepArt id={s.id} c={c} caption={t('liveUi.guide.artWallpaper')} />
          <View style={styles.stepText}>
            <View style={styles.stepHead}>
              <View style={[styles.num, { backgroundColor: c.tint }]}>
                <Text style={[...ts('footnote'), styles.numText, { color: c.onTint }]}>{i + 1}</Text>
              </View>
              <Text style={[...ts('headline'), styles.flex1, { color: c.ink }]}>{s.title}</Text>
            </View>
            <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Illustrations: a small portrait card per step, decorative (hidden from VoiceOver).

type ArtProps = { c: PaletteV2; caption: string };

const ART_W = 72;
const ART_H = 112;

function StepArt({ id, c, caption }: { id: GuideStepId; c: PaletteV2; caption: string }) {
  const Art = ART[id];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.art, continuous, { backgroundColor: c.fill }]}
    >
      <Art c={c} caption={caption} />
    </View>
  );
}

/** Concentric rings: the generic "live" mark Glaze uses in its own pictures. */
function LiveRings({ cx, cy, r, colour }: { cx: number; cy: number; r: number; colour: string }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r * 0.35} fill={colour} />
      <Circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke={colour} strokeWidth={1.2} />
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colour} strokeWidth={1} strokeDasharray="1.5 1.5" />
    </>
  );
}

/** Step 1: a photo library grid, the newest item highlighted with the live rings. */
function PhotosArt({ c }: ArtProps) {
  const cols = 3;
  const gap = 3;
  const pad = 6;
  const cell = (ART_W - pad * 2 - gap * (cols - 1)) / cols;
  const tones = [c.separator, c.surfaceRaised, c.separator, c.surfaceRaised, c.separator, c.surfaceRaised, c.separator, c.surfaceRaised];
  const cells: { x: number; y: number; i: number }[] = [];
  for (let i = 0; i < 12; i++) {
    cells.push({ x: pad + (i % cols) * (cell + gap), y: 16 + Math.floor(i / cols) * (cell + gap), i });
  }
  const last = cells[cells.length - 1];
  return (
    <Svg width={ART_W} height={ART_H}>
      <Defs>
        <LinearGradient id="gStep1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.glaze[0]} />
          <Stop offset="1" stopColor={c.glaze[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={pad} y={6} width={28} height={4} rx={2} fill={c.inkTertiary} />
      {cells.slice(0, -1).map((p) => (
        <Rect key={p.i} x={p.x} y={p.y} width={cell} height={cell} rx={2} fill={tones[p.i % tones.length]} />
      ))}
      <Rect x={last.x} y={last.y} width={cell} height={cell} rx={2} fill="url(#gStep1)" stroke={c.tint} strokeWidth={2} />
      <LiveRings cx={last.x + 6} cy={last.y + 6} r={4} colour="#FFFFFF" />
    </Svg>
  );
}

/** Step 2: the photo with a share sheet; the highlighted row is "Use as Wallpaper". */
function ShareArt({ c, caption }: ArtProps) {
  const sheetY = 50;
  return (
    <View style={styles.artInner}>
      <Svg width={ART_W} height={ART_H}>
        <Defs>
          <LinearGradient id="gStep2" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.glaze[0]} />
            <Stop offset="1" stopColor={c.glaze[1]} />
          </LinearGradient>
        </Defs>
        <Rect x={6} y={6} width={ART_W - 12} height={sheetY} rx={4} fill="url(#gStep2)" />
        {/* Share glyph: a box with an arrow up, on the photo's toolbar. */}
        <Path d={`M ${ART_W - 20} 24 h -4 v 10 h 12 v -10 h -4`} stroke="#FFFFFF" strokeWidth={1.4} fill="none" />
        <Path d={`M ${ART_W - 18} 28 v -10 M ${ART_W - 21} 21 l 3 -3 l 3 3`} stroke="#FFFFFF" strokeWidth={1.4} fill="none" />
        <Rect x={2} y={sheetY - 4} width={ART_W - 4} height={ART_H - sheetY + 2} rx={8} fill={c.surface} />
        <Rect x={ART_W / 2 - 8} y={sheetY} width={16} height={2.5} rx={1.25} fill={c.separator} />
        {[0, 1].map((r) => (
          <Rect key={r} x={8} y={sheetY + 8 + r * 12} width={ART_W - 16} height={8} rx={3} fill={c.fill} />
        ))}
        <Rect x={6} y={sheetY + 32} width={ART_W - 12} height={20} rx={5} fill={c.tintSoft} stroke={c.tint} strokeWidth={1.5} />
      </Svg>
      <Text numberOfLines={2} style={[styles.artCaption, { top: 50 + 33, color: c.onTintSoft }]}>
        {caption}
      </Text>
    </View>
  );
}

/** Step 3: the Lock Screen editor with the live button switched on and an Add pill. */
function LockArt({ c }: ArtProps) {
  return (
    <Svg width={ART_W} height={ART_H}>
      <Defs>
        <LinearGradient id="gStep3" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={c.glaze[0]} />
          <Stop offset="1" stopColor={c.glaze[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={6} y={4} width={ART_W - 12} height={ART_H - 8} rx={10} fill="url(#gStep3)" />
      {/* Date and clock. */}
      <Rect x={ART_W / 2 - 10} y={14} width={20} height={3} rx={1.5} fill="rgba(255,255,255,0.75)" />
      <Rect x={ART_W / 2 - 18} y={20} width={36} height={12} rx={4} fill="rgba(255,255,255,0.9)" />
      {/* Live button (on) bottom-start, Add pill top-end. */}
      <Circle cx={18} cy={ART_H - 18} r={9} fill={c.tint} />
      <LiveRings cx={18} cy={ART_H - 18} r={5} colour={c.onTint} />
      <Rect x={ART_W - 30} y={8} width={20} height={9} rx={4.5} fill="#FFFFFF" />
      <Rect x={ART_W - 25} y={11.5} width={10} height={2} rx={1} fill={c.tint} />
    </Svg>
  );
}

const ART: Record<GuideStepId, (props: ArtProps) => ReactElement> = { photos: PhotosArt, share: ShareArt, lock: LockArt };

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.group, padding: spaceV2.lg, gap: spaceV2.sm },
  notice: { borderRadius: radiusV2.card, padding: spaceV2.md },
  steps: { gap: spaceV2.md, marginTop: spaceV2.xs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.md },
  stepText: { flex: 1, gap: spaceV2.xxs },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  num: { minWidth: 24, minHeight: 24, borderRadius: circleRadius(24), paddingHorizontal: spaceV2.xs, alignItems: 'center', justifyContent: 'center' },
  numText: { fontWeight: '600' },
  art: { width: ART_W, height: ART_H, borderRadius: radiusV2.control, overflow: 'hidden' },
  artInner: { width: ART_W, height: ART_H },
  artCaption: { position: 'absolute', left: 9, right: 9, fontSize: 7, lineHeight: 9, fontWeight: '600', textAlign: 'center' },
  notes: { gap: spaceV2.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spaceV2.sm, marginTop: spaceV2.xs },
  flex1: { flex: 1 },
});
