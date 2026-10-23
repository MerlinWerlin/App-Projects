// Lightbox (PLAN §2 point 5, §3 /lightbox): the image full-bright on a white screen. Lay thin paper over the
// phone or tablet and trace directly. No camera. Lock stops the image moving and fades the other controls.
// Exit is always shown at full strength (top start); Android Back and the iOS edge swipe also leave.
// T76 (DESIGN_V2 §7): the white image area is unchanged and stays full-bright; only the controls moved onto v2
// glass: Exit in its own GlassBar pill, Reset + Lock together in a second one (blur material, soft e2 shadow).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyGesture, identity, toStyle, type Transform } from '../src/core/transform';
import { baseSize, toCentre, toastDuration } from '../src/core/traceState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STROKE_WIDTH, getTemplate } from '../src/core/templates';
import { select, tap } from '../src/native/haptics';
import { space } from '../src/theme/tokens';
import { maxFontScaleV2, radiusV2, shadowV2, sizeV2, spaceV2 } from '../src/theme/tokensV2';
import { pressScaleV2 } from '../src/theme/motion';
import { useThemeV2 } from '../src/theme/useTheme';
import { PressableScale } from '../src/ui/PressableScale';
import { GlassBar } from '../src/ui/v2';
import { squircle, type FeatherName } from '../src/ui/v2/shared';
import { TemplateSvg } from '../src/ui/TemplateSvg';
import { Toast } from '../src/ui/Toast';
import { t as tNow, useT } from '../src/i18n';
import { backChevron } from '../src/i18n/direction';
import { useTypography } from '../src/theme/typography';

type Size = { width: number; height: number };

// F4: same template line thickness as Trace (set there with the Lines button; key and scale match app/trace.tsx).
const LINE_WEIGHT_KEY = 'linework.templateLineWeight';
const LINE_SCALE: Record<string, number> = { thick: 1, medium: 0.6, thin: 0.35 };

export default function LightboxScreen() {
  const ty = useTypography();
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // Full-width rows use the larger side inset on both logical edges (start/end).
  const side = Math.max(insets.left, insets.right);
  const params = useLocalSearchParams<{ uri?: string; template?: string }>();
  const template = getTemplate(typeof params.template === 'string' ? params.template : undefined);
  const uri = typeof params.uri === 'string' && params.uri.length > 0 ? params.uri : undefined;

  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [natural, setNatural] = useState<Size | null>(template ? { width: 400, height: 400 } : null);
  const [xf, setXf] = useState<Transform>(identity);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(() => ({ text: tNow('lightbox.intro'), id: 1 }));

  const [lineScale, setLineScale] = useState(1);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LINE_WEIGHT_KEY)
      .then((v) => {
        if (alive && v && LINE_SCALE[v] !== undefined) setLineScale(LINE_SCALE[v]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (template || !uri) return;
    let alive = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (alive) setNatural({ width, height });
      },
      () => {
        if (alive) setNatural({ width: 1000, height: 1000 });
      },
    );
    return () => {
      alive = false;
    };
  }, [uri, template]);

  // Simple gestures from a start snapshot (JS thread, no reanimated).
  const xfRef = useRef(xf);
  xfRef.current = xf;
  const viewRef = useRef(view);
  viewRef.current = view;
  const start = useRef<Transform>(identity());
  const pinchFocal = useRef({ x: 0, y: 0 });

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!locked)
      .maxPointers(1)
      .onStart(() => {
        start.current = xfRef.current;
      })
      .onUpdate((e) => {
        const next = applyGesture(start.current, { dx: e.translationX, dy: e.translationY });
        xfRef.current = next;
        setXf(next);
      });
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .enabled(!locked)
      .onStart((e) => {
        start.current = xfRef.current;
        const v = viewRef.current;
        pinchFocal.current = toCentre(e.focalX, e.focalY, v.width, v.height);
      })
      .onUpdate((e) => {
        const next = applyGesture(start.current, {
          scale: e.scale,
          focalX: pinchFocal.current.x,
          focalY: pinchFocal.current.y,
        });
        xfRef.current = next;
        setXf(next);
      });
    return Gesture.Race(pinch, pan);
  }, [locked]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== view.width || height !== view.height) setView({ width, height });
  };

  const goBack = useCallback(() => {
    tap();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const toggleLock = () => {
    select();
    setLocked((l) => !l);
    setToast({ text: t(locked ? 'trace.lock.unlockedToast' : 'trace.lock.lockedToast'), id: Date.now() });
  };

  if (!uri && !template) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: '#FFFFFF', padding: space.xl }]}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
          style={{ ...ty.face('display'), fontSize: 24, color: '#22201C', marginBottom: space.md }}
        >
          {t('lightbox.noImage')}
        </Text>
        <GlassPill>
          <GlassControl icon={backChevron()} label={t('lightbox.goBack')} caption={t('common.back')} onPress={goBack} />
        </GlassPill>
      </View>
    );
  }

  const base = natural ? baseSize(natural.width, natural.height, view.width, view.height) : null;
  const style = base
    ? {
        position: 'absolute' as const,
        left: (view.width - base.width) / 2, // rtl-physical-ok (inside a never-mirrored LTR layer)
        top: (view.height - base.height) / 2,
        width: base.width,
        height: base.height,
        transform: toStyle({ ...xf, locked }),
      }
    : null;

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]} onLayout={onLayout}>
      <StatusBar hidden={locked} style="dark" />
      {/* The image is never mirrored in right-to-left languages: its box and transform stay left-to-right. */}
      <GestureDetector gesture={gesture}>
        <View style={[StyleSheet.absoluteFill, styles.ltr]} collapsable={false}>
          {style && base && template ? (
            <View style={style} accessible accessibilityLabel={t('lightbox.template', { name: template.name })}>
              <TemplateSvg
                template={template}
                size={base.width}
                color="#000000"
                strokeWidth={(template.strokeWidth ?? DEFAULT_STROKE_WIDTH) * lineScale}
              />
            </View>
          ) : style && uri ? (
            <Image
              source={{ uri }}
              resizeMode="contain"
              accessible
              accessibilityLabel={t('lightbox.image')}
              accessibilityIgnoresInvertColors
              style={style}
            />
          ) : null}
        </View>
      </GestureDetector>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + space.sm,
          start: side + space.lg,
          end: side + space.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {/* Exit is never faded: it is the obvious way out of the white screen. */}
        <GlassPill>
          <GlassControl
            icon="x"
            label={t('lightbox.exit')}
            caption={t('lightbox.exitCaption')}
            accessibilityHint={t('lightbox.exitHint')}
            onPress={goBack}
          />
        </GlassPill>
        {/* Faded while locked, but still focusable and announced with their state. */}
        <GlassPill style={{ opacity: locked ? 0.6 : 1 }}>
          {!locked ? (
            <GlassControl
              icon="maximize"
              label={t('lightbox.reset')}
              caption={t('lightbox.resetCaption')}
              onPress={() => {
                tap();
                const id = identity();
                xfRef.current = id;
                setXf(id);
              }}
            />
          ) : null}
          <GlassControl
            icon={locked ? 'lock' : 'unlock'}
            label={t(locked ? 'lightbox.unlock' : 'lightbox.lock')}
            caption={t(locked ? 'lightbox.lockedCaption' : 'lightbox.lockCaption')}
            active={locked}
            accessibilityHint={t(locked ? 'lightbox.unlockHint' : 'lightbox.lockHint')}
            onPress={toggleLock}
          />
        </GlassPill>
      </View>

      {toast ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', start: space.lg, end: space.lg, bottom: insets.bottom + space.xl, alignItems: 'center' }}
        >
          <Toast message={toast.text} showId={toast.id} duration={toastDuration(toast.text)} onHide={() => setToast(null)} />
        </View>
      ) : null}
    </View>
  );
}

