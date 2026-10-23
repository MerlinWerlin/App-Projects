// Photo-to-paper check: full-screen compare of a snapshot of the paper with the reference ghosted on
// top, using the same size, position, rotation and mirror as on the trace screen. A slider (and three
// presets) fade between "your drawing" and "reference"; side by side shows them stacked.
// The snapshot is a cache file deleted on close (see usePaperCheck); nothing is saved or uploaded.
// T94: every control floats on v2 camera glass (CameraButton, CameraPill, CameraGlassSurface; dark ultra-thin blur
// on iOS, the v1 dark fill elsewhere), the same material as the Trace screen. Shared by Trace and My drawings.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { clampMix, compareLayers, DEFAULT_MIX, MIX_PRESETS, MIX_STEP, toggleCompareMode, type CompareMode } from '../core/compare';
import { toStyle, type Transform } from '../core/transform';
import type { Template } from '../core/templates';
import { finishHaptic, finishReduce, initialFinishState, showTimelapseNote, type FinishActionId, type FinishEvent } from '../core/finish';
import type { TimelapsePhase } from '../core/timelapse';
import { FinishSheet } from './FinishSheet';
import { select, success } from '../native/haptics';
import { PressableScale } from './PressableScale';
import { Toast } from './Toast';
import { toastDuration } from '../core/traceState';
import { light, space, touch } from '../theme/tokens';
import { radiusV2 } from '../theme/tokensV2';
import { CameraButton } from './v2/CameraButton';
import { CameraGlassSurface, cameraGlass } from './v2/CameraGlass';
import { CameraPill, CameraPillText } from './v2/CameraPill';
import { TemplateSvg } from './TemplateSvg';
import { VerticalSlider } from './VerticalSlider';
import type { Snapshot } from './usePaperCheck';
import { useT, type I18n } from '../i18n';

type Size = { width: number; height: number };

export type CompareViewProps = {
  photo: Snapshot;
  /** Trace screen size (the compare view covers the same area). */
  view: Size;
  /** Overlay base size from the trace screen (traceState.baseSize). */
  base: Size | null;
  /** The overlay transform as shown on the trace screen, including mirror. */
  transform: Transform;
  /** Template overlay (vector), else the raster overlay at overlayUri. */
  template?: Template;
  overlayUri: string;
  onClose: () => void;
  /** T67: "Save to My drawings" (trace screen). Resolves when saved; a rejection shows the failure toast. */
  onSave?: () => Promise<void>;
  /** T67: delete action (My drawings full view); the caller confirms. */
  onDelete?: () => void;
  /** T85: the trace screen's time-lapse phase, so the finish sheet only promises time-lapse saving when there is none. */
  timelapsePhase?: TimelapsePhase;
};

type SaveState = 'idle' | 'saving' | 'saved';

const PRESET_ICONS = { drawing: 'edit-3', both: 'layers', reference: 'image' } as const;
const PRESET_KEYS = {
  drawing: 'trace.compare.preset.drawing',
  both: 'trace.compare.preset.both',
  reference: 'trace.compare.preset.reference',
} as const;

/** Shown / spoken label for the mix: "Your drawing", "Reference", or "Reference 40%". */
function mixText(i18n: Pick<I18n, 't' | 'percent'>, mix: number): string {
  const m = clampMix(mix);
  if (m <= 0.001) return i18n.t('trace.compare.mixDrawing');
  if (m >= 0.999) return i18n.t('trace.compare.mixReference');
  return i18n.t('trace.compare.mixPartial', { percent: i18n.percent(m) });
}
/** The reference is drawn as on paper (always light, like the snapshot). */
const INK = light.graphite;

