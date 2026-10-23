// Trace screen (PLAN §3 /trace): back camera full screen with the overlay image on top.
// Every tracing control here is free; nothing on this screen may import src/plus.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { applyGesture, identity, pan, pinch, rotate, toStyle, type Transform } from '../src/core/transform';
import {
  baseSize,
  cameraAutofocus,
  initialTraceState,
  parseDim,
  toCentre,
  toastDuration,
  traceReducer,
} from '../src/core/traceState';
import { gridPreset, type GridPresetId } from '../src/core/grid';
import { DEFAULT_SETTINGS, loadSettings } from '../src/native/settings';
import { recordTraceSession } from '../src/native/progress';
import { select, success, tap } from '../src/native/haptics';
import { duration, easeOut, fadeTo, opacityDetents, useReduceMotion } from '../src/theme/motion';
import { light, radius, space, touch } from '../src/theme/tokens';
import { cameraGlass } from '../src/ui/v2/CameraGlass';
import { Captioned } from '../src/ui/v2/CameraCaption';
import { CameraButton } from '../src/ui/v2/CameraButton';
import { CameraPill, CameraPillText } from '../src/ui/v2/CameraPill';
import { GridOverlay } from '../src/ui/GridOverlay';
import { Toast } from '../src/ui/Toast';
import { VerticalSlider } from '../src/ui/VerticalSlider';
import { TemplateSvg } from '../src/ui/TemplateSvg';
import { DEFAULT_STROKE_WIDTH, getTemplate, type Template } from '../src/core/templates';
import { RecordButton, RecordingPill, TimelapseSheet } from '../src/ui/Timelapse';
import { useTimelapse } from '../src/ui/useTimelapse';
import { CompareView } from '../src/ui/CompareView';
import { saveDrawing } from '../src/native/drawings';
import { SketchStepsBar } from '../src/ui/SketchStepsBar';
import { usePaperCheck } from '../src/ui/usePaperCheck';
import { useSketchSteps } from '../src/ui/useSketchSteps';
import { TouchLockCatcher, TouchLockIntroSheet } from '../src/ui/TouchLock';
import { LockButton } from '../src/ui/LockButton';
import { useFocusMode } from '../src/ui/useFocusMode';
import { t as tNow, useT, type I18n } from '../src/i18n';
import { backChevron } from '../src/i18n/direction';
import { useTypography } from '../src/theme/typography';

// v2: the hint now mentions Lock and Touch lock, so people who saw the v1 hint get it once more.
const HINT_KEY = 'linework.traceHint.v2';
// Set once the touch-lock explanation sheet has been accepted (Start); after that the button locks straight away.
const TOUCH_LOCK_INTRO_KEY = 'linework.touchLockIntro.v1';
// F4 (owner 17 Oct): template line thickness, remembered between sessions.
type LineWeight = 'thick' | 'medium' | 'thin';
const LINE_WEIGHTS: LineWeight[] = ['thick', 'medium', 'thin'];
const LINE_WEIGHT_KEY = 'linework.templateLineWeight';
const LINE_SCALE: Record<LineWeight, number> = { thick: 1, medium: 0.6, thin: 0.35 };
function templateStroke(tpl: Template, w: LineWeight): number {
  return (tpl.strokeWidth ?? DEFAULT_STROKE_WIDTH) * LINE_SCALE[w];
}
const FALLBACK_SIZE = 1000;
// L5: if the camera never reports ready, lift the graphite cover anyway after this long.
const CAMERA_REVEAL_FALLBACK_MS = 900;
// L3: lock frame flash, opacity 0 → 0.9 → 0 over duration.fast + duration.base (≈ 320 ms).
const FLASH_PEAK = 0.9;
const FLASH_BORDER = 2;

// Screen-reader alternatives to pinch / rotate / drag on the overlay.
const NUDGE_SCALE = 1.1;
const NUDGE_ROTATE = (15 * Math.PI) / 180;
const NUDGE_PAN = 20;
// Move left/right are physical (the image is never mirrored in right-to-left layouts).
function overlayActions(t: I18n['t']) {
  return [
    { name: 'bigger', label: t('trace.action.bigger') },
    { name: 'smaller', label: t('trace.action.smaller') },
    { name: 'rotateLeft', label: t('trace.action.rotateLeft') },
    { name: 'rotateRight', label: t('trace.action.rotateRight') },
    { name: 'moveUp', label: t('trace.action.moveUp') },
    { name: 'moveDown', label: t('trace.action.moveDown') },
    { name: 'moveLeft', label: t('trace.action.moveLeft') },
    { name: 'moveRight', label: t('trace.action.moveRight') },
  ];
}

