import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Alert, Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  formatSeconds,
  loopDurationMs,
  newProject,
  nextLoopName,
  type LoopProject,
  type LoopsState,
} from '../../src/core/loop';
import {
  deleteProject,
  keepSourceCopy,
  loadLoops,
  removeSourceCopy,
  upsertProject,
} from '../../src/store/loops';
import { useT } from '../../src/i18n';
// Owner 25 Oct (glaze-retest C): no bounce or slide in the Live Photo part, a plain fade only.
import { durations, useMotionReduced } from '../../src/theme/motion';
import {
  chromeRadiusV2,
  continuous,
  editorialV2,
  fontScaleCap,
  iconTileRadius,
  onArtV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { LivePhotoGuide } from '../../src/ui/LivePhotoGuide';
import { PhoneFrame, phoneScreenSize } from '../../src/ui/PhoneFrame';
import { PressableScale } from '../../src/ui/PressableScale';
import { ContextTip } from '../../src/ui/ContextTip';
import { Sheet } from '../../src/ui/Sheet';
import { haptic } from '../../src/ui/haptics';
import { BarIconButton } from '../../src/ui/BarIconButton';
import { Chevron, textStyleFor } from '../../src/ui/i18nLayout';
import { Skeleton } from '../../src/ui/Skeleton';
import { LargeTitleScrollView, PillButton, SectionHeader, SquircleCard } from '../../src/ui/v2';

const tap = () => haptic('select');

function isGifAsset(a: ImagePicker.ImagePickerAsset): boolean {
  return a.mimeType === 'image/gif' || /\.gif$/i.test(a.fileName ?? '') || /\.gif(?:[?#].*)?$/i.test(a.uri);
}

// T186 (owner-1101 #4): no longer a tab. This is the Live Photo maker at /live, a stack screen
// opened from the Wallpapers tab ("Live Photo from a clip"); a back button leads out of it.
// Live tab (design v2, docs/DESIGN_V2.md, T56): collapsing large title, pill actions, v2 palette in
// the sheets. T127: the playlist and "Set playlist on Lock Screen" (Now Playing) are gone; the Live
// Photo guide explains the path. T176 (premium UI, docs/PREMIUM_UI.md §3.10): two editorial sections
// ("Make a Live Photo" and "Your loops"), each loop its own lifted card on the 16 pt rhythm (dark
// mode: surfaceRaised, no hairline), a skeleton loop card while loading, Dynamic Type caps on every
// Text. The copy never promises a constantly looping Lock Screen on iPhone.
export default function LiveScreen() {
  const { c, scheme } = useColorsV2();
  const cardTone = scheme === 'dark' ? 'raised' : 'surface';
  const { t, script, isRTL } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const secs = (ms: number) => formatSeconds(ms, (value) => t('live.seconds', { value }));
  const router = useRouter();
  // T30: the Themes hero card opens this tab with ?new=1 to start the picker straight away.
  const { new: startNew } = useLocalSearchParams<{ new?: string }>();
  const [state, setState] = useState<LoopsState>({ projects: [], playlist: [] });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permSheet, setPermSheet] = useState(false);
  // Rows stagger in on the first loaded render only; later adds/removes use the layout transition.
  const reduced = useMotionReduced();
  const staggered = useRef(false);
  const animateIn = loaded && !staggered.current;
  useEffect(() => {
    if (loaded) staggered.current = true;
  }, [loaded]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadLoops().then((s) => {
        if (!alive) return;
        setState(s);
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const open = (id: string) => router.push({ pathname: '/live/[id]', params: { id } });

  const onNew = async () => {
    if (busy) return;
    tap();
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermSheet(true);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos', 'images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        // Keep GIFs animated and skip video transcoding on iOS.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const a = res.assets[0];
      const gif = isGifAsset(a);
      if (a.type !== 'video' && !gif) {
        Alert.alert(t('live.tab.notVideoTitle'), t('live.tab.notVideoBody'));
        return;
      }
      const id = Crypto.randomUUID();
      const sourceUri = await keepSourceCopy(a.uri, id);
      const project = newProject({
        id,
        sourceUri,
        kind: gif ? 'gif' : 'video',
        sourceDurationMs: gif ? 0 : a.duration ?? 0,
        sourceWidth: a.width,
        sourceHeight: a.height,
        name: nextLoopName(
          state.projects.map((p) => p.name),
          (number) => t('live.defaultName', { number }),
        ),
      });
      const next = await upsertProject(project);
      setState(next);
      haptic('success');
      open(id);
    } catch {
      Alert.alert(t('live.tab.openFailedTitle'), t('live.tab.openFailedBody'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (startNew !== '1' || !loaded) return;
    router.setParams({ new: undefined });
    onNew();
    // onNew reads the latest state; only the param and first load should start it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNew, loaded]);

  const onDelete = (p: LoopProject) => {
    haptic('warning');
    Alert.alert(t('live.tab.deleteTitle', { name: p.name }), t('live.tab.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const next = await deleteProject(p.id);
          await removeSourceCopy(p.sourceUri);
          setState(next);
        },
      },
    ]);
  };


  return (
    <LargeTitleScrollView
      title={t('tabs.live')}
      subtitle={t('live.tab.subtitle')}
      leading={router.canGoBack() ? <BarIconButton icon={Chevron.back(isRTL) as FeatherName} accessibilityLabel={t('common.back')} onPress={() => router.back()} /> : undefined}
    >
      <ContextTip id="live-loop" style={styles.side} />
      <View style={styles.section}>
        <SectionHeader
          flushTop
          eyebrow={t('live.tab.sections.make.eyebrow')}
          title={t('live.tab.sections.make.title')}
          body={t('live.tab.sections.make.body')}
          style={styles.sectionHead}
        />
        <PillButton
          label={busy ? t('live.tab.opening') : t('live.tab.newLoop')}
          icon="plus"
          block
          busy={busy}
          onPress={() => void onNew()}
          accessibilityHint={t('live.tab.pickHint')}
        />
        {/* T127/T147: saved as a Live Photo that moves in Photos; trying it as a wallpaper is optional
            and iPhone often keeps app-made Live Photos still (the guide says so). */}
        <LivePhotoGuide />
      </View>

      <View style={styles.section}>
        <SectionHeader
          flushTop
          eyebrow={t('live.tab.sections.loops.eyebrow')}
          title={t('live.tab.yourLoops')}
          style={[styles.sectionHead, styles.sectionNext]}
        />
        {!loaded ? (
          <LoopCardSkeleton tone={cardTone} /> // i18n-ignore (generic/comparison, not text)
        ) : state.projects.length === 0 ? (
          <Animated.View entering={FadeIn.duration(reduced ? durations.fast : durations.base)}>
            <SquircleCard tone={cardTone} outline={false} padding={spaceV2.xl} haptic={false}>
              <View style={styles.empty}>
                <EmptyPhone glazeA={c.glaze[0]} glazeB={c.glaze[1]} />
                <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), styles.center, { color: c.ink }]}>
                  {t('live.tab.emptyTitle')}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.center, { color: c.inkSecondary }]}>
                  {t('live.tab.emptyBody')}
                </Text>
                <PillButton
                  label={t('live.tab.pick')}
                  icon="film"
                  variant="tinted"
                  block
                  onPress={() => void onNew()}
                  disabled={busy}
                  accessibilityHint={t('live.tab.pickHint')}
                />
              </View>
            </SquircleCard>
          </Animated.View>
        ) : (
          <View style={styles.cards}>
            {state.projects.map((p) => {
              const meta =
                p.kind === 'gif'
                  ? t('live.tab.metaGif', { speed: `⁦${p.speed}×⁩` })
                  : t('live.tab.metaVideo', { duration: `⁦${secs(loopDurationMs(p.trim, p.speed))}⁩`, speed: `⁦${p.speed}×⁩` });
              return (
                <Animated.View key={p.id} entering={animateIn ? FadeIn.duration(reduced ? durations.fast : durations.base) : undefined}>
                  <SquircleCard tone={cardTone} outline={false} padding={0} haptic={false}>
                    <View style={styles.row}>
                      <Pressable
                        onPress={() => {
                          tap();
                          open(p.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('live.tab.editA11y', { name: p.name, meta })}
                        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.6 : 1 }]}
                      >
                        <View style={[styles.thumb, continuous, { backgroundColor: c.tintSoft }]}>
                          {p.kind === 'gif' ? (
                            <ExpoImage source={p.sourceUri} style={styles.thumbImg} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={p.id} />
                          ) : (
                            <Feather name="film" size={20} color={c.tint} />
                          )}
                        </View>
                        <View style={styles.rowText}>
                          <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
                            {meta}
                          </Text>
                        </View>
                      </Pressable>
                      <RowIconButton icon="trash-2" tone="secondary" accessibilityLabel={t('live.tab.deleteA11y', { name: p.name })} onPress={() => onDelete(p)} />
                    </View>
                  </SquircleCard>
                </Animated.View>
              );
            })}
          </View>
        )}
      </View>

      <Sheet visible={permSheet} onClose={() => setPermSheet(false)} title={t('live.tab.permTitle')}>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>
          {t('live.tab.permBody')}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.inkSecondary }]}>
          {t('live.tab.permSteps')}
        </Text>
        <PillButton
          label={t('liveUi.openSettings')}
          icon="settings"
          block
          onPress={() => {
            setPermSheet(false);
            Linking.openSettings().catch(() => {});
          }}
        />
        <PillButton label={t('liveUi.notNow')} variant="plain" block onPress={() => setPermSheet(false)} />
      </Sheet>

    </LargeTitleScrollView>
  );
}

