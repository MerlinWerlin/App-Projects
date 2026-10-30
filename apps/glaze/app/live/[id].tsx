import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import {
  DEFAULT_CROP,
  SPEEDS,
  applyPan,
  clampCrop,
  clampTrim,
  cropDisplayLayout,
  deviceForScreen,
  formatSeconds,
  lockAspect,
  loopDurationMs,
  maxTrimMs,
  xAtMs,
  type Crop,
  type LoopProject,
  type LoopSpeed,
  type Trim,
} from '../../src/core/loop';
import { androidNative } from '../../src/native/android';
import {
  getProject,
  largeSourceIssue,
  sourceFileBytes,
  upsertProject,
} from '../../src/store/loops';
import { useT } from '../../src/i18n';
import { durations, timing, useMotionReduced } from '../../src/theme/motion';
import type { Script } from '../../src/core/i18n';
import {
  chromeRadiusV2,
  circleRadius,
  continuous,
  editorialV2,
  fontScaleCap,
  radiusV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { SaveAsLivePhotoButton } from '../../src/ui/LivePhotoSheet';
import { LiveSaveToPhotos } from '../../src/ui/LiveSaveToPhotos';
import { LivePhotoGuide } from '../../src/ui/LivePhotoGuide';
import { PhoneFrame, phoneScreenSize } from '../../src/ui/PhoneFrame';
import { PillButton } from '../../src/ui/PillButton';
import { PressableScale } from '../../src/ui/PressableScale';
import { SectionHeader } from '../../src/ui/SectionHeader';
import { Skeleton } from '../../src/ui/Skeleton';
import { SquircleCard } from '../../src/ui/SquircleCard';
import { haptic } from '../../src/ui/haptics';
import { noMirror, noMirrorText, textStyleFor } from '../../src/ui/i18nLayout';

const tick = () => haptic('select');
const HANDLE = sizeV2.touch; // trim handle touch width (48 pt)
const TRIM_STEP_MS = 500;
const HANDLE_ACTIVE_SCALE = 1.12;
const KNOB_W = 20;

type EditorType = { body: TextStyle[]; heading: TextStyle[]; label: TextStyle[]; small: TextStyle[] };

/** v2 system type for the roles the editor uses, with the script's line-height fixes (T56). */
function typeFor(script: Script): EditorType {
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return { body: ts('body'), heading: ts('headline'), label: ts('headline'), small: ts('footnote') };
}

export default function EditLoopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useColorsV2();
  const { t, script } = useT();
  const type = typeFor(script);
  const [project, setProject] = useState<LoopProject | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getProject(String(id ?? '')).then((p) => {
      if (alive) setProject(p);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (project === undefined) return <EditorSkeleton />;
  if (project === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...type.body, { color: c.inkSecondary }]}>
          {t('live.editor.missing')}
        </Text>
      </View>
    );
  }
  return <Editor initial={project} />;
}

/**
 * The preview phone's size for this device: Lock Screen aspect (screen size in points, any
 * orientation) and the outer frame width (bezel included) inside the preview card, whose padding
 * sits inside the screen's 16 pt gutters.
 */
function useEditorPhone() {
  const win = useWindowDimensions();
  const aspect = useMemo(() => {
    const s = Dimensions.get('screen');
    return lockAspect(deviceForScreen(s.width, s.height));
  }, []);
  const phoneW = Math.max(132, Math.min(win.width - spaceV2.lg * 4, win.height * 0.55 * aspect + 24));
  const screenSize = phoneScreenSize(phoneW, aspect);
  return { aspect, phoneW, screenSize, outerH: screenSize.height + screenSize.bezel * 2 };
}