export function CompareView({ photo, view, base, transform, template, overlayUri, onClose, onSave, onDelete, timelapsePhase }: CompareViewProps) {
  const insets = useSafeAreaInsets();
  const i18n = useT();
  const { t, percent } = i18n;
  const side = Math.max(insets.left, insets.right);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [mode, setMode] = useState<CompareMode>('overlay');
  const layers = compareLayers(mix);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saving = useRef(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const hasReference = !!template || overlayUri.length > 0;
  // T85 finish moment: "Finished!" sheet after a save or the Finished action (logic in src/core/finish.ts).
  const router = useRouter();
  const [finish, dispatchFinish] = useReducer(finishReduce, initialFinishState);
  const openFinish = useCallback((event: FinishEvent) => {
    if (finishHaptic(event) === 'success') success();
    dispatchFinish(event);
  }, []);

  const save = useCallback(async () => {
    if (!onSave || saving.current || saveState === 'saved') return;
    saving.current = true;
    setSaveState('saving');
    try {
      await onSave();
      success();
      setSaveState('saved');
      setToast({ text: t('drawings.savedToast'), id: Date.now() });
      openFinish('saved');
    } catch {
      setSaveState('idle');
      setToast({ text: t('drawings.saveFailed'), id: Date.now() });
    } finally {
      saving.current = false;
    }
  }, [onSave, saveState, t, openFinish]);

  const onFinishAction = useCallback(
    (id: FinishActionId) => {
      if (id === 'save') {
        save();
        return;
      }
      dispatchFinish('close');
      if (id === 'viewDrawings') {
        onClose();
        router.push('/drawings');
      } else if (id === 'traceAgain') {
        onClose();
      }
    },
    [save, onClose, router],
  );

  // Android back closes the compare view instead of leaving the trace screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const overlayBox =
    hasReference && base && base.width > 0 && base.height > 0
    ? {
        position: 'absolute' as const,
        left: (view.width - base.width) / 2, // rtl-physical-ok (inside a never-mirrored LTR layer)
        top: (view.height - base.height) / 2,
        width: base.width,
        height: base.height,
        transform: toStyle(transform),
      }
    : null;

  const half = { width: view.width, height: view.height / 2 };
  const sideArt = Math.max(0, Math.min(half.width, half.height) * 0.9);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: light.paper }]}
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      {/* The snapshot and the reference keep their physical layout: never mirrored in right-to-left languages. */}
      <View style={[StyleSheet.absoluteFill, styles.ltr]}>
        {mode === 'overlay' ? (
          <>
            <Image
              source={{ uri: photo.uri }}
              resizeMode="cover"
              accessible
              accessibilityLabel={t('trace.compare.snapshot')}
              accessibilityIgnoresInvertColors
              style={[StyleSheet.absoluteFill, { opacity: layers.photo }]}
            />
            {overlayBox ? (
              <View
                pointerEvents="none"
                accessible
                accessibilityLabel={t('trace.compare.referenceVisible', { percent: percent(layers.overlay) })}
                style={[overlayBox, { opacity: layers.overlay }]}
              >
                {template ? (
                  <TemplateSvg template={template} size={overlayBox.width} color={INK} />
                ) : (
                  <Image
                    source={{ uri: overlayUri }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ width: half.width, height: half.height, backgroundColor: cameraGlass.backdrop }}>
              <Image
                source={{ uri: photo.uri }}
                resizeMode="contain"
                accessible
                accessibilityLabel={t('trace.compare.snapshot')}
                accessibilityIgnoresInvertColors
                style={StyleSheet.absoluteFill}
              />
              <Label text={t('trace.compare.yourPaper')} style={{ top: insets.top + space.sm + touch + space.sm }} />
            </View>
            <View
              style={{ width: half.width, height: half.height, alignItems: 'center', justifyContent: 'center' }}
              accessible
              accessibilityLabel={t('trace.compare.referenceImage')}
            >
              <View style={{ width: sideArt, height: sideArt, transform: [{ scaleX: transform.mirror ? -1 : 1 }] }}>
                {template ? (
                  <TemplateSvg template={template} size={sideArt} color={INK} />
                ) : !hasReference ? null : (
                  <Image
                    source={{ uri: overlayUri }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
              </View>
              <Label text={t('trace.compare.reference')} style={{ top: space.sm }} />
            </View>
          </View>
        )}
      </View>

      {/* Top row: close, current mix, side-by-side toggle */}
      <View
        pointerEvents="box-none"
        style={[
          styles.topRow,
          { top: insets.top + space.sm, start: side + space.lg, end: side + space.lg },
        ]}
      >
        <CameraButton icon="x" label={t('trace.compare.close')} accessibilityHint={t('trace.compare.closeHint')} onPress={onClose} />
        <CameraPill
          style={styles.pill}
          accessible
          accessibilityRole="text"
          accessibilityLabel={mode === 'side' ? t('trace.compare.side') : mixText(i18n, mix)}
        >
          <CameraPillText style={styles.pillText}>{mode === 'side' ? t('trace.compare.side') : mixText(i18n, mix)}</CameraPillText>
        </CameraPill>
        <CameraButton
          icon="sidebar"
          label={t('trace.compare.side')}
          accessibilityHint={t('trace.compare.sideHint')}
          active={mode === 'side'}
          onPress={() => {
            select();
            setMode(toggleCompareMode);
          }}
        />
      </View>

      {mode === 'overlay' ? (
        <>
          {/* Trailing edge: fade between your drawing (bottom) and the reference (top) */}
          <View pointerEvents="box-none" style={[styles.trailingEdge, { end: side + space.lg }]}>
            <VerticalSlider
              value={mix}
              onChange={setMix}
              onSlideStart={select}
              min={0}
              max={1}
              step={MIX_STEP}
              accessibilityLabel={t('trace.compare.slider')}
              accessibilityHint={t('trace.compare.sliderHint')}
            />
          </View>

          {/* Bottom: presets */}
          <View
            pointerEvents="box-none"
            style={[
              styles.bottomRow,
              { bottom: insets.bottom + space.md, start: side + space.md, end: side + space.md },
            ]}
          >
            {MIX_PRESETS.map((p) => (
              <CameraButton
                key={p.id}
                icon={PRESET_ICONS[p.id]}
                label={t(PRESET_KEYS[p.id])}
                active={Math.abs(mix - p.mix) < 0.001}
                size={touch}
                onPress={() => {
                  select();
                  setMix(p.mix);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      {onSave || onDelete ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.actionRow,
            {
              bottom: insets.bottom + space.md + (mode === 'overlay' ? touch + space.md : 0),
              start: side + space.md,
              end: side + space.md,
            },
          ]}
        >
          {onSave ? (
            <ActionPill
              icon={saveState === 'saved' ? 'check' : 'download'}
              text={t(saveState === 'saved' ? 'drawings.saved' : 'drawings.save')}
              hint={saveState === 'saved' ? undefined : t('drawings.saveHint')}
              disabled={saveState !== 'idle'}
              onPress={save}
            />
          ) : null}
          {onSave ? (
            <ActionPill
              icon="check-circle"
              text={t('drawings.finish.open')}
              hint={t('drawings.finish.openHint')}
              onPress={() => openFinish('done')}
            />
          ) : null}
          {onDelete ? (
            <ActionPill icon="trash-2" text={t('drawings.delete')} hint={t('drawings.deleteHint')} onPress={onDelete} />
          ) : null}
        </View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + space.sm + touch + space.md }]}>
        <Toast
          message={toast?.text ?? null}
          showId={toast?.id}
          duration={toastDuration(toast?.text ?? '')}
          onHide={() => setToast(null)}
        />
      </View>

      {onSave ? (
        <FinishSheet
          visible={finish.open}
          saved={saveState === 'saved'}
          saving={saveState === 'saving'}
          canSave
          showTimelapseNote={showTimelapseNote(timelapsePhase)}
          photoUri={photo.uri}
          template={template}
          overlayUri={overlayUri}
          mirror={transform.mirror}
          onAction={onFinishAction}
        />
      ) : null}
    </View>
  );
}

function ActionPill({
  icon,
  text,
  hint,
  disabled = false,
  onPress,
}: {
  icon: 'check' | 'check-circle' | 'download' | 'trash-2';
  text: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={styles.actionHit}
    >
      {({ pressed }) => (
        <CameraGlassSurface style={[styles.action, { opacity: disabled ? 0.6 : pressed ? 0.85 : 1 }]}>
          <Feather name={icon} size={18} color={cameraGlass.icon} style={{ marginEnd: space.sm }} />
          <CameraPillText style={styles.pillText}>{text}</CameraPillText>
        </CameraGlassSurface>
      )}
    </PressableScale>
  );
}

function Label({ text, style }: { text: string; style?: { top: number } }) {
  return (
    <CameraGlassSurface pointerEvents="none" bordered={false} style={[styles.label, style]} importantForAccessibility="no-hide-descendants">
      <CameraPillText style={styles.pillText}>{text}</CameraPillText>
    </CameraGlassSurface>
  );
}

const styles = StyleSheet.create({
  topRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ltr: { direction: 'ltr' },
  trailingEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  actionRow: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  actionHit: { borderRadius: radiusV2.pill },
  action: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radiusV2.pill,
  },
  toastWrap: {
    position: 'absolute',
    start: 0,
    end: 0,
    alignItems: 'center',
  },
  pill: {
    flexShrink: 1,
    marginHorizontal: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  label: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: radiusV2.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  pillText: {
    textAlign: 'center',
  },
});
