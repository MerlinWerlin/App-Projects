// Workshop tab (owner 24 Oct 2026: "Trade & workshop deserves its own full category … with a different outline for
// adults popping on looking for quick access"). A blueprint-style screen, deliberately unlike the pastel Templates
// screen: dark navy with a faint cyan grid, square technical cards with thin outlines, light line art and monospace
// labels. Quick-access tiles for the trade sub-categories (src/core/tradeSubs.ts) filter the windowed grid below.
// A card tap behaves exactly as on Templates: detail sheet (favourite, thickness, Start tracing), long press traces
// at once, and the Plus lock routes to /plus.
import { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Platform, Pressable, StatusBar, Text, View, useWindowDimensions, type ListRenderItem } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { maxFontScaleV2, sizeV2, spaceV2 } from '../../src/theme/tokensV2';
import { select } from '../../src/native/haptics';
import { TEMPLATES, type Template } from '../../src/core/templates';
import { toggleFavorite as toggleInList } from '../../src/core/templateSearch';
import { TRADE_SUBS, inTradeSub, tradeSubCounts, type TradeSub } from '../../src/core/tradeSubs';
import { sceneBottomPad } from '../../src/core/tabs';
import { useT } from '../../src/i18n';
import { loadFavorites, recordTemplateUse, toggleFavorite } from '../../src/native/templatePrefs';
import { TemplateSvg } from '../../src/ui/TemplateSvg';
import { TemplateDetailSheet } from '../../src/ui/v2/TemplateDetailSheet';
import { usePlus } from '../../src/plus/usePlus';
import { starterIds, templateLocked } from '../../src/plus/access';
import { STARTER_TEMPLATE_COUNT } from '../../src/plus/entitlement';

// Same free set as the Templates screen (owner decision 22 Oct 2026); trade templates are all Plus.
const STARTERS = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
const TRADE = TEMPLATES.filter((t) => t.category === 'trade');
const COUNTS = tradeSubCounts(TRADE);
const SUBS = TRADE_SUBS.filter((s) => COUNTS[s] > 0);

/** Blueprint palette: the same in light and dark mode (it is the look of this tab). */
export const BLUEPRINT = {
  bg: '#0C2440',
  card: '#0F2D50',
  grid: '#1A4570',
  line: '#5FB8E8',
  art: '#E6F3FF',
  ink: '#E6F3FF',
  muted: '#8DB4D6',
  active: '#5FB8E8',
  onActive: '#0C2440',
} as const;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const GAP = spaceV2.x3;
const GRID = 24;

function BlueprintGrid({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, start: 0 }} pointerEvents="none">
      <Defs>
        <Pattern id="bp" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <Path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} stroke={BLUEPRINT.grid} strokeWidth={0.6} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bp)" />
    </Svg>
  );
}