/** T176: the wait while the loop loads, in the editor's own shape (name field, preview, trim bar). */
function EditorSkeleton() {
  const { c } = useColorsV2();
  const { t } = useT();
  const { phoneW, outerH } = useEditorPhone();
  return (
    <View
      accessible
      accessibilityLabel={t('live.editor.loading')}
      style={[styles.skeletonRoot, styles.content, { backgroundColor: c.bg }]}
    >
      <Skeleton width="100%" height={sizeV2.rowMin} radius={chromeRadiusV2.control} />
      <SquircleCard size="large" elevation="raised" tone="raised" outline={false} haptic={false}>
        <View style={styles.frame}>
          <Skeleton width={phoneW} height={outerH} radius={radiusV2.cardLarge} />
        </View>
      </SquircleCard>
      <Skeleton width="100%" height={sizeV2.touch} radius={chromeRadiusV2.pill} />
    </View>
  );
}

// ---------------------------------------------------------------------------

type EditorProps = {
  initial: LoopProject;
};

type EditorIconButtonProps = {
  icon: FeatherName;
  onPress: () => void;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  disabled?: boolean;
};

/** 48 pt round tint icon button (zoom out / in under the preview). */
function EditorIconButton({ icon, onPress, accessibilityLabel, disabled = false }: EditorIconButtonProps) {
  const { c } = useColorsV2();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.iconBtn, disabled ? styles.iconBtnDisabled : null]}
    >
      <Feather name={icon} size={20} color={c.tint} />
    </PressableScale>
  );
}