/** Spoken grid state, e.g. "Grid off", "Grid 3×3". */
function gridName(t: I18n['t'], id: GridPresetId): string {
  const p = gridPreset(id);
  return p.id === 'off' ? t('trace.grid.off') : t('trace.grid.size', { cols: p.cols, rows: p.rows });
}

/** Caption under the grid button: "Grid" when off, else the preset ("3×3"). */
function gridCaptionText(t: I18n['t'], id: GridPresetId): string {
  const p = gridPreset(id);
  return p.id === 'off' ? t('trace.grid.caption') : t('trace.grid.captionSize', { cols: p.cols, rows: p.rows });
}

function nudge(t: Transform, action: string): Transform {
  switch (action) {
    case 'bigger':
      return pinch(t, NUDGE_SCALE, 0, 0);
    case 'smaller':
      return pinch(t, 1 / NUDGE_SCALE, 0, 0);
    case 'rotateLeft':
      return rotate(t, -NUDGE_ROTATE);
    case 'rotateRight':
      return rotate(t, NUDGE_ROTATE);
    case 'moveUp':
      return pan(t, 0, -NUDGE_PAN);
    case 'moveDown':
      return pan(t, 0, NUDGE_PAN);
    case 'moveLeft':
      return pan(t, -NUDGE_PAN, 0);
    case 'moveRight':
      return pan(t, NUDGE_PAN, 0);
    default:
      return t;
  }
}

type Size = { width: number; height: number };