type RowIconButtonProps = {
  icon: FeatherName;
  onPress: () => void;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  disabled?: boolean;
  /** tint for the main row action, secondary for quiet ones (remove, delete). */
  tone?: 'tint' | 'secondary';
};

/** 48 pt round icon button at the end of a loop or playlist row (v2 tint / secondary ink). */
function RowIconButton({ icon, onPress, accessibilityLabel, disabled = false, tone = 'tint' }: RowIconButtonProps) {
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
      <Feather name={icon} size={20} color={tone === 'tint' ? c.tint : c.inkSecondary} />
    </PressableScale>
  );
}

const EMPTY_PHONE_W = 96;
const THUMB = 40;
const EMPTY_PHONE_ASPECT = 9 / 19.5;

/** Empty-state illustration: a small phone with a glaze gradient and a play badge on its Lock Screen. */
function EmptyPhone({ glazeA, glazeB }: EmptyPhoneProps) {
  const s = phoneScreenSize(EMPTY_PHONE_W, EMPTY_PHONE_ASPECT);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.emptyArt}>
      <PhoneFrame width={EMPTY_PHONE_W} aspect={EMPTY_PHONE_ASPECT} showClock>
        <Svg width={s.width} height={s.height}>
          <Defs>
            <LinearGradient id="emptyLoop" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={glazeA} />
              <Stop offset="1" stopColor={glazeB} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={s.width} height={s.height} fill="url(#emptyLoop)" />
          <Circle cx={s.width / 2} cy={s.height * 0.62} r={s.width * 0.16} fill={onArtV2.ink} fillOpacity={0.22} />
        </Svg>
        <View pointerEvents="none" style={[styles.emptyPlay, { top: s.height * 0.62 - 10, left: s.width / 2 - 10 }]}>
          <Feather name="play" size={20} color={onArtV2.ink} />
        </View>
      </PhoneFrame>
    </View>
  );
}

