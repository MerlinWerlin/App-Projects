import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import {
  DEFAULT_CROP,
  SPEEDS,
  addToPlaylist,
  applyPan,
  clampCrop,
  clampTrim,
  cropDisplayLayout,
  deviceForScreen,
  formatSeconds,
  lockAspect,
  loopDurationMs,
  maxTrimMs,
  removeFromPlaylist,
  xAtMs,
  type Crop,
  type LoopProject,
  type LoopSpeed,
  type Trim,
} from '../../src/core/loop';
import type { LivelockReason } from '../../src/native/livelock';
import { androidNative } from '../../src/native/android';
import {
  getProject,
  largeSourceIssue,
  loadLoops,
  setPlaylist,
  sourceFileBytes,
  upsertProject,
} from '../../src/store/loops';
import { useT } from '../../src/i18n';
import { durations, springConfig, useMotionReduced } from '../../src/theme/motion';
import type { Script } from '../../src/core/i18n';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import {
  LiveUnavailableSheet,
  LivelockRunningCard,
  setOnLockScreen,
  useLivelockState,
} from '../../src/ui/LiveUnavailableSheet';
import { SaveAsLivePhotoButton } from '../../src/ui/LivePhotoSheet';
import { LiveSaveToPhotos } from '../../src/ui/LiveSaveToPhotos';
import { LiveStepsCard } from '../../src/ui/LiveStepsCard';
import { PhoneFrame, phoneScreenSize } from '../../src/ui/PhoneFrame';
import { PillButton } from '../../src/ui/PillButton';
import { PressableScale } from '../../src/ui/PressableScale';
import { haptic } from '../../src/ui/haptics';
import { noMirror, noMirrorText, textStyleFor } from '../../src/ui/i18nLayout';