function Editor({ initial }: EditorProps) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const type = typeFor(script);
  const [project, setProject] = useState<LoopProject>(initial);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // The preview's player, for grabbing a still frame (T30).
  const playerRef = useRef<VideoPlayer | null>(null);

  // Outer phone frame width (bezel included); the media fills the screen area inside it.
  const { aspect, phoneW, screenSize } = useEditorPhone();
  const frameW = screenSize.width;
  const source = useMemo(
    () => ({ width: project.sourceWidth, height: project.sourceHeight }),
    [project.sourceWidth, project.sourceHeight],
  );
  const layout = cropDisplayLayout(source, aspect, project.crop, frameW);

  // Persist edits (debounced) and flush on leave.
  const latest = useRef(project);
  latest.current = project;
  const dirty = useRef(false);
  useEffect(() => {
    if (project === initial) return;
    dirty.current = true;
    const t = setTimeout(() => {
      dirty.current = false;
      upsertProject(latest.current).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [project, initial]);
  useEffect(
    () => () => {
      if (dirty.current) upsertProject(latest.current).catch(() => {});
    },
    [],
  );

  // Size check reads file metadata only (never the bytes).
  const [sourceBytes, setSourceBytes] = useState<number | null>(null);
  useEffect(() => {
    if (initial.kind !== 'video') return;
    let alive = true;
    sourceFileBytes(initial.sourceUri).then((b) => {
      if (alive) setSourceBytes(b);
    });
    return () => {
      alive = false;
    };
  }, [initial.kind, initial.sourceUri]);
  const sizeIssue = project.kind === 'video' ? largeSourceIssue(sourceBytes, project.sourceDurationMs) : null;
  const sizeWarning = sizeIssue ? t(`live.editor.largeSource.${sizeIssue}`) : null;

  const update = (patch: Partial<LoopProject>) => setProject((p) => ({ ...p, ...patch }));

  // --- crop gestures (JS thread; simple state updates) ---
  const cropRef = useRef<Crop>(project.crop);
  cropRef.current = project.crop;
  const last = useRef({ x: 0, y: 0, scale: 1 });
  const setCrop = (next: Crop) => {
    cropRef.current = next;
    setProject((p) => ({ ...p, crop: next }));
  };
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => setScrollEnabled(false))
      .onStart(() => {
        last.current.x = 0;
        last.current.y = 0;
      })
      .onUpdate((e) => {
        const dx = e.translationX - last.current.x;
        const dy = e.translationY - last.current.y;
        last.current.x = e.translationX;
        last.current.y = e.translationY;
        setCrop(applyPan(cropRef.current, dx, dy, source, aspect, frameW));
      })
      .onFinalize(() => setScrollEnabled(true));
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => setScrollEnabled(false))
      .onStart(() => {
        last.current.scale = 1;
      })
      .onUpdate((e) => {
        if (!(e.scale > 0)) return;
        const ratio = e.scale / last.current.scale;
        last.current.scale = e.scale;
        setCrop(clampCrop({ ...cropRef.current, scale: cropRef.current.scale * ratio }));
      })
      .onEnd(() => tick())
      .onFinalize(() => setScrollEnabled(true));
    return Gesture.Simultaneous(pan, pinch);
    // setCrop only touches refs and the state setter, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, aspect, frameW]);

  const zoom = (factor: number) => {
    tick();
    setCrop(clampCrop({ ...cropRef.current, scale: cropRef.current.scale * factor }));
  };
  const nudge = (dx: number, dy: number) => setCrop(applyPan(cropRef.current, dx, dy, source, aspect, frameW));
  const onCropA11y = (e: AccessibilityActionEvent) => {
    const step = frameW * 0.1;
    const name = e.nativeEvent.actionName;
    if (name === 'increment') zoom(1.25);
    else if (name === 'decrement') zoom(0.8);
    else if (name === 'moveLeft') nudge(step, 0);
    else if (name === 'moveRight') nudge(-step, 0);
    else if (name === 'moveUp') nudge(0, step);
    else if (name === 'moveDown') nudge(0, -step);
    else if (name === 'activate') setCrop({ ...DEFAULT_CROP });
  };

  const setSpeed = (speed: LoopSpeed) => {
    tick();
    setProject((p) => ({ ...p, speed, trim: clampTrim(p.trim, p.sourceDurationMs, { speed }) }));
  };

  const hasTrim = project.kind === 'video' && project.sourceDurationMs > 0; // i18n-ignore (generic/comparison, not text)

  return (
    <ScrollView bounces={false} overScrollMode="never"
      scrollEnabled={scrollEnabled}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
    >
      <TextInput
        maxFontSizeMultiplier={fontScaleCap('headline')}
        value={project.name}
        onChangeText={(name) => update({ name })}
        onEndEditing={() => {
          if (!project.name.trim()) update({ name: initial.name });
        }}
        maxLength={40}
        returnKeyType="done"
        accessibilityLabel={t('live.editor.nameLabel')}
        placeholder={t('live.editor.nameLabel')}
        placeholderTextColor={c.inkSecondary}
        style={[...type.heading, styles.name, continuous, { color: c.ink, backgroundColor: c.surface }]}
      />

      {/* T176: editorial sections (Frame it / Trim / Speed / Save it) on the 16 pt rhythm. */}
      <SectionHeader
        flushTop
        eyebrow={t('live.editor.sections.frame.eyebrow')}
        title={t('live.editor.sections.frame.title')}
        style={styles.sectionHead}
      />
      {/* Preview on a soft raised surface (no hairline): the whole source, positioned so the frame
          shows the crop, with the Lock Screen on top; the zoom controls and guide note sit with it. */}
      <SquircleCard size="large" elevation="raised" tone="raised" outline={false} haptic={false}>
        <View style={styles.previewStack}>
          <GestureDetector gesture={gesture}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('live.editor.cropLabel')}
              accessibilityValue={{ text: t('live.editor.cropValue', { zoom: project.crop.scale.toFixed(1) }) }}
              accessibilityActions={[
                { name: 'increment', label: t('live.editor.zoomIn') },
                { name: 'decrement', label: t('live.editor.zoomOut') },
                { name: 'moveLeft', label: t('live.editor.moveLeft') },
                { name: 'moveRight', label: t('live.editor.moveRight') },
                { name: 'moveUp', label: t('live.editor.moveUp') },
                { name: 'moveDown', label: t('live.editor.moveDown') },
                { name: 'activate', label: t('live.editor.resetCrop') },
              ]}
              onAccessibilityAction={onCropA11y}
              style={styles.frame}
            >
              <PhoneFrame width={phoneW} aspect={aspect} showClock showGuides>
                {project.kind === 'video' ? (
                  <VideoMedia
                    uri={project.sourceUri}
                    trim={project.trim}
                    speed={project.speed}
                    durationMs={project.sourceDurationMs}
                    layout={layout}
                    onPlayer={(pl) => {
                      playerRef.current = pl;
                    }}
                    onDuration={(ms) =>
                      setProject((p) =>
                        p.sourceDurationMs > 0
                          ? p
                          : { ...p, sourceDurationMs: ms, trim: clampTrim({ startMs: 0, endMs: ms }, ms, { speed: p.speed }) },
                      )
                    }
                  />
                ) : (
                  <ExpoImage
                    source={{ uri: project.sourceUri }}
                    style={[styles.media, layout]}
                    contentFit="fill"
                    cachePolicy="memory-disk"
                    transition={0}
                    accessibilityIgnoresInvertColors
                  />
                )}
              </PhoneFrame>
            </View>
          </GestureDetector>

          <View style={styles.row}>
            <EditorIconButton icon="zoom-out" accessibilityLabel={t('live.editor.zoomOut')} onPress={() => zoom(0.8)} disabled={project.crop.scale <= 1} />
            <PillButton
              label={t('live.editor.resetCrop')}
              variant="plain"
              onPress={() => {
                tick();
                setCrop({ ...DEFAULT_CROP });
              }}
            />
            <EditorIconButton icon="zoom-in" accessibilityLabel={t('live.editor.zoomIn')} onPress={() => zoom(1.25)} disabled={project.crop.scale >= 4} />
          </View>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type.small, styles.centerText, { color: c.inkSecondary }]}>
            {t('live.editor.guides')}
          </Text>
        </View>
      </SquircleCard>
      {sizeWarning ? (
        <View
          accessible
          accessibilityRole="alert"
          style={[styles.warnBox, continuous, { backgroundColor: scheme === 'dark' ? c.surfaceRaised : c.surface }]}
        >
          <Feather name="alert-triangle" size={18} color={c.warn} />
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type.small, styles.flex1, { color: c.ink }]}>
            {sizeWarning}
          </Text>
        </View>
      ) : null}

      <SectionHeader
        flushTop
        eyebrow={t('live.editor.sections.clip.eyebrow')}
        title={t('live.editor.trim')}
        style={[styles.sectionHead, styles.sectionNext]}
      />
      {hasTrim ? (
        <TrimBar
          durationMs={project.sourceDurationMs}
          trim={project.trim}
          speed={project.speed}
          onChange={(trim) => setProject((p) => ({ ...p, trim }))}
          onGestureActive={(active) => setScrollEnabled(!active)}
        />
      ) : (
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...type.body, { color: c.inkSecondary }]}>
          {project.kind === 'gif' ? t('live.editor.gifFull') : t('live.editor.readingLength')}
        </Text>
      )}

      <SectionHeader level="group" flushTop title={t('live.editor.speed')} style={[styles.sectionHead, styles.groupNext]} />
      <View style={styles.segment} accessibilityRole="radiogroup">
        {SPEEDS.map((s) => {
          const on = project.speed === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSpeed(s)}
              accessibilityRole="radio"
              accessibilityLabel={t('live.editor.speedA11y', { speed: String(s) })}
              accessibilityState={{ selected: on, checked: on }}
              style={[
                styles.segmentItem,
                continuous,
                { backgroundColor: on ? c.tint : c.surface },
              ]}
            >
              <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...type.label, noMirrorText, { color: on ? c.onTint : c.ink }]}>
                {`${s}×`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {project.kind === 'gif' && project.speed !== 1 ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type.small, { color: c.inkSecondary }]}>
          {t('live.editor.gifSpeedNote')}
        </Text>
      ) : null}

      <SectionHeader
        flushTop
        eyebrow={t('live.editor.sections.finish.eyebrow')}
        title={t('live.editor.sections.finish.title')}
        body={t('live.editor.sections.finish.body')}
        style={[styles.sectionHead, styles.sectionNext]}
      />

      {/* T127: the main action saves the Live Photo (it moves when pressed in Photos). The guide
          shows how to try it as a wallpaper (Photos › Share › Use as Wallpaper › Live Photo on);
          T147 (fb-1025 C): iPhone often keeps app-made Live Photos still there, and the copy says
          so instead of promising motion. The old Now Playing mode is no longer offered anywhere
          in the UI (docs/OWNER_1024E.md (part C)). */}
      <SaveAsLivePhotoButton
        getProject={() => latest.current}
        onBeforeSave={() => {
          upsertProject(latest.current).catch(() => {});
          dirty.current = false;
        }}
      />
      <LivePhotoGuide kind={project.kind} />

      {/* T30: what Expo Go (and every build) can save: a still-frame wallpaper and the clip. */}
      <LiveSaveToPhotos getProject={() => latest.current} getPlayer={() => playerRef.current} />

      {androidNative.isAndroid ? (
        <PillButton
          label={t('live.editor.setAndroid')}
          icon="film"
          variant="tinted"
          block
          accessibilityHint={t('live.editor.setAndroidHint')}
          onPress={() => {
            haptic('select');
            upsertProject(latest.current).catch(() => {});
            dirty.current = false;
            androidNative.setVideoWallpaperWithFeedback(latest.current).catch(() => {});
          }}
        />
      ) : null}

    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