// A v2 glass pill holding lightbox controls: the soft e2 shadow sits on an outer view because the GlassBar clips
// (overflow hidden) for its blur layer; a hairline keeps the pill visible on the white screen.
function GlassPill({ children, style }: { children: ReactNode; style?: { opacity: number } }) {
  const { c } = useThemeV2();
  return (
    <View collapsable={false} style={[squircle, shadowV2.e2, { borderRadius: radiusV2.pill }, style]}>
      <GlassBar
        edge="none"
        style={[
          squircle,
          {
            borderRadius: radiusV2.pill,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.line,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spaceV2.x1,
            paddingHorizontal: spaceV2.x2,
            paddingVertical: spaceV2.x1 + 2,
          },
        ]}
      >
        {children}
      </GlassBar>
    </View>
  );
}

// One control in a glass pill: a 48 pt round icon target with its caption under it, both one tap target and one
// accessible button (caption hidden from screen readers; the label carries the name). Active = solid ink circle.
// The screen's handlers play their own haptics.
function GlassControl({
  icon,
  label,
  caption,
  onPress,
  active,
  accessibilityHint,
}: {
  icon: FeatherName;
  label: string;
  caption: string;
  onPress: () => void;
  active?: boolean;
  accessibilityHint?: string;
}) {
  const { c, text } = useThemeV2();
  const d = sizeV2.cameraTouch;
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={pressScaleV2}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={active === undefined ? {} : { selected: active }}
      style={{ width: CONTROL_W, alignItems: 'center' }}
    >
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? c.ink : 'transparent',
        }}
      >
        <Feather name={icon} size={22} color={active ? c.onInk : c.graphite} />
      </View>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={Math.min(1.2, maxFontScaleV2)}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[text('caption'), { width: CONTROL_W, textAlign: 'center', color: c.graphite, marginTop: 1 }]}
      >
        {caption}
      </Text>
    </PressableScale>
  );
}

/** Width of a glass control and its caption (fits German / French captions on two lines). */
const CONTROL_W = 64;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ltr: { direction: 'ltr' },

  center: { alignItems: 'center', justifyContent: 'center' },
});

