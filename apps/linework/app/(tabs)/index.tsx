// Home (PLAN §3 /, DESIGN_V2 §7): large title, two big BubbleCards (Trace a photo / Templates), category bubbles,
// recent templates and favourites on a soft pastel panel, recent photos, progress as StatPills and My drawings as
// an InsetRow. Every flow from v1 stays: photo / camera pick with friendly errors, recents (long press to remove),
// template quick links, first-run setup guide. After the setup guide, a one-time, dismissable free-trial offer card
// (guideline 3.1.1, docs/OWNER_1024.md) for someone who hasn't started the trial; it never blocks tracing.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../../src/theme/useTheme';
import { gutterFor, maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../src/theme/tokensV2';
import type { RecentItem } from '../../src/core/recent';
import {
  forgetImage,
  imageExists,
  isFirstRun,
  loadRecent,
  markFirstRunDone,
} from '../../src/native/storage';
import { pickPhotoFromLibrary, takePhotoWithCamera, type PickedPhoto } from '../../src/native/photoPick';
import { classifyImageError } from '../../src/core/imageErrors';
import { imageErrorKeys } from '../../src/ui/ImageErrorBoundary';
import { select } from '../../src/native/haptics';
import { PressableScale } from '../../src/ui/PressableScale';
import { StaggerIn } from '../../src/ui/StaggerIn';
import { SetupGuide } from '../../src/ui/SetupGuide';
import { TemplateSvg } from '../../src/ui/TemplateSvg';
import {
  BubbleCard,
  CategoryBubble,
  EmptyStateV2,
  IconBubble,
  InsetGroup,
  InsetRow,
  PillButton,
  ScreenV2,
  Sparkle,
  StatPill,
} from '../../src/ui/v2';
import { squircle } from '../../src/ui/v2/shared';
import {
  DEFAULT_STROKE_WIDTH,
  TEMPLATES,
  categoryLabel,
  type Template,
  type TemplateCategory,
} from '../../src/core/templates';
import {
  FAVORITES_PARAM,
  collectionLabel,
  getCollection,
  inCollection,
  resolveTemplateIds,
  type TemplateCollectionId,
} from '../../src/core/templateSearch';
import { loadFavorites, loadRecentTemplates, recordTemplateUse } from '../../src/native/templatePrefs';
import { dayKey, loadProgress, summary, type ProgressSummary } from '../../src/native/progress';
import { pressScaleV2 } from '../../src/theme/motion';
import { useT } from '../../src/i18n';
import { loadDrawings } from '../../src/native/drawings';
import { usePlus } from '../../src/plus/usePlus';
import { TRIAL_DAYS, canStartTrial, starterIds, templateLocked } from '../../src/plus/access';
import { PLUS_PRICE, STARTER_TEMPLATE_COUNT } from '../../src/plus/entitlement';
import { TrialOfferText } from '../../src/plus/TrialOffer';
import { startTrialWithAlerts } from '../../src/plus/trialFlow';

const HOME_STARTERS = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);

// Home's quick ways into the library: a few occasions/styles and categories, then "See all".
// Labels are translated at render time ('templates.collectionShort.<id>' / 'templates.categoryShort.<id>').
type QuickLink = { id: string; collection?: TemplateCollectionId; category?: TemplateCategory };
const QUICK_LINKS: readonly QuickLink[] = [
  { id: 'birthday', collection: 'birthday' },
  { id: 'christmas', collection: 'christmas' },
  { id: 'wedding', collection: 'wedding' },
  { id: 'botanical', collection: 'botanical' },
  { id: 'heroes', category: 'heroes' },
  { id: 'animals', category: 'animals' },
  { id: 'mandalas', category: 'mandalas' },
  { id: 'cute', category: 'cute' },
  { id: 'kids', collection: 'kids' },
];

/** The bubble glyph for a quick link: the first bundled template in it (original line art from this repo). */
function glyphTemplate(link: QuickLink): Template | undefined {
  if (link.collection) {
    const col = getCollection(link.collection);
    return col ? TEMPLATES.find((tpl) => inCollection(tpl, col)) : undefined;
  }
  return TEMPLATES.find((tpl) => tpl.category === link.category);
}
const GLYPHS: readonly (Template | undefined)[] = QUICK_LINKS.map(glyphTemplate);

const GLYPH = 44;
const THUMB = 84;
const RECENT_TILE = 104;
const MINI_ROW_CAP = 12;