type EmptyPhoneProps = {
  glazeA: string;
  glazeB: string;
};

/** Loading state in the shape of a loop card: thumbnail tile, name line, meta line, delete slot. */
function LoopCardSkeleton({ tone }: { tone: 'surface' | 'raised' }) {
  const { t } = useT();
  return (
    <View accessible accessibilityLabel={t('live.editor.loading')}>
      <SquircleCard tone={tone} outline={false} padding={0} haptic={false}>
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Skeleton width={THUMB} height={THUMB} radius={iconTileRadius(THUMB)} />
            <View style={styles.rowText}>
              <Skeleton width="60%" height={spaceV2.lg} radius={chromeRadiusV2.control} />
              <Skeleton width="35%" height={spaceV2.md} radius={chromeRadiusV2.control} />
            </View>
          </View>
          <View style={styles.iconBtn} />
        </View>
      </SquircleCard>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { marginHorizontal: spaceV2.lg },
  // 16 pt rhythm inside a section; the header keeps the editorial 12 pt below its title.
  section: { marginHorizontal: spaceV2.lg, gap: editorialV2.cardGap },
  sectionHead: { paddingBottom: 0, marginBottom: editorialV2.sectionBottom - editorialV2.cardGap },
  // The screen stacks blocks 24 pt apart; this lifts a later section to the editorial 32 pt.
  sectionNext: { paddingTop: editorialV2.sectionTop - spaceV2.xl },
  cards: { gap: editorialV2.cardGap },
  emptyArt: { marginBottom: spaceV2.sm },
  emptyPlay: { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 }, // rtl-ok (play glyph inside the never-mirrored phone mock)
  empty: { alignItems: 'center', gap: spaceV2.sm },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: sizeV2.rowMin + spaceV2.xs, paddingEnd: spaceV2.xs },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, padding: spaceV2.sm, paddingStart: spaceV2.lg, minHeight: sizeV2.touch },
  rowText: { flex: 1, gap: spaceV2.xxs },
  thumb: { width: THUMB, height: THUMB, borderRadius: iconTileRadius(THUMB), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: THUMB, height: THUMB },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  iconBtnDisabled: { opacity: 0.35 },
});