type Layout = { left: number; top: number; width: number; height: number };

/** Muted looping video; loops the trimmed range at the chosen speed. */
type VideoMediaProps = {
  uri: string;
  trim: Trim;
  speed: LoopSpeed;
  durationMs: number;
  layout: Layout;
  onPlayer?: (player: VideoPlayer | null) => void;
  onDuration: (ms: number) => void;
};

function VideoMedia({ uri, trim, speed, durationMs, layout, onPlayer, onDuration }: VideoMediaProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const onPlayerRef = useRef(onPlayer);
  onPlayerRef.current = onPlayer;
  useEffect(() => {
    onPlayerRef.current?.(player);
    return () => onPlayerRef.current?.(null);
  }, [player]);

  useEffect(() => {
    try {
      player.playbackRate = speed;
    } catch {
      // Player released.
    }
  }, [player, speed]);

  // Learn the duration if the picker did not give one.
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  useEffect(() => {
    if (durationMs > 0) return;
    const t = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) {
          onDurationRef.current(Math.round(d * 1000));
          clearInterval(t);
        }
      } catch {
        clearInterval(t);
      }
    }, 250);
    return () => clearInterval(t);
  }, [player, durationMs]);

  // Show the edge being trimmed: moving the start jumps there, moving the end
  // jumps to just before it.
  const prevTrim = useRef(trim);
  useEffect(() => {
    const prev = prevTrim.current;
    prevTrim.current = trim;
    if (prev.startMs === trim.startMs && prev.endMs === trim.endMs) return;
    const target = prev.startMs !== trim.startMs ? trim.startMs : Math.max(trim.startMs, trim.endMs - 1500);
    try {
      player.currentTime = target / 1000;
    } catch {
      // Player released.
    }
  }, [player, trim]);

  // The native loop covers the full clip; for a shorter range, wrap at the end.
  useEffect(() => {
    if (!(durationMs > 0)) return; // i18n-ignore (generic/comparison, not text)
    const full = trim.startMs <= 50 && trim.endMs >= durationMs - 50;
    if (full) return;
    const t = setInterval(() => {
      try {
        const now = player.currentTime * 1000;
        if (now >= trim.endMs || now < trim.startMs - 250) player.currentTime = trim.startMs / 1000; // i18n-ignore (generic/comparison, not text)
      } catch {
        clearInterval(t);
      }
    }, 40);
    return () => clearInterval(t);
  }, [player, trim.startMs, trim.endMs, durationMs]);

  return (
    <View pointerEvents="none" style={[styles.media, layout]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Two-handle trim bar. The start handle's touch area sits to the left of its line
 * and the end handle's to the right, so they never overlap even at 0.5 s apart.
 */
type TrimBarProps = {
  durationMs: number;
  trim: Trim;
  speed: LoopSpeed;
  onChange: (trim: Trim) => void;
  onGestureActive: (active: boolean) => void;
};

function TrimBar({ durationMs, trim, speed, onChange, onGestureActive }: TrimBarProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const type = typeFor(script);
  const secs = (ms: number) => formatSeconds(ms, (value) => t('live.seconds', { value }));
  const [width, setWidth] = useState(0);
  const track = Math.max(1, width - HANDLE * 2);
  const xs = xAtMs(trim.startMs, track, durationMs);
  const xe = xAtMs(trim.endMs, track, durationMs);

  const trimRef = useRef(trim);
  trimRef.current = trim;
  const base = useRef(0);
  const cb = useRef({ onChange, onGestureActive });
  cb.current = { onChange, onGestureActive };

  // Press-scale on the knobs (a fade instead when Reduce Motion is on).
  const reduced = useMotionReduced();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const startPress = useSharedValue(0);
  const endPress = useSharedValue(0);
  const setPressed = (sv: SharedValue<number>, on: boolean) => {
    sv.value = reducedRef.current
      ? withTiming(on ? 1 : 0, { duration: durations.fast })
      : withTiming(on ? 1 : 0, timing.fast); // owner 25 Oct: no spring/bounce in the Live Photo part
  };

  // Selection haptic each time a handle crosses a whole-second step.
  const lastSec = useRef({ start: -1, end: -1 });

  const move = (edge: 'start' | 'end', ms: number) => {
    const t = trimRef.current;
    const next = clampTrim(edge === 'start' ? { ...t, startMs: ms } : { ...t, endMs: ms }, durationMs, {
      anchor: edge,
      speed,
    });
    if (next.startMs !== t.startMs || next.endMs !== t.endMs) {
      trimRef.current = next;
      cb.current.onChange(next);
      const sec = Math.floor((edge === 'start' ? next.startMs : next.endMs) / 1000);
      if (sec !== lastSec.current[edge]) {
        lastSec.current[edge] = sec;
        tick();
      }
    }
  };

  const makePan = (edge: 'start' | 'end') =>
    Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => {
        cb.current.onGestureActive(true);
        base.current = edge === 'start' ? trimRef.current.startMs : trimRef.current.endMs;
        lastSec.current[edge] = Math.floor(base.current / 1000);
        setPressed(edge === 'start' ? startPress : endPress, true);
      })
      .onUpdate((e) => move(edge, base.current + (e.translationX / track) * durationMs))
      .onFinalize(() => {
        setPressed(edge === 'start' ? startPress : endPress, false);
        cb.current.onGestureActive(false);
      });

  // Rebuild only when the inputs the gestures read by value change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startPan = useMemo(() => makePan('start'), [track, durationMs, speed]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const endPan = useMemo(() => makePan('end'), [track, durationMs, speed]);

  const a11y = (edge: 'start' | 'end') => (e: AccessibilityActionEvent) => {
    const cur = edge === 'start' ? trimRef.current.startMs : trimRef.current.endMs;
    if (e.nativeEvent.actionName === 'increment') move(edge, cur + TRIM_STEP_MS);
    if (e.nativeEvent.actionName === 'decrement') move(edge, cur - TRIM_STEP_MS);
  };
  const actions = [
    { name: 'increment', label: t('live.editor.later') },
    { name: 'decrement', label: t('live.editor.earlier') },
  ];

  // The timeline never mirrors: time runs left to right in every language.
  return (
    <View style={noMirror}>
      <View style={styles.trim} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.trackBg, { left: HANDLE, right: HANDLE, backgroundColor: c.fill }]} />
        <View style={[styles.trackSel, { left: HANDLE + xs, width: Math.max(2, xe - xs), backgroundColor: c.tint }]} />
        <GestureDetector gesture={startPan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('live.editor.trimStart')}
            accessibilityValue={{ text: secs(trim.startMs) }}
            accessibilityActions={actions}
            onAccessibilityAction={a11y('start')}
            style={[styles.handle, { left: xs, alignItems: 'flex-end' }]}
          >
            <Knob press={startPress} reduced={reduced} color={c.tint}>
              <Feather name="chevron-left" size={14} color={c.onTint} />
            </Knob>
          </View>
        </GestureDetector>
        <GestureDetector gesture={endPan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('live.editor.trimEnd')}
            accessibilityValue={{ text: secs(trim.endMs) }}
            accessibilityActions={actions}
            onAccessibilityAction={a11y('end')}
            style={[styles.handle, { left: HANDLE + xe, alignItems: 'flex-start' }]}
          >
            <Knob press={endPress} reduced={reduced} color={c.tint}>
              <Feather name="chevron-right" size={14} color={c.onTint} />
            </Knob>
          </View>
        </GestureDetector>
      </View>
      <View style={styles.trimLabels}>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type.small, noMirrorText, { color: c.inkSecondary }]}>
          {secs(trim.startMs)}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...type.label, styles.trimMid, { color: c.ink }]}>
          {t('live.editor.loopLength', {
            duration: `\u2066${secs(loopDurationMs(trim, speed))}\u2069`,
            max: `\u2066${secs(maxTrimMs(speed) / speed)}\u2069`,
          })}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type.small, noMirrorText, { color: c.inkSecondary }]}>
          {secs(trim.endMs)}
        </Text>
      </View>
    </View>
  );
}