export default function HomeScreen() {
  const { c, text } = useThemeV2();
  const { t, tDynamic } = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gutter = gutterFor(width);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<Template[]>([]);
  const [favoriteTemplates, setFavoriteTemplates] = useState<Template[]>([]);
  const [showTips, setShowTips] = useState(false);
  // The trial offer card waits until the first-run setup guide is known to be done (no flash under it).
  const [tipsChecked, setTipsChecked] = useState(false);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [drawingCount, setDrawingCount] = useState(0);
  const [cameraDenied, setCameraDenied] = useState(false);
  // T59: after "Open Settings", clear the camera-denied card once access was switched on there.
  useEffect(() => {
    if (!cameraDenied) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      ImagePicker.getCameraPermissionsAsync()
        .then((p) => {
          if (p.granted) setCameraDenied(false);
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [cameraDenied]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadRecent().then((list) => {
        if (alive) setRecent(list);
      });
      loadRecentTemplates().then((list) => {
        if (alive) setRecentTemplates(resolveTemplateIds(list.map((r) => r.id), TEMPLATES));
      });
      loadFavorites().then((ids) => {
        if (alive) setFavoriteTemplates(resolveTemplateIds(ids.slice(0, MINI_ROW_CAP), TEMPLATES));
      });
      loadProgress().then((p) => {
        if (alive) setProgress(summary(p, dayKey(new Date())));
      });
      loadDrawings().then((list) => {
        if (alive) setDrawingCount(list.length);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  useEffect(() => {
    let alive = true;
    isFirstRun()
      .then((first) => {
        if (alive && first) setShowTips(true);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setTipsChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openPrepare = useCallback(
    (uri: string) => {
      router.push({ pathname: '/prepare', params: { uri } });
    },
    [router],
  );

  // The picked image is already checked, converted (HEIC → JPEG), copied and remembered (src/native/photoPick.ts).
  const handlePicked = useCallback(
    (picked: PickedPhoto | null) => {
      if (!picked) return;
      setRecent(picked.recent);
      openPrepare(picked.uri);
    },
    [openPrepare],
  );

  // T48: a photo that can't be opened gets a friendly explanation and a way to pick another, never a thrown error.
  const tracePhotoRef = useRef<() => void>(() => undefined);
  const showImageError = useCallback(
    (e: unknown) => {
      const keys = imageErrorKeys(classifyImageError(e));
      Alert.alert(t(keys.title), t(keys.body), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.imageError.tryAnother'), onPress: () => tracePhotoRef.current() },
      ]);
    },
    [t],
  );

  const run = useCallback(async (job: () => Promise<void>, failMessage: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      const detail = e instanceof Error && e.message ? e.message : '';
      Alert.alert(
        t('common.errorTitle'),
        detail ? t('common.errorWithDetail', { message: failMessage, detail }) : failMessage,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [t]);

  // BubbleCard / PillButton fire the light haptic (PressableScale), so these don't call tap() again.
  const tracePhoto = useCallback(() => {
    run(async () => {
      try {
        handlePicked(await pickPhotoFromLibrary());
      } catch (e) {
        showImageError(e);
      }
    }, t('home.error.openPhoto'));
  }, [run, handlePicked, showImageError, t]);
  tracePhotoRef.current = tracePhoto;

  const takePhoto = useCallback(() => {
    run(async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setCameraDenied(true);
        return;
      }
      setCameraDenied(false);
      try {
        handlePicked(await takePhotoWithCamera());
      } catch (e) {
        showImageError(e);
      }
    }, t('home.error.takePhoto'));
  }, [run, handlePicked, showImageError, t]);

  // The recent tile's PressableScale fires the selection haptic.
  const openRecent = useCallback(
    (item: RecentItem) => {
      run(async () => {
        if (await imageExists(item.uri)) {
          openPrepare(item.uri);
          return;
        }
        setRecent(await forgetImage(item.uri));
        Alert.alert(t('home.notFoundTitle'), t('home.notFoundBody'));
      }, t('home.error.openRecent'));
    },
    [openPrepare, run, t],
  );

  const confirmRemove = useCallback(
    (item: RecentItem) => {
      select();
      Alert.alert(t('home.removeTitle'), t('home.removeBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            run(async () => {
              setRecent(await forgetImage(item.uri));
            }, t('home.error.remove'));
          },
        },
      ]);
    },
    [run, t],
  );

  // Template thumbnails open trace directly; the use is recorded first so it moves to the front of the row.
  // (The thumbnail's BubbleCard fires the selection haptic.)
  const plus = usePlus();
  const { access } = plus;
  const openTemplate = useCallback(
    (tpl: Template) => {
      if (templateLocked(access, HOME_STARTERS, tpl.id)) {
        router.push('/plus');
        return;
      }
      recordTemplateUse(tpl.id)
        .then((list) => setRecentTemplates(resolveTemplateIds(list.map((r) => r.id), TEMPLATES)))
        .catch(() => {});
      router.push({ pathname: '/trace', params: { template: tpl.id } });
    },
    [router, access],
  );

  const openTemplates = useCallback(() => {
    router.push('/templates');
  }, [router]);

  const finishTips = useCallback(() => {
    setShowTips(false);
    markFirstRunDone();
  }, []);

  const settingsButton = (
    <Pressable
      onPress={() => {
        select();
        router.push('/settings');
      }}
      accessibilityRole="button"
      accessibilityLabel={t('common.nav.settings')}
      hitSlop={4}
      style={({ pressed }) => ({
        width: sizeV2.touch,
        height: sizeV2.touch,
        borderRadius: sizeV2.touch / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.inkSoft : 'transparent',
      })}
    >
      <Feather name="settings" size={24} color={c.ink} />
    </Pressable>
  );

  const hasMiniRows = recentTemplates.length > 0 || favoriteTemplates.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScreenV2 title={t('common.appName')} trailing={settingsButton} inTabs>
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('callout'), { color: c.muted, marginBottom: spaceV2.x6 }]}>
          {t('home.tagline')}
        </Text>

        {/* Two big ways in */}
        <View style={{ flexDirection: 'row', gap: spaceV2.x3 }}>
          <HeroCard
            title={t('home.tracePhoto')}
            hint={t('home.tracePhotoHint')}
            icon="image"
            tone="ink"
            onPress={tracePhoto}
          />
          <HeroCard
            title={t('common.nav.templates')}
            hint={t('home.seeAllTemplates')}
            icon="grid"
            tone="pastel"
            onPress={openTemplates}
          />
        </View>
        <PillButton
          title={t('home.takePhoto')}
          variant="secondary"
          icon="camera"
          accessibilityHint={t('home.takePhotoHint')}
          onPress={takePhoto}
          disabled={busy}
          block
          style={{ marginTop: spaceV2.x3 }}
        />
        {cameraDenied ? (
          <BubbleCard elevation="e1" style={{ marginTop: spaceV2.x3 }}>
            <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.graphite }]}>
              {t('home.cameraDenied')}
            </Text>
            <PillButton
              title={t('common.openSettings')}
              variant="plain"
              accessibilityLabel={t('home.cameraDeniedOpenLabel')}
              onPress={() => {
                Linking.openSettings().catch(() => {});
              }}
              style={{ marginTop: spaceV2.x1, paddingHorizontal: 0 }}
            />
          </BubbleCard>
        ) : null}

        {/* One-time free-trial offer (3.1.1 disclosure before it starts); "Not now" hides it for good. */}
        {tipsChecked && !showTips && plus.offerSeen === false && canStartTrial(access) ? (
          <BubbleCard fill={c.pastels[4]} padding={spaceV2.x5} style={{ marginTop: spaceV2.x4 }}>
            <TrialOfferText price={plus.price ?? PLUS_PRICE} />
            <PillButton
              title={t('plus.startTrial')}
              icon="clock"
              haptic="none"
              disabled={plus.busy}
              accessibilityHint={t('plus.startTrialHint', { days: TRIAL_DAYS })}
              onPress={() => {
                startTrialWithAlerts(plus).catch(() => {});
              }}
              style={{ marginTop: spaceV2.x4 }}
            />
            <PillButton
              title={t('plus.offer.notNow')}
              variant="plain"
              block
              onPress={() => {
                plus.dismissOffer().catch(() => {});
              }}
              style={{ marginTop: spaceV2.x1 }}
            />
          </BubbleCard>
        ) : null}

        {/* Progress (trace sessions) and My drawings (saved snapshots) */}
        {progress && progress.sessions >= 1 ? <ProgressPills progress={progress} /> : null}
        {drawingCount >= 1 ? (
          <InsetGroup style={{ marginTop: spaceV2.x4, marginBottom: 0 }}>
            <InsetRow
              title={t('drawings.title')}
              subtitle={t('drawings.count', { count: drawingCount })}
              icon="book-open"
              iconFill={c.pastels[3]}
              onPress={() => router.push('/drawings')}
              accessibilityLabel={t('drawings.homeLabel', { count: drawingCount })}
              accessibilityHint={t('drawings.homeHint')}
            />
          </InsetGroup>
        ) : null}

        {/* Templates: category bubbles, then recent templates and favourites on a pastel panel */}
        <SectionHeader
          title={t('common.nav.templates')}
          action={t('common.seeAll')}
          actionLabel={t('home.seeAllTemplates')}
          onAction={() => {
            select();
            openTemplates();
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -gutter }}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: spaceV2.x3, paddingVertical: spaceV2.x1 }}
        >
          {QUICK_LINKS.map((link, n) => {
            const label = link.collection
              ? tDynamic(`templates.collectionShort.${link.collection}`, collectionLabel(link.collection, true))
              : tDynamic(`templates.categoryShort.${link.id}`, link.category ? categoryLabel(link.category) : link.id);
            const tpl = GLYPHS[n];
            return (
              <CategoryBubble
                key={link.id}
                label={label}
                index={n}
                accessibilityLabel={t('home.quickLinkLabel', { name: label })}
                glyph={
                  tpl ? (
                    <TemplateSvg
                      template={tpl}
                      size={GLYPH}
                      color={c.graphite}
                      strokeWidth={(tpl.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 3}
                    />
                  ) : (
                    <Feather name="feather" size={28} color={c.ink} />
                  )
                }
                onPress={() => {
                  router.push({
                    pathname: '/templates',
                    params: link.collection ? { collection: link.collection } : { category: link.category ?? '' },
                  });
                }}
              />
            );
          })}
          <CategoryBubble
            label={t('common.seeAll')}
            index={QUICK_LINKS.length}
            accessibilityLabel={t('home.seeAllTemplates')}
            glyph={<Feather name="grid" size={28} color={c.ink} />}
            onPress={openTemplates}
          />
        </ScrollView>
        {hasMiniRows ? (
          <View
            style={[
              squircle,
              {
                marginTop: spaceV2.x4,
                paddingVertical: spaceV2.x4,
                paddingHorizontal: spaceV2.x4,
                borderRadius: radiusV2.xl,
                backgroundColor: c.pastels[2],
                gap: spaceV2.x4,
              },
            ]}
          >
            {recentTemplates.length > 0 ? (
              <TemplateMiniRow
                title={t('home.recentTemplates')}
                context={t('home.recentTemplatesContext')}
                items={recentTemplates}
                onOpen={openTemplate}
              />
            ) : null}
            {favoriteTemplates.length > 0 ? (
              <TemplateMiniRow
                title={t('home.favourites')}
                context={t('home.favouriteContext')}
                seeAllLabel={t('home.seeAllFavourites')}
                items={favoriteTemplates}
                onOpen={openTemplate}
                onSeeAll={() => {
                  select();
                  router.push({ pathname: '/templates', params: { collection: FAVORITES_PARAM } });
                }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Recent photos */}
        <SectionHeader title={t('home.recent')} />
        {recent.length === 0 ? (
          // T89: the shared designed empty state, with Trace a photo as its one action.
          <EmptyStateV2
            art="recents"
            title={t('home.emptyTitle')}
            body={t('home.emptyBody')}
            action={{ title: t('home.tracePhoto'), accessibilityHint: t('home.tracePhotoHint'), icon: 'image', onPress: tracePhoto }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -gutter }}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: spaceV2.x3, paddingVertical: spaceV2.x2 }}
          >
            {recent.map((item, n) => (
              <StaggerIn key={item.uri} index={n}>
                <PressableScale
                  onPress={() => openRecent(item)}
                  onLongPress={() => confirmRemove(item)}
                  delayLongPress={400}
                  haptic="select"
                  scaleTo={pressScaleV2}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t('home.recentPhotoLabel', { index: n + 1, total: recent.length })}
                  accessibilityHint={t('home.recentPhotoHint')}
                  style={[
                    squircle,
                    {
                      width: RECENT_TILE,
                      height: RECENT_TILE,
                      borderRadius: radiusV2.md,
                      overflow: 'hidden',
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.line,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                </PressableScale>
              </StaggerIn>
            ))}
          </ScrollView>
        )}
      </ScreenV2>
      <SetupGuide visible={showTips} onDone={finishTips} />
    </View>
  );
}

// One of the two big entry cards: ink hero or a pastel one, each with a sparkle. Text wraps for long translations.
function HeroCard({
  title,
  hint,
  icon,
  tone,
  onPress,
}: {
  title: string;
  hint: string;
  icon: 'image' | 'grid';
  tone: 'ink' | 'pastel';
  onPress: () => void;
}) {
  const { c, text } = useThemeV2();
  const ink = tone === 'ink';
  return (
    <BubbleCard
      fill={ink ? c.ink : c.pastels[1]}
      sparkle
      sparkleColor={ink ? c.sunny : c.bubblegum}
      radius="xl"
      padding={spaceV2.x5}
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={{ flex: 1, minHeight: 156, justifyContent: 'space-between' }}
    >
      <IconBubble icon={icon} size={44} fill={ink ? c.onInk : c.card} color={c.ink} />
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('title3'), { color: ink ? c.onInk : c.graphite, marginTop: spaceV2.x4 }]}>
        {title}
      </Text>
    </BubbleCard>
  );
}

