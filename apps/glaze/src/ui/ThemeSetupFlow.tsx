// ThemeSetupFlow (T265, owner-1101i #1): the ONE guided flow that opens right after "Use this
// theme", spelled out for a first-time iPhone user. Progress dots 1-2-3 (tappable), one sentence
// per step with a small drawn illustration, Next / Skip on every step and Done at the end:
//   1 Wallpaper  "Save wallpaper to Photos" (the theme page's own save path), the Photos route,
//                Blur OFF on the Home Screen choice, and an Open Photos button.
//   2 Icons      "Install all icons" (app/install.tsx with auto=1 starts the existing bulk profile),
//                then the Settings steps (a)-(e) with the T262 ProfileGuideArt mocks, Open Settings.
//   3 Widgets    Home Screen edit mode > Add Widget > Glaze > size; Edit Widget > Art.
// Re-openable from the theme page's "Set it up" rows (ThemeSetupSection), which tick finished steps
// (per theme, src/store/themeSetup.ts). Built on RN Modal (Expo Go safe); step rules live in
// src/core/themeSetupFlow.ts.
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PHOTOS_URL,
  SETTINGS_APP_URL,
  SETUP_STEPS,
  advance,
  doneSteps,
  dots as dotViews,
  firstOpenStep,
  goTo,
  isLastStep,
  startFlow,
  stepNumber,
  type FlowState,
  type SetupProgress,
  type SetupStep,
} from '../core/themeSetupFlow';
import { useT, type MessageKey } from '../i18n';
import { loadSetupProgress, markSetupDone } from '../store/themeSetup';
import { circleRadius, continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { InsetGroup, InsetRow } from './InsetGroup';
import { PillButton } from './PillButton';
import { PressableScale } from './PressableScale';
import { ProfileGuideArt } from './ProfileGuideArt';
import { ThemeSetupArt, type SetupArtKind } from './ThemeSetupArt';

const STEP_TITLE: Record<SetupStep, MessageKey> = {
  wallpaper: 'theme.setup.wallpaper.title',
  icons: 'theme.setup.icons.title',
  widgets: 'theme.setup.widgets.title',
};
const STEP_LEAD: Record<SetupStep, MessageKey> = {
  wallpaper: 'theme.setup.wallpaper.lead',
  icons: 'theme.setup.icons.lead',
  widgets: 'theme.setup.widgets.lead',
};
const STEP_ROW: Record<SetupStep, MessageKey> = {
  wallpaper: 'theme.setup.rowWallpaper',
  icons: 'theme.setup.rowIcons',
  widgets: 'theme.setup.rowWidgets',
};
const STEP_ICON: Record<SetupStep, 'image' | 'grid' | 'layout'> = { wallpaper: 'image', icons: 'grid', widgets: 'layout' };

/** How long the sheet takes to slide away before the next screen is pushed (no two animations at once). */
const LEAVE_MS = 400;

// ---------------------------------------------------------------------------
// State hook (used by app/theme/[id].tsx)

export type ThemeSetup = {
  /** Steps finished for this theme (ticks on the "Set it up" rows). */
  done: ReadonlySet<SetupStep>;
  visible: boolean;
  state: FlowState;
  /** Opens the flow at a step (default: the first step not done yet). */
  openAt: (step?: SetupStep) => void;
  close: () => void;
  setState: (s: FlowState) => void;
  markDone: (step: SetupStep) => void;
  /** Closes the flow, runs `go` once the sheet is away, and reopens at `step` when this screen is back in focus. */
  leaveFor: (step: SetupStep, go: () => void) => void;
};

export function useThemeSetup(themeId: string): ThemeSetup {
  const [progress, setProgress] = useState<SetupProgress>({});
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<FlowState>(() => startFlow());
  const resumeAt = useRef<SetupStep | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    loadSetupProgress()
      .then((p) => {
        if (alive.current) setProgress(p);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [themeId]);

  // Back from the install screen (or anywhere the flow sent the person): reopen where they were.
  useFocusEffect(
    useCallback(() => {
      const at = resumeAt.current;
      if (!at) return;
      resumeAt.current = null;
      setState(startFlow(at));
      setVisible(true);
    }, []),
  );

  const openAt = useCallback(
    (step?: SetupStep) => {
      setState(startFlow(step ?? firstOpenStep(progress, themeId)));
      setVisible(true);
    },
    [progress, themeId],
  );
  const close = useCallback(() => setVisible(false), []);
  const markDone = useCallback(
    (step: SetupStep) => {
      markSetupDone(themeId, step)
        .then((p) => {
          if (alive.current) setProgress(p);
        })
        .catch(() => {});
    },
    [themeId],
  );
  const leaveFor = useCallback((step: SetupStep, go: () => void) => {
    resumeAt.current = step;
    setVisible(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      try {
        go();
      } catch {
        resumeAt.current = null;
      }
    }, LEAVE_MS);
  }, []);

  return { done: doneSteps(progress, themeId), visible, state, openAt, close, setState, markDone, leaveFor };
}

// ---------------------------------------------------------------------------
// Shared bits

function useType() {
  const { script } = useT();
  return (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
}

/** One instruction: a number badge, one sentence, and its illustration. */
function Instruction({ n, text, note, children }: { n: number; text: string; note?: string; children?: ReactNode }) {
  const { c } = useColorsV2();
  const { formatNumber } = useT();
  const ts = useType();
  return (
    <View style={styles.instruction}>
      <View style={styles.instructionHead}>
        <View style={[styles.badge, { backgroundColor: c.tintSoft }]} accessibilityElementsHidden importantForAccessibility="no">
          <Text maxFontSizeMultiplier={1.2} style={[...ts('footnote'), styles.bold, { color: c.onTintSoft }]}>
            {formatNumber(n)}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.ink }]}>
            {text}
          </Text>
          {note ? (
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Art({ kind }: { kind: SetupArtKind }) {
  return <ThemeSetupArt kind={kind} />;
}

// ---------------------------------------------------------------------------
// The flow

export type WallpaperSaveProps = {
  /** The theme page's own "Save to Photos" (own photo, art pack, Webb photo or drawn wallpaper). */
  onSave: () => void | Promise<void>;
  saving: boolean;
  /** Saved during this visit. */
  saved: boolean;
  /** Why the last save failed, in plain words (null when it did not fail). */
  error: string | null;
};

type FlowProps = {
  setup: ThemeSetup;
  themeName: string;
  wallpaper: WallpaperSaveProps;
  /** Starts the bulk icon install (the page closes the flow and opens the install screen). */
  onInstallIcons: () => void;
};

export function ThemeSetupFlow({ setup, themeName, wallpaper, onInstallIcons }: FlowProps) {
  const { c } = useColorsV2();
  const { t } = useT();
  const ts = useType();
  const insets = useSafeAreaInsets();
  const { state, visible, done } = setup;
  const step = state.step;
  const scroll = useRef<ScrollView>(null);
  const [photosFailed, setPhotosFailed] = useState(false);
  const [settingsFailed, setSettingsFailed] = useState(false);

  // A wallpaper saved from Step 1 ticks the step.
  const { markDone } = setup;
  useEffect(() => {
    if (visible && wallpaper.saved) markDone('wallpaper');
  }, [visible, wallpaper.saved, markDone]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const { close } = setup;
  useEffect(() => {
    if (state.finished) close();
  }, [state.finished, close]);

  const onNext = () => {
    setup.markDone(step);
    if (isLastStep(step)) haptic('success');
    setup.setState(advance(state));
  };
  const onSkip = () => {
    setup.setState(advance(state));
  };
  const onDot = (s: SetupStep) => setup.setState(goTo(state, s));

  const openPhotos = async () => {
    try {
      await Linking.openURL(PHOTOS_URL);
      setPhotosFailed(false);
    } catch {
      setPhotosFailed(true);
      haptic('warning');
    }
  };
  const openSettings = async () => {
    // App-prefs: opens the Settings app itself; openSettings() is Glaze's own page (still one tap away).
    try {
      await Linking.openURL(SETTINGS_APP_URL);
      setSettingsFailed(false);
      return;
    } catch {
      // Fall through.
    }
    try {
      await Linking.openSettings();
      setSettingsFailed(false);
      return;
    } catch {
      // Fall through.
    }
    setSettingsFailed(true);
    haptic('warning');
  };

  const stepTitle = t(STEP_TITLE[step]);
  const ios = Platform.OS === 'ios';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={ios ? 'pageSheet' : 'fullScreen'}
      onRequestClose={setup.close}
    >
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: ios ? spaceV2.sm : insets.top + spaceV2.sm }]}>
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            maxFontSizeMultiplier={fontScaleCap('headline')}
            style={[...ts('headline'), styles.flex, { color: c.ink }]}
          >
            {t('theme.setup.flowTitle', { name: themeName })}
          </Text>
          <PressableScale
            onPress={setup.close}
            haptic="select"
            accessibilityRole="button"
            accessibilityLabel={t('theme.setup.closeA11y')}
            style={styles.close}
          >
            <View style={[styles.closeDot, { backgroundColor: c.fill }]}>
              <Feather name="x" size={18} color={c.inkSecondary} />
            </View>
          </PressableScale>
        </View>

        <Dots state={state} done={done} onDot={onDot} />

        <ScrollView ref={scroll} bounces={false} overScrollMode="never" contentContainerStyle={styles.content}>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.bold, { color: c.tint }]}>
            {t('theme.setup.stepOf', { n: stepNumber(step), total: SETUP_STEPS.length })}
          </Text>
          <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('title2')} style={[...ts('title2'), styles.bold, { color: c.ink }]}>
            {stepTitle}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.inkSecondary }]}>
            {t(STEP_LEAD[step])}
          </Text>

          {step === 'wallpaper' ? (
            <View style={styles.stepBody}>
              <PillButton
                label={wallpaper.saving ? t('theme.setup.wallpaper.saving') : wallpaper.saved ? t('theme.setup.wallpaper.saved') : t('theme.setup.wallpaper.save')}
                icon={wallpaper.saved ? 'check-circle' : 'download'}
                block
                busy={wallpaper.saving}
                onPress={() => void wallpaper.onSave()}
              />
              {wallpaper.error ? (
                <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.warn }]}>
                  {wallpaper.error}
                </Text>
              ) : null}
              <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
                <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.ink }]}>
                  {t('theme.setup.wallpaper.path')}
                </Text>
                <PillButton
                  label={t('theme.setup.wallpaper.openPhotos')}
                  variant="tinted"
                  icon="external-link"
                  block
                  onPress={() => void openPhotos()}
                  accessibilityHint={t('theme.setup.wallpaper.openPhotosHint')}
                />
                {photosFailed ? (
                  <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
                    {t('theme.setup.wallpaper.noPhotos')}
                  </Text>
                ) : null}
              </View>
              <Instruction n={1} text={t('theme.setup.wallpaper.s1')}>
                <Art kind="photos-share" />
              </Instruction>
              <Instruction n={2} text={t('theme.setup.wallpaper.s2')}>
                <Art kind="wallpaper-add" />
              </Instruction>
              <Instruction n={3} text={t('theme.setup.wallpaper.blur')} note={t('theme.setup.wallpaper.blurWhy')}>
                <Art kind="home-blur" />
              </Instruction>
            </View>
          ) : null}

          {step === 'icons' ? (
            <View style={styles.stepBody}>
              <PillButton
                label={t('theme.setup.icons.install')}
                icon="grid"
                block
                onPress={onInstallIcons}
                accessibilityHint={t('theme.setup.icons.installHint')}
              />
              <Instruction n={1} text={t('theme.setup.icons.a')}>
                <ProfileGuideArt kind="profile-downloaded" />
              </Instruction>
              <Instruction n={2} text={t('theme.setup.icons.b')} note={t('theme.setup.icons.bOld')}>
                <ProfileGuideArt kind="settings-more" />
                <PillButton
                  label={t('theme.setup.icons.openSettings')}
                  variant="tinted"
                  icon="settings"
                  block
                  onPress={() => void openSettings()}
                  accessibilityHint={t('theme.setup.icons.openSettingsHint')}
                />
                {settingsFailed ? (
                  <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
                    {t('theme.setup.icons.noSettings')}
                  </Text>
                ) : null}
              </Instruction>
              <Instruction n={3} text={t('theme.setup.icons.c')}>
                <ProfileGuideArt kind="more-view-profile" />
              </Instruction>
              <Instruction n={4} text={t('theme.setup.icons.d')}>
                <ProfileGuideArt kind="install-profile-sheet" />
              </Instruction>
              <Instruction n={5} text={t('theme.setup.icons.e')}>
                <Art kind="home-library" />
              </Instruction>
            </View>
          ) : null}

          {step === 'widgets' ? (
            <View style={styles.stepBody}>
              <Instruction n={1} text={t('theme.setup.widgets.s1')}>
                <Art kind="jiggle-edit" />
              </Instruction>
              <Instruction n={2} text={t('theme.setup.widgets.s2')}>
                <Art kind="widget-gallery" />
              </Instruction>
              <Instruction n={3} text={t('theme.setup.widgets.s3')}>
                <Art kind="edit-widget" />
              </Instruction>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.separator, paddingBottom: insets.bottom + spaceV2.sm }]}>
          <PillButton label={t('theme.setup.skip')} variant="plain" onPress={onSkip} style={styles.flex} />
          <PillButton
            label={isLastStep(step) ? t('theme.setup.done') : t('theme.setup.next')}
            icon={isLastStep(step) ? 'check' : undefined}
            onPress={onNext}
            style={styles.flex}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Progress dots 1-2-3 (ticked when done); each is a ≥ 48 pt button that jumps to its step. */