export default function TraceScreen() {
  useKeepAwakeSetting();
  const { t } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; w?: string; h?: string; template?: string }>();
  const template = getTemplate(typeof params.template === 'string' ? params.template : undefined);
  // Templates are drawn as vector line art; `uri` is a stable key for them.
  const uri =
    typeof params.uri === 'string' && params.uri.length > 0 ? params.uri : template ? `template:${template.id}` : undefined;
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // T59: the hook only reads the status on mount, so coming back from Settings (camera switched on there) would
  // still show "Camera is off". Re-read it whenever the app becomes active again while access is missing.
  const permissionGranted = permission?.granted === true;
  useEffect(() => {
    if (permissionGranted) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') getPermission().catch(() => {});
    });
    return () => sub.remove();
  }, [permissionGranted, getPermission]);

  const goLightbox = useCallback(
    (replace: boolean) => {
      select();
      const target = { pathname: '/lightbox' as const, params: template ? { template: template.id } : uri ? { uri } : {} };
      if (replace) router.replace(target);
      else router.push(target);
    },
    [router, uri, template],
  );

  const goBack = useCallback(() => {
    tap();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  if (!uri) {
    return (
      <Message
        icon="image"
        title={t('trace.noImage.title')}
        body={t('trace.noImage.body')}
        actions={[{ label: t('trace.goBack'), onPress: goBack }]}
      />
    );
  }

  if (!permission) {
    // Permission status still loading.
    return <View style={{ flex: 1, backgroundColor: '#000' }} accessible accessibilityLabel={t('trace.camera.loading')} />;
  }

  if (!permission.granted) {
    if (permission.canAskAgain) {
      return (
        <Message
          icon="camera"
          title={t('trace.camera.askTitle')}
          body={t('trace.camera.askBody')}
          actions={[
            {
              label: t('trace.camera.allow'),
              primary: true,
              onPress: () => {
                tap();
                requestPermission().catch(() => {});
              },
            },
            { label: t('trace.camera.useLightbox'), onPress: () => goLightbox(true) },
            { label: t('trace.goBack'), onPress: goBack },
          ]}
        />
      );
    }
    return (
      <Message
        icon="camera-off"
        title={t('trace.camera.offTitle')}
        body={t('trace.camera.offBody')}
        actions={[
          {
            label: t('common.openSettings'),
            primary: true,
            onPress: () => {
              tap();
              Linking.openSettings().catch(() => {});
            },
          },
          { label: t('trace.camera.useLightbox'), onPress: () => goLightbox(true) },
          { label: t('trace.goBack'), onPress: goBack },
        ]}
      />
    );
  }

  return (
    <TraceCamera
      uri={uri}
      template={template}
      natW={template ? 400 : parseDim(params.w)}
      natH={template ? 400 : parseDim(params.h)}
      onBack={goBack}
      onLightbox={() => goLightbox(false)}
    />
  );
}

function TraceCamera({
  uri,
  template,
  natW,
  natH,
  onBack,
  onLightbox,
}: {
  uri: string;
  template?: Template;
  natW?: number;
  natH?: number;
  onBack: () => void;
  onLightbox: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // Full-width rows use the larger side inset on both logical edges (start/end), so they fit either direction.
  const side = Math.max(insets.left, insets.right);
  const [state, dispatch] = useReducer(traceReducer, initialTraceState());
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [natural, setNatural] = useState<Size | null>(natW && natH ? { width: natW, height: natH } : null);
  const [xf, setXf] = useState<Transform>(identity);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  // Unmount the camera (and torch) while another screen such as Lightbox is on top.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      // T69: one trace session = focus → blur/unmount, counted on Home (short peeks are ignored by the core).
      const startedAt = Date.now();
      return () => {
        setFocused(false);
        recordTraceSession(startedAt, Date.now()).catch(() => {});
      };
    }, []),
  );

  // T64: hold camera focus while locked (Settings → Keep focus while locked).
  const [focusLock, setFocusLock] = useState(DEFAULT_SETTINGS.focusLock);

  // Settings: default opacity and grid (T08 adds the screen).
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      if (!alive) return;
      dispatch({ type: 'setOpacity', value: s.defaultOpacity });
      dispatch({ type: 'setGrid', value: s.gridDefault });
      setFocusLock(s.focusLock);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Natural size from params, else ask the image, else a square.
  useEffect(() => {
    if (natW && natH) {
      setNatural({ width: natW, height: natH });
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (alive) setNatural({ width, height });
      },
      () => {
        if (alive) setNatural({ width: FALLBACK_SIZE, height: FALLBACK_SIZE });
      },
    );
    return () => {
      alive = false;
    };
  }, [uri, natW, natH]);

  // First-use hint, once.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(HINT_KEY)
      .then((seen) => {
        if (!alive || seen) return;
        setToast({ text: tNow('trace.hint'), id: Date.now() });
        return AsyncStorage.setItem(HINT_KEY, '1');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // F4: template line thickness (thick → medium → thin), loaded from and saved to AsyncStorage.
  const [lineWeight, setLineWeight] = useState<LineWeight>('thick');
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LINE_WEIGHT_KEY)
      .then((v) => {
        if (alive && v && (LINE_WEIGHTS as string[]).includes(v)) setLineWeight(v as LineWeight);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const cycleLineWeight = () => {
    select();
    const next = LINE_WEIGHTS[(LINE_WEIGHTS.indexOf(lineWeight) + 1) % LINE_WEIGHTS.length];
    setLineWeight(next);
    AsyncStorage.setItem(LINE_WEIGHT_KEY, next).catch(() => {});
  };

  // Touch-lock explanation: shown before the first touch lock, remembered once accepted.
  const [introOpen, setIntroOpen] = useState(false);
  const introSeen = useRef(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TOUCH_LOCK_INTRO_KEY)
      .then((v) => {
        if (alive && v) introSeen.current = true;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const showToast = useCallback((text: string) => setToast({ text, id: Date.now() }), []);
  // T09 timelapse: CameraView switches to video mode only while recording (rec.mode), so snapshots work otherwise.
  const rec = useTimelapse(showToast);
  // T10: photo-to-paper check + sketch steps (logic lives in src/ui/usePaperCheck, useSketchSteps). Shares the camera ref.
  const cameraRef = rec.cameraRef;
  const paperCheck = usePaperCheck(cameraRef, showToast);
  const steps = useSketchSteps(uri, template);

  // L1 focus mode: the control clusters fade out after a few seconds without a touch and come back on the
  // first tap (that tap never presses a control: hidden clusters ignore touches). Never while the opacity
  // slider is held, behind the touch-lock intro, the compare view or another screen, or with a screen reader on.
  const [sliding, setSliding] = useState(false);
  const focus = useFocusMode({ wanted: focused && !introOpen && !paperCheck.photo, holding: sliding });
  const onSlideStart = useCallback(() => {
    select();
    setSliding(true);
  }, []);
  const onSlideEnd = useCallback(() => setSliding(false), []);

  // L5: arriving from Prepare, the overlay fades in over graphite and the camera fades in once it is ready.
  const reduce = useReduceMotion();
  const overlayIn = useRef(new Animated.Value(0)).current;
  const cameraCover = useRef(new Animated.Value(1)).current;
  const coverLifted = useRef(false);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const liftCover = useCallback(() => {
    if (coverLifted.current) return;
    coverLifted.current = true;
    fadeTo(cameraCover, 0, reduceRef.current, duration.slow).start();
  }, [cameraCover]);
  useEffect(() => {
    fadeTo(overlayIn, 1, reduceRef.current, duration.slow).start();
    const t = setTimeout(liftCover, CAMERA_REVEAL_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [overlayIn, liftCover]);
  const recCameraReady = rec.onCameraReady;
  const onCameraReady = useCallback(() => {
    recCameraReady();
    liftCover();
  }, [recCameraReady, liftCover]);
  // Leaving mid-recording would unmount the camera before the clip is finalised: stop first and stay here
  // so the user can save or discard the clip, then leave.
  const guardRecording = useCallback(
    (leave: () => void) => () => {
      if (rec.recording) {
        rec.toggle();
        showToast(tNow('trace.recordingGuard'));
        return;
      }
      leave();
    },
    [rec, showToast],
  );

  // ---- Gestures (JS thread, no reanimated). Each gesture reports cumulative values since its own start;
  // we re-base the start snapshot whenever any gesture starts or ends so they combine cleanly.
  const xfRef = useRef(xf);
  xfRef.current = xf;
  const viewRef = useRef(view);
  viewRef.current = view;
  const g = useRef({
    start: identity(),
    pan: { on: false, x: 0, y: 0, ox: 0, oy: 0 },
    pinch: { on: false, scale: 1, os: 1, fx: 0, fy: 0 },
    rot: { on: false, r: 0, or: 0, ax: 0, ay: 0 },
    focal: { x: 0, y: 0, has: false },
  });

  const rebase = useCallback(() => {
    const s = g.current;
    s.start = xfRef.current;
    s.pan.ox = s.pan.x;
    s.pan.oy = s.pan.y;
    s.pinch.os = s.pinch.scale;
    s.rot.or = s.rot.r;
    // Scale/rotate about the current finger centre (view-centre coordinates).
    const v = viewRef.current;
    if (s.pinch.on) {
      const c = toCentre(s.pinch.fx, s.pinch.fy, v.width, v.height);
      s.focal = { x: c.x, y: c.y, has: true };
    } else if (s.rot.on) {
      const c = toCentre(s.rot.ax, s.rot.ay, v.width, v.height);
      s.focal = { x: c.x, y: c.y, has: true };
    } else {
      s.focal = { x: 0, y: 0, has: false };
    }
  }, []);

  // Gesture-handler cancels the JS touch stream once a pan/pinch/rotate activates, so the root's onTouchMove
  // stops firing mid-drag: keep focus mode awake from the gesture itself.
  const focusNudge = focus.nudge;
  const update = useCallback(() => {
    focusNudge();
    const s = g.current;
    const next = applyGesture(s.start, {
      dx: s.pan.x - s.pan.ox,
      dy: s.pan.y - s.pan.oy,
      scale: s.pinch.os > 0 ? s.pinch.scale / s.pinch.os : 1,
      rotation: s.rot.r - s.rot.or,
      focalX: s.focal.has ? s.focal.x : undefined,
      focalY: s.focal.has ? s.focal.y : undefined,
    });
    xfRef.current = next;
    setXf(next);
  }, [focusNudge]);

  const locked = state.locked;
  const gesture = useMemo(() => {
    const s = g.current;
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!locked)
      .onStart(() => {
        s.pan = { on: true, x: 0, y: 0, ox: 0, oy: 0 };
        rebase();
      })
      .onUpdate((e) => {
        s.pan.x = e.translationX;
        s.pan.y = e.translationY;
        update();
      })
      .onFinalize(() => {
        if (!s.pan.on) return;
        s.pan.on = false;
        rebase();
      });
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .enabled(!locked)
      .onStart((e) => {
        s.pinch = { on: true, scale: 1, os: 1, fx: e.focalX, fy: e.focalY };
        rebase();
      })
      .onUpdate((e) => {
        s.pinch.scale = e.scale;
        update();
      })
      .onFinalize(() => {
        if (!s.pinch.on) return;
        s.pinch.on = false;
        rebase();
      });
    const rotation = Gesture.Rotation()
      .runOnJS(true)
      .enabled(!locked)
      .onStart((e) => {
        s.rot = { on: true, r: 0, or: 0, ax: e.anchorX, ay: e.anchorY };
        rebase();
      })
      .onUpdate((e) => {
        s.rot.r = e.rotation;
        update();
      })
      .onFinalize(() => {
        if (!s.rot.on) return;
        s.rot.on = false;
        rebase();
      });
    return Gesture.Simultaneous(pan, pinch, rotation);
  }, [locked, rebase, update]);

  // ---- Controls
  // L3: locking gives a success haptic and a brief frame flash around the overlay; unlocking a light tap.
  const flash = useRef(new Animated.Value(0)).current;
  const toggleLock = () => {
    const locking = !state.locked;
    if (locking) {
      success();
      flash.stopAnimation();
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash, { toValue: FLASH_PEAK, duration: duration.fast, easing: easeOut, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: duration.base, easing: easeOut, useNativeDriver: true }),
      ]).start();
    } else {
      tap();
    }
    showToast(t(locking ? 'trace.lock.lockedToast' : 'trace.lock.unlockedToast'));
    dispatch({ type: 'toggleLock' });
  };
  const toggleTorch = () => {
    select();
    dispatch({ type: 'toggleTorch' });
  };
  const cycleGrid = () => {
    select();
    const next = traceReducer(state, { type: 'cycleGrid' }).gridPreset;
    dispatch({ type: 'setGrid', value: next });
    showToast(gridName(t, next));
  };
  const toggleMirror = () => {
    if (state.locked) {
      showToast(t('trace.mirror.lockedToast'));
      return;
    }
    select();
    dispatch({ type: 'toggleMirror' });
  };
  const startTouchLock = useCallback(() => {
    select();
    setIntroOpen(false);
    setToast(null);
    dispatch({ type: 'setTouchLock', value: true });
    AccessibilityInfo.announceForAccessibility(tNow('trace.touchLock.banner'));
  }, []);
  const touchLock = () => {
    if (introSeen.current) {
      startTouchLock();
      return;
    }
    tap();
    setIntroOpen(true);
  };
  const acceptIntro = useCallback(() => {
    introSeen.current = true;
    AsyncStorage.setItem(TOUCH_LOCK_INTRO_KEY, '1').catch(() => {});
    startTouchLock();
  }, [startTouchLock]);
  const cancelIntro = useCallback(() => {
    tap();
    setIntroOpen(false);
  }, []);
  const unlockTouch = useCallback(() => {
    tap();
    dispatch({ type: 'setTouchLock', value: false });
    showToast(tNow('trace.touchLock.off'));
  }, [showToast]);
  const resetFit = () => {
    tap();
    const id = identity();
    xfRef.current = id;
    setXf(id);
    dispatch({ type: 'reset' });
  };

  // Accessibility actions on the overlay: the same moves as the gestures, in small steps.
  const onOverlayAction = (e: { nativeEvent: { actionName: string } }) => {
    if (state.locked) {
      AccessibilityInfo.announceForAccessibility(t('trace.overlay.lockedAnnounce'));
      return;
    }
    const next = nudge(xfRef.current, e.nativeEvent.actionName);
    if (next === xfRef.current) return;
    xfRef.current = next;
    setXf(next);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== view.width || height !== view.height) setView({ width, height });
  };

  const base = natural ? baseSize(natural.width, natural.height, view.width, view.height) : null;
  const shown: Transform = { ...xf, mirror: state.mirror, locked: state.locked };

  // T67: "Save to My drawings" from the paper check. The snapshot and the traced photo are copied into the
  // documents folder (src/native/drawings.ts); templates are kept by id.
  const saveToDrawings = useCallback(async () => {
    const photo = paperCheck.photo;
    if (!photo) throw new Error('no snapshot');
    await saveDrawing({
      photoUri: photo.uri,
      photoWidth: photo.width,
      photoHeight: photo.height,
      templateId: template?.id,
      sourceUri: template ? undefined : uri,
      fit:
        base && base.width > 0 && view.width > 0 && view.height > 0
          ? {
              view: { width: view.width, height: view.height },
              base,
              x: shown.x,
              y: shown.y,
              scale: shown.scale,
              rotation: shown.rotation,
              mirror: shown.mirror,
            }
          : undefined,
    });
  }, [paperCheck.photo, template, uri, base, view.width, view.height, shown.x, shown.y, shown.scale, shown.rotation, shown.mirror]);
  const touchLocked = state.touchLocked;
  // While touch-locked the buttons fade (they ignore taps) but the camera and overlay stay at full strength.
  const controlsOpacity = touchLocked ? 0.35 : 1;
  // Focus-mode fade on top of the touch-lock dimming (native-driven).
  const clusterOpacity = useMemo(() => Animated.multiply(focus.opacity, controlsOpacity), [focus.opacity, controlsOpacity]);
  const clusterPointer = focus.hidden ? 'none' : 'box-none';
  const frameScale = Math.max(0.1, Math.abs(shown.scale) || 1);
  const topRowTop = insets.top + space.sm;
  const actions = overlayActions(t);
  const overlayHint = state.locked ? undefined : t('trace.overlay.hint');

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000' }}
      // Any touch anywhere resets the focus-mode idle timer and wakes hidden controls; never claims the touch.
      onTouchStart={focus.wake}
      onTouchMove={focus.nudge}
      onTouchEnd={focus.wake}
      onTouchCancel={focus.wake}
      onStartShouldSetResponderCapture={() => {
        focus.wake();
        return false;
      }}
      onLayout={onLayout}>
      {focused ? (
        // Keep the camera a direct, stable child of the root. Never wrap it in a view whose props change with
        // touch lock: that native wrapper gets re-created and the preview with it (the black screen, T25).
        <CameraView
          ref={rec.cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={state.torch}
          autofocus={cameraAutofocus(state.locked, focusLock)}
          mode={rec.mode}
          mute
          onCameraReady={onCameraReady}
        />
      ) : null}
      {/* L5: graphite cover that fades away to reveal the camera. Never takes touches or focus. */}
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { backgroundColor: light.graphite, opacity: cameraCover }]}
      />
      {/* No iOS edge-swipe back while touch-locked: a resting hand must not leave the screen. */}
      <Stack.Screen options={{ gestureEnabled: !touchLocked }} />
      <StatusBar style="light" />
      <View
        style={StyleSheet.absoluteFill}
        collapsable={false}
        pointerEvents="box-none"
        importantForAccessibility={touchLocked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={touchLocked}
      >
        {/* Overlay image + gesture surface + grid. Always laid out left-to-right: the traced image, its transform
            and the grid are never mirrored in right-to-left languages (pan gestures stay physical too). The camera
            above is a full-bleed native preview, so layout direction cannot mirror it, and it stays a direct child
            of the root (T25). */}
        <View style={[StyleSheet.absoluteFill, styles.ltr]} pointerEvents="box-none" collapsable={false}>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayIn }]} collapsable={false}>
              {base && base.width > 0 && template ? (
                <View
                  accessible
                  accessibilityLabel={t(state.locked ? 'trace.overlay.templateLocked' : 'trace.overlay.template', {
                    name: template.name,
                  })}
                  accessibilityHint={overlayHint}
                  accessibilityActions={actions}
                  onAccessibilityAction={onOverlayAction}
                  style={{
                    position: 'absolute',
                    left: (view.width - base.width) / 2, // rtl-physical-ok (inside a never-mirrored LTR layer)
                    top: (view.height - base.height) / 2,
                    width: base.width,
                    height: base.height,
                    opacity: state.opacity,
                    transform: toStyle(shown),
                  }}
                >
                  <TemplateSvg
                    template={steps.template ?? template}
                    size={base.width}
                    color="#22201C"
                    strokeWidth={templateStroke(steps.template ?? template, lineWeight)}
                  />
                </View>
              ) : base && base.width > 0 ? (
                <Image
                  source={{ uri: steps.uri ?? uri }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                  accessible
                  accessibilityLabel={t(state.locked ? 'trace.overlay.imageLocked' : 'trace.overlay.image')}
                  accessibilityHint={overlayHint}
                  accessibilityActions={actions}
                  onAccessibilityAction={onOverlayAction}
                  style={{
                    position: 'absolute',
                    left: (view.width - base.width) / 2, // rtl-physical-ok (inside a never-mirrored LTR layer)
                    top: (view.height - base.height) / 2,
                    width: base.width,
                    height: base.height,
                    opacity: state.opacity,
                    transform: toStyle(shown),
                  }}
                />
              ) : null}
              {/* L3: brief frame flash around the overlay bounds when the position locks. */}
              {base && base.width > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: 'absolute',
                    left: (view.width - base.width) / 2, // rtl-physical-ok (inside a never-mirrored LTR layer)
                    top: (view.height - base.height) / 2,
                    width: base.width,
                    height: base.height,
                    borderWidth: FLASH_BORDER / frameScale,
                    borderColor: '#FFFFFF',
                    opacity: flash,
                    transform: toStyle(shown),
                  }}
                />
              ) : null}
            </Animated.View>
          </GestureDetector>

          <GridOverlay preset={state.gridPreset} width={view.width} height={view.height} />
        </View>

        {/* Top row: back, lock badge, lightbox */}
        <Animated.View
          pointerEvents={clusterPointer}
          collapsable={false}
          style={{
            position: 'absolute',
            top: topRowTop,
            start: side + space.md,
            end: side + space.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            opacity: clusterOpacity,
          }}
        >
          <CameraButton
            icon={backChevron()}
            label={t('common.back')}
            caption={t('common.back')}
            size={touch}
            onPress={guardRecording(onBack)}
          />
          {state.locked ? (
            <CameraPill
              accessible
              accessibilityRole="text"
              accessibilityLabel={t('trace.lock.badgeLabel')}
              leading={<Feather name="lock" size={14} color={cameraGlass.icon} />}
              style={{ marginTop: space.xs }}
            >
              <CameraPillText>{t('trace.lock.badge')}</CameraPillText>
            </CameraPill>
          ) : (
            <View />
          )}
          <CameraButton
            icon="sun"
            label={t('trace.lightbox.label')}
            caption={t('trace.lightbox.caption')}
            size={touch}
            accessibilityHint={t('trace.lightbox.hint')}
            onPress={guardRecording(onLightbox)}
          />
        </Animated.View>

        {/* Trailing edge: opacity */}
        <Animated.View
          pointerEvents={clusterPointer}
          collapsable={false}
          style={{
            position: 'absolute',
            end: side + space.lg,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            opacity: clusterOpacity,
          }}
        >
          <VerticalSlider
            value={state.opacity}
            onChange={(value) => dispatch({ type: 'setOpacity', value })}
            onSlideStart={onSlideStart}
            onSlideEnd={onSlideEnd}
            showBubble
            detents={opacityDetents}
            min={0.05}
            max={1}
            accessibilityLabel={t('trace.opacity.label')}
            accessibilityHint={t('trace.opacity.hint')}
          />
        </Animated.View>

        {/* Bottom: toast + controls */}
        <View
          pointerEvents="box-none"
          collapsable={false}
          style={{
            position: 'absolute',
            start: side + space.md,
            end: side + space.md,
            bottom: insets.bottom + space.md,
            alignItems: 'center',
          }}
        >
          <Toast
            message={toast?.text ?? null}
            showId={toast?.id}
            duration={toastDuration(toast?.text ?? '')}
            onHide={() => setToast(null)}
            style={{ marginBottom: space.md }}
          />
          <Animated.View
            pointerEvents={clusterPointer}
            collapsable={false}
            style={{ alignItems: 'center', alignSelf: 'stretch', opacity: clusterOpacity }}
          >
            {steps.active ? <SketchStepsBar steps={steps} /> : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                columnGap: space.xs,
                rowGap: space.sm,
              }}
            >
              <LockButton locked={state.locked} size={touch} onPress={toggleLock} />
              <CameraButton
                icon="smartphone"
                label={t('trace.touchLock.title')}
                caption={t('trace.touchLock.title')}
                accessibilityHint={t('trace.touchLock.hint')}
                size={touch}
                onPress={touchLock}
              />
              <CameraButton
                icon="grid"
                label={t('trace.grid.button', { grid: gridName(t, state.gridPreset) })}
                caption={gridCaptionText(t, state.gridPreset)}
                active={state.gridPreset !== 'off'}
                size={touch}
                onPress={cycleGrid}
              />
              {template ? (
                <CameraButton
                  icon="edit-2"
                  label={t('trace.lines.label', { weight: t(`trace.lines.${lineWeight}`) })}
                  caption={t(`trace.lines.${lineWeight}`)}
                  accessibilityHint={t('trace.lines.hint')}
                  active={lineWeight !== 'thick'}
                  size={touch}
                  onPress={cycleLineWeight}
                />
              ) : null}
              <CameraButton
                icon="columns"
                label={t('trace.mirror.label')}
                caption={t('trace.mirror.caption')}
                accessibilityHint={t('trace.mirror.hint')}
                active={state.mirror}
                size={touch}
                onPress={toggleMirror}
              />
              <CameraButton
                icon={state.torch ? 'zap' : 'zap-off'}
                label={t(state.torch ? 'trace.torch.off' : 'trace.torch.on')}
                caption={t('trace.torch.caption')}
                active={state.torch}
                size={touch}
                onPress={toggleTorch}
              />
              <CameraButton
                icon="maximize"
                label={t('trace.reset.label')}
                caption={t('trace.reset.caption')}
                accessibilityHint={t('trace.reset.hint')}
                size={touch}
                onPress={resetFit}
              />
              {steps.available ? (
                <CameraButton
                  icon="trending-up"
                  label={t(steps.active ? 'trace.steps.turnOff' : 'trace.steps.label')}
                  caption={t('trace.steps.caption')}
                  accessibilityHint={t('trace.steps.hint')}
                  active={steps.active}
                  size={touch}
                  onPress={steps.active ? steps.stop : steps.start}
                />
              ) : null}
              <CameraButton
                icon="aperture"
                label={t('trace.check.label')}
                caption={t('trace.check.caption')}
                accessibilityHint={t('trace.check.hint')}
                disabled={paperCheck.busy || rec.recording}
                size={touch}
                onPress={paperCheck.take}
              />
              <Captioned caption={t(rec.recording ? 'trace.record.captionStop' : 'trace.record.caption')}>
                <RecordButton rec={rec} />
              </Captioned>
            </View>
          </Animated.View>
        </View>

        {/* Timelapse: elapsed pill + post-recording sheet (the overlay above is never in the video). */}
        <RecordingPill rec={rec} top={topRowTop + touch + space.lg + space.sm} />
        <TimelapseSheet
          rec={rec}
          start={side + space.md}
          end={side + space.md}
          bottom={insets.bottom + space.md}
        />
      </View>

      {introOpen ? (
        <TouchLockIntroSheet
          onStart={acceptIntro}
          onCancel={cancelIntro}
          start={side + space.md}
          end={side + space.md}
          bottom={insets.bottom + space.md}
        />
      ) : null}

      {/* Touch-lock catcher: transparent, swallows every touch; press and hold 1 s anywhere to exit. */}
      {touchLocked ? (
        <TouchLockCatcher
          onUnlock={unlockTouch}
          top={topRowTop}
          start={side + space.md}
          end={side + space.md}
        />
      ) : null}

      {paperCheck.photo ? (
        <CompareView
          photo={paperCheck.photo}
          view={view}
          base={base}
          transform={shown}
          template={steps.template ?? template}
          overlayUri={steps.uri ?? uri}
          onClose={paperCheck.close}
          onSave={saveToDrawings}
          timelapsePhase={rec.state.phase}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ltr: { direction: 'ltr' },
});