// T69 / T80: calm, local-only progress as stat pills. It counts trace sessions (My drawings counts saved
// drawings), so the wording says "sessions". The streak shows only while it is running. One spoken label.
function ProgressPills({ progress }: { progress: ProgressSummary }) {
  const { t, num } = useT();
  const sessions = t('home.progress.sessions', { count: progress.sessions });
  const minutes = t('home.progress.minutes', { count: progress.minutes });
  const streak = progress.streak >= 1 ? t('home.progress.streak', { count: progress.streak }) : null;
  const label = streak
    ? t('home.progress.label', { sessions, minutes, streak })
    : t('home.progress.labelNoStreak', { sessions, minutes });
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.x2, marginTop: spaceV2.x5 }}
    >
      <StatPill
        icon="edit-2"
        tone="ink"
        value={num(progress.sessions)}
        label={t('home.stat.sessions', { count: progress.sessions })}
      />
      <StatPill
        icon="clock"
        tone="mint"
        value={num(progress.minutes)}
        label={t('home.stat.minutes', { count: progress.minutes })}
      />
      {streak ? (
        <StatPill
          icon="star"
          tone="sunny"
          value={num(progress.streak)}
          label={t('home.stat.streak', { count: progress.streak })}
        />
      ) : null}
    </View>
  );
}