function Dots({ state, done, onDot }: { state: FlowState; done: ReadonlySet<SetupStep>; onDot: (s: SetupStep) => void }) {
  const { c } = useColorsV2();
  const { t, formatNumber } = useT();
  const ts = useType();
  return (
    <View style={styles.dots}>
      {dotViews(state, done).map((d, i) => {
        const name = t(STEP_TITLE[d.step]);
        const fill = d.current ? c.tint : d.done ? c.tintSoft : c.fill;
        const ink = d.current ? c.onTint : d.done ? c.onTintSoft : c.inkSecondary;
        return (
          <View key={d.step} style={styles.dotCell}>
            {i > 0 ? <View style={[styles.dotLine, styles.lineBefore, { backgroundColor: c.separator }]} /> : null}
            {i < SETUP_STEPS.length - 1 ? <View style={[styles.dotLine, styles.lineAfter, { backgroundColor: c.separator }]} /> : null}
            <PressableScale
              onPress={() => onDot(d.step)}
              haptic="select"
              accessibilityRole="button"
              accessibilityState={{ selected: d.current }}
              accessibilityLabel={
                d.done ? t('theme.setup.dotDoneA11y', { n: d.number, step: name }) : t('theme.setup.dotA11y', { n: d.number, step: name })
              }
              accessibilityHint={t('theme.setup.dotHint')}
              style={styles.dotPress}
            >
              <View style={[styles.dot, { backgroundColor: fill }]}>
                {d.done && !d.current ? (
                  <Feather name="check" size={14} color={ink} />
                ) : (
                  <Text maxFontSizeMultiplier={1.2} style={[...ts('footnote'), styles.bold, { color: ink }]}>
                    {formatNumber(d.number)}
                  </Text>
                )}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[...ts('caption1'), { color: d.current ? c.ink : c.inkSecondary }]}>
                {name}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// "Set it up" rows on the theme page

export function ThemeSetupSection({
  themeName,
  done,
  onOpen,
}: {
  themeName: string;
  done: ReadonlySet<SetupStep>;
  onOpen: (step: SetupStep) => void;
}) {
  const { c } = useColorsV2();
  const { t } = useT();
  return (
    <InsetGroup title={t('theme.setup.title')} footer={t('theme.setup.footer')} style={styles.section}>
      {SETUP_STEPS.map((s) => {
        const name = t(STEP_TITLE[s]);
        const isDone = done.has(s);
        return (
          <InsetRow
            key={s}
            title={name}
            subtitle={t(STEP_ROW[s])}
            icon={STEP_ICON[s]}
            iconTone={isDone ? 'mint' : 'berry'}
            accessory="chevron"
            trailing={isDone ? <Feather name="check-circle" size={18} color={c.ok} /> : undefined}
            onPress={() => onOpen(s)}
            accessibilityLabel={
              isDone
                ? t('theme.setup.dotDoneA11y', { n: stepNumber(s), step: name })
                : t('theme.setup.dotA11y', { n: stepNumber(s), step: name })
            }
            accessibilityHint={[t('theme.setup.openHint', { step: name }), t('theme.setup.subtitle', { name: themeName })].join(' ')}
          />
        );
      })}
    </InsetGroup>
  );
}

const DOT = 32;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    paddingHorizontal: spaceV2.lg,
    minHeight: sizeV2.touch,
  },
  close: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  closeDot: { width: DOT, height: DOT, borderRadius: circleRadius(DOT), alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.sm },
  dotCell: { flex: 1, alignItems: 'center' },
  dotLine: { position: 'absolute', top: spaceV2.xs + DOT / 2 - 1, height: 2 },
  lineBefore: { start: 0, end: '50%' },
  lineAfter: { start: '50%', end: 0 },
  dotPress: { minHeight: sizeV2.touch, minWidth: sizeV2.touch, alignItems: 'center', gap: spaceV2.xxs, paddingTop: spaceV2.xs },
  dot: { width: DOT, height: DOT, borderRadius: circleRadius(DOT), alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.sm, paddingBottom: spaceV2.xxl, gap: spaceV2.sm },
  stepBody: { gap: spaceV2.lg, marginTop: spaceV2.sm },
  card: { borderRadius: radiusV2.card, padding: spaceV2.md, gap: spaceV2.sm },
  instruction: { gap: spaceV2.sm },
  instructionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.sm },
  badge: { width: 26, height: 26, borderRadius: circleRadius(26), alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    gap: spaceV2.sm,
    paddingHorizontal: spaceV2.lg,
    paddingTop: spaceV2.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  section: { marginTop: spaceV2.lg },
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
});