/** Trim knob that grows slightly while held (or dims, with Reduce Motion). */
type KnobProps = {
  press: SharedValue<number>;
  reduced: boolean;
  color: string;
  children: ReactNode;
};

function Knob({ press, reduced, color, children }: KnobProps) {
  const anim = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - press.value * 0.25, transform: [{ scale: 1 }] }
      : { opacity: 1, transform: [{ scale: 1 + press.value * (HANDLE_ACTIVE_SCALE - 1) }] },
  );
  return <Animated.View style={[styles.knob, { backgroundColor: color }, anim]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spaceV2.lg },
  // T176: 16 pt rhythm between blocks; section headers keep the editorial 32 pt above, 12 pt below.
  content: { padding: spaceV2.lg, gap: editorialV2.cardGap, paddingBottom: spaceV2.xxl },
  skeletonRoot: { flex: 1 },
  sectionHead: { paddingBottom: 0, marginBottom: editorialV2.sectionBottom - editorialV2.cardGap },
  sectionNext: { paddingTop: editorialV2.sectionTop - editorialV2.cardGap },
  groupNext: { paddingTop: spaceV2.sm },
  previewStack: { gap: spaceV2.md },
  name: { minHeight: sizeV2.rowMin, borderRadius: chromeRadiusV2.control, paddingHorizontal: spaceV2.lg },
  frame: { alignSelf: 'center' },
  media: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm },
  centerText: { textAlign: 'center' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceV2.sm,
    borderRadius: chromeRadiusV2.card,
    padding: spaceV2.lg,
  },
  flex1: { flex: 1 },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  iconBtnDisabled: { opacity: 0.35 },
  segment: { flexDirection: 'row', gap: spaceV2.sm },
  segmentItem: {
    flex: 1,
    minHeight: sizeV2.touch,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trim: { height: sizeV2.touch + spaceV2.sm, justifyContent: 'center' },
  trimMid: { flexShrink: 1, textAlign: 'center' },
  trackBg: { position: 'absolute', height: 6, borderRadius: circleRadius(6) },
  trackSel: { position: 'absolute', height: 6, borderRadius: circleRadius(6) },
  handle: { position: 'absolute', top: spaceV2.xs, width: HANDLE, height: sizeV2.touch, justifyContent: 'center' },
  // Capsule knob (shape radius, not chrome): half its width.
  knob: { width: KNOB_W, height: 40, borderRadius: circleRadius(KNOB_W), alignItems: 'center', justifyContent: 'center' },
  trimLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spaceV2.sm,
    marginTop: spaceV2.xs,
  },
});