function TemplateMiniRow({
  title,
  context,
  seeAllLabel,
  items,
  onOpen,
  onSeeAll,
}: {
  title: string;
  context: string;
  /** Screen-reader label for the See all button. */
  seeAllLabel?: string;
  items: Template[];
  onOpen: (t: Template) => void;
  onSeeAll?: () => void;
}) {
  const { c, text } = useThemeV2();
  const { t, tDynamic } = useT();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: sizeV2.touch }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('headline'), { color: c.graphite, flexShrink: 1 }]}
        >
          {title}
        </Text>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={seeAllLabel ?? t('common.seeAll')}
            style={{ minHeight: sizeV2.touch, minWidth: sizeV2.touch, justifyContent: 'center', alignItems: 'flex-end', paddingStart: spaceV2.x2 }}
          >
            <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.ink, fontWeight: '600' }]}>
              {t('common.seeAll')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spaceV2.x4 }}
        contentContainerStyle={{ paddingHorizontal: spaceV2.x4, gap: spaceV2.x3, paddingVertical: spaceV2.x2 }}
      >
        {items.map((tpl, n) => (
          <StaggerIn key={tpl.id} index={n}>
            <BubbleCard
              radius="md"
              elevation="e1"
              padding={spaceV2.x2}
              onPress={() => onOpen(tpl)}
              haptic="select"
              accessibilityLabel={t('templates.thumb.label', { context, name: tDynamic(`templates.name.${tpl.id}`, tpl.name) })}
              accessibilityHint={t('templates.card.hint')}
              style={{ width: THUMB, height: THUMB, alignItems: 'center', justifyContent: 'center' }}
            >
              <TemplateSvg
                template={tpl}
                size={THUMB - spaceV2.x2 * 2}
                color={c.graphite}
                strokeWidth={(tpl.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 2}
              />
            </BubbleCard>
          </StaggerIn>
        ))}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  action?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { c, text } = useThemeV2();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spaceV2.section + spaceV2.x2,
        marginBottom: spaceV2.x2,
        minHeight: sizeV2.touch,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spaceV2.x2, flexShrink: 1 }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[text('title2'), { color: c.graphite, flexShrink: 1 }]}>
          {title}
        </Text>
        <Sparkle size={16} />
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? action}
          style={{ minHeight: sizeV2.touch, minWidth: sizeV2.touch, justifyContent: 'center', alignItems: 'flex-end', paddingStart: spaceV2.x2 }}
        >
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), { color: c.ink }]}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
