import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  addToPlaylist,
  formatSeconds,
  loopDurationMs,
  movePlaylistItem,
  newProject,
  nextLoopName,
  playlistDurationMs,
  removeFromPlaylist,
  type LoopProject,
  type LoopsState,
} from '../../src/core/loop';
import type { LivelockReason } from '../../src/native/livelock';
import {
  deleteProject,
  keepSourceCopy,
  loadLoops,
  removeSourceCopy,
  setPlaylist,
  upsertProject,
} from '../../src/store/loops';
import { useT } from '../../src/i18n';
import { listLayout, staggerIn, useMotionReduced } from '../../src/theme/motion';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import type { FeatherName } from '../../src/ui/featherName';
import { LiveStepsCard } from '../../src/ui/LiveStepsCard';
import { LiveUnavailableSheet, setOnLockScreen } from '../../src/ui/LiveUnavailableSheet';
import { PhoneFrame, phoneScreenSize } from '../../src/ui/PhoneFrame';
import { PressableScale } from '../../src/ui/PressableScale';
import { ContextTip } from '../../src/ui/ContextTip';
import { Sheet } from '../../src/ui/Sheet';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { Skeleton } from '../../src/ui/Skeleton';
import { LargeTitleScrollView, PillButton } from '../../src/ui/v2';

const tap = () => haptic('select');