const tick = () => haptic('select');
const HANDLE = sizeV2.touch; // trim handle touch width (48 pt)
const TRIM_STEP_MS = 500;
const HANDLE_ACTIVE_SCALE = 1.12;

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

  if (project === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.tint} accessibilityLabel={t('live.editor.loading')} />
      </View>
    );
  }
  if (project === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[...type.body, { color: c.inkSecondary }]}>{t('live.editor.missing')}</Text>
      </View>
    );
  }
  return <Editor initial={project} />;
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
  const { c } = useColorsV2();
  const { t, script } = useT();
  const type = typeFor(script);
  const win = useWindowDimensions();
  const [project, setProject] = useState<LoopProject>(initial);
  const [inPlaylist, setInPlaylist] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [unavailable, setUnavailable] = useState<{ visible: boolean; reason: LivelockReason }>({
    visible: false,
    reason: null,
  });
  // Live Lock Screen state (always idle in Expo Go, so nothing below changes there).
  const live = useLivelockState();
  // The preview's player, for grabbing a still frame (T30).
  const playerRef = useRef<VideoPlayer | null>(null);

  // Lock Screen aspect for this phone (screen size in points, any orientation).
  const aspect = useMemo(() => {
    const s = Dimensions.get('screen');
    return lockAspect(deviceForScreen(s.width, s.height));
  }, []);
  // Outer phone frame width (bezel included); the media fills the screen area inside it.
  const phoneW = Math.max(132, Math.min(win.width - spaceV2.lg * 2, win.height * 0.55 * aspect + 24));
  const screenSize = phoneScreenSize(phoneW, aspect);
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

  useEffect(() => {
    let alive = true;
    loadLoops().then((s) => {
      if (alive) setInPlaylist(s.playlist.includes(initial.id));
    });
    return () => {
      alive = false;
    };
  }, [initial.id]);

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

  const togglePlaylist = async () => {
    tick();
    const s = await loadLoops();
    const next = inPlaylist ? removeFromPlaylist(s.playlist, project.id) : addToPlaylist(s.playlist, project.id);
    await upsertProject(latest.current);
    dirty.current = false;
    const saved = await setPlaylist(next);
    setInPlaylist(saved.playlist.includes(project.id));
  };

  const hasTrim = project.kind === 'video' && project.sourceDurationMs > 0; // i18n-ignore (generic/comparison, not text)

  return (
    <ScrollView
      scrollEnabled={scrollEnabled}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
    >
      <TextInput
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

      {/* Preview: the whole source, positioned so the frame shows the crop, with the Lock Screen on top. */}
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
              <Image source={{ uri: project.sourceUri }} style={[styles.media, layout]} resizeMode="stretch" />
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
      {sizeWarning ? (
        <View accessible accessibilityRole="alert" style={[styles.warnBox, continuous, { borderColor: c.warn }]}>
          <Feather name="alert-triangle" size={16} color={c.warn} />
          <Text style={[...type.small, styles.flex1, { color: c.ink }]}>{sizeWarning}</Text>
        </View>
      ) : null}
      <Text style={[...type.small, styles.centerText, { color: c.inkSecondary }]}>
        {t('live.editor.guides')}
      </Text>

      <Text accessibilityRole="header" style={[...type.heading, { color: c.ink }]}>
        {t('live.editor.trim')}
      </Text>
      {hasTrim ? (
        <TrimBar
          durationMs={project.sourceDurationMs}
          trim={project.trim}
          speed={project.speed}
          onChange={(trim) => setProject((p) => ({ ...p, trim }))}
          onGestureActive={(active) => setScrollEnabled(!active)}
        />
      ) : (
        <Text style={[...type.body, { color: c.inkSecondary }]}>
          {project.kind === 'gif' ? t('live.editor.gifFull') : t('live.editor.readingLength')}
        </Text>
      )}

      <Text accessibilityRole="header" style={[...type.heading, { color: c.ink }]}>
        {t('live.editor.speed')}
      </Text>
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
              <Text style={[...type.label, noMirrorText, { color: on ? c.onTint : c.ink }]}>{`${s}×`}</Text>
            </Pressable>
          );
        })}
      </View>
      {project.kind === 'gif' && project.speed !== 1 ? (
        <Text style={[...type.small, { color: c.inkSecondary }]}>{t('live.editor.gifSpeedNote')}</Text>
      ) : null}

      <PillButton
        label={inPlaylist ? t('live.editor.inPlaylist') : t('live.editor.addToPlaylist')}
        variant="tinted"
        block
        icon={inPlaylist ? 'check' : 'plus'}
        accessibilityLabel={inPlaylist ? t('live.editor.inPlaylistA11y') : t('live.editor.addToPlaylist')}
        onPress={() => void togglePlaylist()}
      />
      <PillButton
        label={t('live.editor.setOnLock')}
        icon="smartphone"
        block
        disabled={live.state === 'preparing'}
        onPress={() => {
          haptic('select');
          upsertProject(latest.current).catch(() => {});
          dirty.current = false;
          void setOnLockScreen([latest.current], (reason) => setUnavailable({ visible: true, reason }));
        }}
      />
      <LivelockRunningCard state={live} />

      {/* T11: Live Photo export (all iOS versions; the stopgap before iOS 26). */}
      <SaveAsLivePhotoButton getProject={() => latest.current} />

      {/* T30: what Expo Go (and every build) can save: a still-frame wallpaper and the clip. */}
      <LiveSaveToPhotos getProject={() => latest.current} getPlayer={() => playerRef.current} />
      <LiveStepsCard kind={project.kind} />

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

      <LiveUnavailableSheet
        visible={unavailable.visible}
        reason={unavailable.reason}
        onClose={() => setUnavailable((u) => ({ ...u, visible: false }))}
      />
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
      : withSpring(on ? 1 : 0, springConfig);
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
        <Text style={[...type.small, noMirrorText, { color: c.inkSecondary }]}>{secs(trim.startMs)}</Text>
        <Text style={[...type.label, styles.trimMid, { color: c.ink }]}>
          {t('live.editor.loopLength', {
            duration: `\u2066${secs(loopDurationMs(trim, speed))}\u2069`,
            max: `\u2066${secs(maxTrimMs(speed) / speed)}\u2069`,
          })}
        </Text>
        <Text style={[...type.small, noMirrorText, { color: c.inkSecondary }]}>{secs(trim.endMs)}</Text>
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
  content: { padding: spaceV2.lg, gap: spaceV2.md, paddingBottom: spaceV2.xxl },
  name: { minHeight: sizeV2.rowMin, borderRadius: radiusV2.control, paddingHorizontal: spaceV2.lg },
  frame: { alignSelf: 'center' },
  media: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm },
  centerText: { textAlign: 'center' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceV2.sm,
    borderWidth: 1,
    borderRadius: radiusV2.control,
    padding: spaceV2.md,
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
  trackBg: { position: 'absolute', height: 6, borderRadius: 3 },
  trackSel: { position: 'absolute', height: 6, borderRadius: 3 },
  handle: { position: 'absolute', top: spaceV2.xs, width: HANDLE, height: sizeV2.touch, justifyContent: 'center' },
  knob: { width: 20, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  trimLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spaceV2.sm,
    marginTop: spaceV2.xs,
  },
});