type MessageAction = { label: string; onPress: () => void; primary?: boolean };

// Dark full-screen explanation card (no image, permission states).
function Message({
  icon,
  title,
  body,
  actions,
}: {
  icon: 'image' | 'camera' | 'camera-off';
  title: string;
  body: string;
  actions: MessageAction[];
}) {
  const ty = useTypography();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#14130F',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: space.xl,
      }}
    >
      <StatusBar style="light" />
      <View style={{ alignItems: 'center' }}>
        <Feather
          name={icon}
          size={36}
          color="#EEE8DE"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text
          accessibilityRole="header"
          style={{ ...ty.face('display'), fontSize: 26, color: '#EEE8DE', marginTop: space.lg, textAlign: 'center' }}
        >
          {title}
        </Text>
        <Text
          style={{
            ...ty.face('body'),
            fontSize: 16,
            lineHeight: ty.lhOf(23),
            color: '#A39B8F',
            marginTop: space.sm,
            textAlign: 'center',
            maxWidth: 420,
          }}
        >
          {body}
        </Text>
      </View>
      <View style={{ marginTop: space.xl, alignSelf: 'stretch', alignItems: 'center' }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => ({
              minHeight: touch + 8,
              width: '100%',
              maxWidth: 420,
              marginTop: space.sm,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.lg,
              backgroundColor: a.primary ? cameraGlass.primary : cameraGlass.secondary,
              borderWidth: a.primary ? 0 : 1,
              borderColor: cameraGlass.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ ...ty.face('bodyBold'), fontSize: 17, color: a.primary ? cameraGlass.onPrimary : cameraGlass.text }}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const KEEP_AWAKE_TAG = 'linework-trace';

/** Keeps the screen on while tracing unless the user turned that off in Settings. */
function useKeepAwakeSetting() {
  useEffect(() => {
    let alive = true;
    let active = false;
    loadSettings()
      .then((st) => {
        if (!alive || !st.keepAwake) return;
        active = true;
        return activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (active) deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, []);
}