export default function WorkshopScreen() {
  const { t, tDynamic } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gutter = spaceV2.x4;
  const cardWidth = Math.floor((width - gutter * 2 - GAP) / 2);
  const [sub, setSub] = useState<TradeSub | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [detail, setDetail] = useState<Template | null>(null);
  const listRef = useRef<FlatList<Template>>(null);
  const toggles = useRef(0);

  // Light status bar over the dark blueprint while this tab is on screen; back to default when leaving.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      let alive = true;
      const started = toggles.current;
      loadFavorites().then((list) => {
        if (alive && toggles.current === started) setFavorites(list);
      });
      return () => {
        alive = false;
        StatusBar.setBarStyle('default', true);
      };
    }, []),
  );

  const data = useMemo(() => inTradeSub(TRADE, sub), [sub]);
  const favSet = useMemo<ReadonlySet<string>>(() => new Set(favorites), [favorites]);
  const name = useCallback((tpl: Template) => tDynamic(`templates.name.${tpl.id}`, tpl.name), [tDynamic]);
  const subName = useCallback((s: TradeSub) => tDynamic(`templates.tradeSub.${s}`, s), [tDynamic]);

  const { access } = usePlus();
  const isLocked = useCallback((tpl: Template) => templateLocked(access, STARTERS, tpl.id), [access]);
  const open = useCallback(
    (tpl: Template) => {
      if (isLocked(tpl)) {
        router.push('/plus');
        return;
      }
      recordTemplateUse(tpl.id).catch(() => {});
      router.push({ pathname: '/trace', params: { template: tpl.id } });
    },
    [router, isLocked],
  );
  const showDetail = useCallback(
    (tpl: Template) => {
      if (isLocked(tpl)) router.push('/plus');
      else setDetail(tpl);
    },
    [isLocked, router],
  );
  const startFromSheet = useCallback(
    (tpl: Template) => {
      setDetail(null);
      open(tpl);
    },
    [open],
  );
  const favRef = useRef(favorites);
  favRef.current = favorites;
  const onToggleFavorite = useCallback(
    (tpl: Template) => {
      select();
      const adding = !favRef.current.includes(tpl.id);
      toggles.current += 1;
      setFavorites((prev) => toggleInList(prev, tpl.id));
      toggleFavorite(tpl.id).catch(() => {});
      AccessibilityInfo.announceForAccessibility(
        adding ? t('templates.favAdded', { name: name(tpl) }) : t('templates.favRemoved', { name: name(tpl) }),
      );
    },
    [t, name],
  );

  const pick = (next: TradeSub | null) => {
    select();
    setSub((cur) => (cur === next ? null : next));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const renderItem = useCallback<ListRenderItem<Template>>(
    ({ item }) => {
      const locked = isLocked(item);
      const label = name(item);
      return (
        <Pressable
          onPress={() => showDetail(item)}
          onLongPress={() => open(item)}
          accessibilityRole="button"
          accessibilityLabel={locked ? t('workshop.lockedA11y', { name: label }) : t('workshop.cardA11y', { name: label })}
          style={({ pressed }) => ({
            width: cardWidth,
            marginBottom: GAP,
            borderWidth: 1,
            borderColor: BLUEPRINT.line,
            borderRadius: 2,
            backgroundColor: BLUEPRINT.card,
            padding: spaceV2.x2,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spaceV2.x2 }}>
            <TemplateSvg template={item} size={cardWidth - spaceV2.x2 * 4} color={BLUEPRINT.art} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spaceV2.x1, borderTopWidth: 1, borderTopColor: BLUEPRINT.grid, paddingTop: spaceV2.x1 }}>
            <Text numberOfLines={2} maxFontSizeMultiplier={maxFontScaleV2} style={{ flex: 1, color: BLUEPRINT.ink, fontFamily: MONO, fontSize: 12, lineHeight: 16 }}>
              {label}
            </Text>
            {locked ? (
              <Text style={{ color: BLUEPRINT.line, fontFamily: MONO, fontSize: 10, borderWidth: 1, borderColor: BLUEPRINT.line, paddingHorizontal: 3 }}>
                {t('workshop.plus')}
              </Text>
            ) : null}
            {favSet.has(item.id) ? <Feather name="heart" size={12} color={BLUEPRINT.line} /> : null}
          </View>
        </Pressable>
      );
    },
    [cardWidth, favSet, isLocked, name, open, showDetail, t],
  );

  const tile = (key: string, label: string, count: number, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, checked: active }}
      accessibilityLabel={t('common.chip.withCount', { label, count })}
      style={{
        flexBasis: '31%',
        flexGrow: 1,
        minHeight: sizeV2.touch + spaceV2.x3,
        borderWidth: 1,
        borderColor: BLUEPRINT.line,
        borderRadius: 2,
        backgroundColor: active ? BLUEPRINT.active : 'transparent',
        padding: spaceV2.x2,
        justifyContent: 'space-between',
      }}
    >
      <Text numberOfLines={2} maxFontSizeMultiplier={maxFontScaleV2} style={{ color: active ? BLUEPRINT.onActive : BLUEPRINT.ink, fontFamily: MONO, fontSize: 12, lineHeight: 15, fontWeight: '600' }}>
        {label}
      </Text>
      <Text style={{ color: active ? BLUEPRINT.onActive : BLUEPRINT.muted, fontFamily: MONO, fontSize: 11, marginTop: 2 }}>{count}</Text>
    </Pressable>
  );

  const header = (
    <View style={{ marginBottom: spaceV2.x4 }}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={{ color: BLUEPRINT.ink, fontFamily: MONO, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: 1 }}>
        {t('workshop.title').toUpperCase()}
      </Text>
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={{ color: BLUEPRINT.muted, fontFamily: MONO, fontSize: 13, lineHeight: 18, marginTop: spaceV2.x1 }}>
        {t('workshop.subtitle')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('workshop.groupLabel')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.x2, marginTop: spaceV2.x4 }}>
        {tile('all', t('workshop.all'), TRADE.length, sub === null, () => pick(null))}
        {SUBS.map((s) => tile(s, subName(s), COUNTS[s], sub === s, () => pick(s)))}
      </View>
      <Text style={{ color: BLUEPRINT.muted, fontFamily: MONO, fontSize: 12, marginTop: spaceV2.x4 }} accessibilityLiveRegion="polite">
        {`// ${t('workshop.count', { count: data.length })}`}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BLUEPRINT.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <BlueprintGrid width={width} height={height} />
      <FlatList
        ref={listRef}
        data={data}
        extraData={favSet}
        numColumns={2}
        keyExtractor={(tpl) => tpl.id}
        renderItem={renderItem}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{
          paddingTop: insets.top + spaceV2.x4,
          paddingHorizontal: gutter,
          paddingBottom: sceneBottomPad(insets.bottom, true, spaceV2.x8),
        }}
        ListHeaderComponent={header}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        windowSize={5}
        removeClippedSubviews
      />
      <TemplateDetailSheet
        template={detail}
        favorite={detail ? favSet.has(detail.id) : false}
        onToggleFavorite={onToggleFavorite}
        onStart={startFromSheet}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}