function isGifAsset(a: ImagePicker.ImagePickerAsset): boolean {
  return a.mimeType === 'image/gif' || /\.gif$/i.test(a.fileName ?? '') || /\.gif(?:[?#].*)?$/i.test(a.uri);
}

// Live tab (design v2, docs/DESIGN_V2.md, T56): collapsing large title, loops and the playlist as
// inset-style surface groups with footnote headers, pill actions, v2 palette in the sheets.
export default function LiveScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const secs = (ms: number) => formatSeconds(ms, (value) => t('live.seconds', { value }));
  const router = useRouter();
  // T30: the Themes hero card opens this tab with ?new=1 to start the picker straight away.
  const { new: startNew } = useLocalSearchParams<{ new?: string }>();
  const [state, setState] = useState<LoopsState>({ projects: [], playlist: [] });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permSheet, setPermSheet] = useState(false);
  const [unavailable, setUnavailable] = useState<{ visible: boolean; reason: LivelockReason }>({
    visible: false,
    reason: null,
  });
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

  const updatePlaylist = async (ids: string[]) => {
    haptic('select');
    setState((s) => ({ ...s, playlist: ids }));
    setState(await setPlaylist(ids));
  };

  const byId = new Map(state.projects.map((p) => [p.id, p]));
  const playlistProjects = state.playlist.map((id) => byId.get(id)).filter((p): p is LoopProject => !!p);
  const showUnavailable = (reason: LivelockReason) => setUnavailable({ visible: true, reason });

  const sectionHeader = [...ts('footnote'), styles.sectionHeader, { color: c.inkSecondary }];
  const card = [styles.card, continuous, { backgroundColor: c.surface }];
  const hairline = { borderTopColor: c.separator, borderTopWidth: StyleSheet.hairlineWidth };

  return (
    <LargeTitleScrollView title={t('tabs.live')} subtitle={t('live.tab.subtitle')}>
      <ContextTip id="live-loop" style={styles.side} />
      <PillButton
        label={busy ? t('live.tab.opening') : t('live.tab.newLoop')}
        icon="plus"
        block
        busy={busy}
        onPress={() => void onNew()}
        accessibilityHint={t('live.tab.pickHint')}
        style={styles.side}
      />
      <View style={styles.side}>
        <LiveStepsCard />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={sectionHeader}>
          {t('live.tab.yourLoops')}
        </Text>
        {!loaded ? (
          <Skeleton width="100%" height={72} radius={radiusV2.group} /> // i18n-ignore (generic/comparison, not text)
        ) : state.projects.length === 0 ? (
          <Animated.View entering={staggerIn(0, reduced)} style={[...card, styles.empty]}>
            <EmptyPhone glazeA={c.glaze[0]} glazeB={c.glaze[1]} />
            <Text style={[...ts('headline'), styles.center, { color: c.ink }]}>{t('live.tab.emptyTitle')}</Text>
            <Text style={[...ts('body'), styles.center, { color: c.inkSecondary }]}>
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
          </Animated.View>
        ) : (
          <View style={card}>
            {state.projects.map((p, i) => {
              const inList = state.playlist.includes(p.id);
              const meta =
                p.kind === 'gif'
                  ? t('live.tab.metaGif', { speed: `⁦${p.speed}×⁩` })
                  : t('live.tab.metaVideo', { duration: `⁦${secs(loopDurationMs(p.trim, p.speed))}⁩`, speed: `⁦${p.speed}×⁩` });
              return (
                <Animated.View
                  key={p.id}
                  entering={animateIn ? staggerIn(i, reduced) : undefined}
                  layout={listLayout(reduced)}
                  style={[styles.row, i > 0 && hairline]}
                >
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
                        <Image source={{ uri: p.sourceUri }} style={styles.thumbImg} resizeMode="cover" />
                      ) : (
                        <Feather name="film" size={20} color={c.tint} />
                      )}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[...ts('body'), { color: c.ink }]} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{meta}</Text>
                    </View>
                  </Pressable>
                  <RowIconButton
                    icon={inList ? 'check-circle' : 'plus-circle'}
                    accessibilityLabel={inList ? t('live.tab.removeA11y', { name: p.name }) : t('live.tab.addA11y', { name: p.name })}
                    onPress={() =>
                      updatePlaylist(inList ? removeFromPlaylist(state.playlist, p.id) : addToPlaylist(state.playlist, p.id))
                    }
                  />
                  <RowIconButton icon="trash-2" tone="secondary" accessibilityLabel={t('live.tab.deleteA11y', { name: p.name })} onPress={() => onDelete(p)} />
                </Animated.View>
              );
            })}
          </View>
        )}
      </View>

      {loaded && state.projects.length > 0 ? (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={sectionHeader}>
              {t('live.tab.playlist')}
            </Text>
            <View style={card}>
              {playlistProjects.length === 0 ? (
                <Text style={[...ts('body'), styles.pad, { color: c.inkSecondary }]}>
                  {t('live.tab.playlistEmpty')}
                </Text>
              ) : (
                <>
                  {playlistProjects.map((p, i) => (
                    <Animated.View
                      key={p.id}
                      layout={listLayout(reduced)}
                      style={[styles.row, i > 0 && hairline]}
                    >
                      <Text style={[...ts('headline'), styles.index, { color: c.inkSecondary }]}>{i + 1}</Text>
                      <Text style={[...ts('body'), styles.rowText, { color: c.ink }]} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <RowIconButton
                        icon="arrow-up"
                        accessibilityLabel={t('live.tab.moveUpA11y', { name: p.name })}
                        disabled={i === 0}
                        onPress={() => updatePlaylist(movePlaylistItem(state.playlist, state.playlist.indexOf(p.id), state.playlist.indexOf(p.id) - 1))}
                      />
                      <RowIconButton
                        icon="arrow-down"
                        accessibilityLabel={t('live.tab.moveDownA11y', { name: p.name })}
                        disabled={i === playlistProjects.length - 1}
                        onPress={() => updatePlaylist(movePlaylistItem(state.playlist, state.playlist.indexOf(p.id), state.playlist.indexOf(p.id) + 1))}
                      />
                      <RowIconButton
                        icon="x"
                        tone="secondary"
                        accessibilityLabel={t('live.tab.removeA11y', { name: p.name })}
                        onPress={() => updatePlaylist(removeFromPlaylist(state.playlist, p.id))}
                      />
                    </Animated.View>
                  ))}
                  <Text style={[...ts('footnote'), styles.pad, hairline, { color: c.inkSecondary }]}>
                    {t('live.tab.playlistSummary', {
                      count: playlistProjects.length,
                      duration: `⁦${secs(playlistDurationMs(state.projects, state.playlist))}⁩`,
                    })}
                  </Text>
                </>
              )}
            </View>
          </View>
          <PillButton
            label={t('live.tab.setPlaylist')}
            icon="smartphone"
            block
            disabled={playlistProjects.length === 0}
            onPress={() => {
              tap();
              void setOnLockScreen(playlistProjects, showUnavailable);
            }}
            style={styles.side}
          />
        </>
      ) : null}

      <Sheet visible={permSheet} onClose={() => setPermSheet(false)} title={t('live.tab.permTitle')}>
        <Text style={[...ts('body'), { color: c.ink }]}>
          {t('live.tab.permBody')}
        </Text>
        <Text style={[...ts('body'), { color: c.inkSecondary }]}>
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

      <LiveUnavailableSheet
        visible={unavailable.visible}
        reason={unavailable.reason}
        onClose={() => setUnavailable((u) => ({ ...u, visible: false }))}
      />
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
          <Circle cx={s.width / 2} cy={s.height * 0.62} r={s.width * 0.16} fill="rgba(255,255,255,0.22)" />
        </Svg>
        <View pointerEvents="none" style={[styles.emptyPlay, { top: s.height * 0.62 - 10, left: s.width / 2 - 10 }]}>
          <Feather name="play" size={20} color="#FFFFFF" />
        </View>
      </PhoneFrame>
    </View>
  );
}

type EmptyPhoneProps = {
  glazeA: string;
  glazeB: string;
};

const styles = StyleSheet.create({
  side: { marginHorizontal: spaceV2.lg },
  section: { marginHorizontal: spaceV2.lg, gap: spaceV2.xs + spaceV2.xxs },
  sectionHeader: { paddingHorizontal: spaceV2.lg, fontWeight: '600' },
  emptyArt: { marginBottom: spaceV2.sm },
  emptyPlay: { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 }, // rtl-ok (play glyph inside the never-mirrored phone mock)
  card: { borderRadius: radiusV2.group, overflow: 'hidden' },
  empty: { padding: spaceV2.xl, alignItems: 'center', gap: spaceV2.sm },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: sizeV2.rowMin + spaceV2.xs, paddingEnd: spaceV2.xs },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, padding: spaceV2.sm, paddingStart: spaceV2.lg, minHeight: sizeV2.touch },
  rowText: { flex: 1, gap: spaceV2.xxs },
  thumb: { width: THUMB, height: THUMB, borderRadius: iconTileRadius(THUMB), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: THUMB, height: THUMB },
  index: { width: 32, textAlign: 'center', marginStart: spaceV2.sm },
  pad: { padding: spaceV2.lg },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  iconBtnDisabled: { opacity: 0.35 },
});
