// T90 Wallet > Units: offline travel converters next to the currency converter (app/convert.tsx).
// - Tabs: temperature, distance & speed, weight, volume (with the 100 ml cabin liquids hint) and clothing / shoe sizes
//   (general EU / UK / US / JP charts, labelled approximate). The last tab is remembered (UNITS_TAB_KEY).
// - Live result while typing (decimal point or comma), swap button, quick-pick chips, "1 x = y" line.
// - Results start in the home country's system (src/core/units.ts defaultSystem: US / LR / MM imperial).
// All maths and tables in src/core/units.ts. Free feature. Tokens only, timed motion only (no springs), 48 pt targets,
// every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOME_COUNTRY_KEY } from '../src/core/settings.ts';
import {
  chipsFor,
  cleanInput,
  convertSize,
  convertUnit,
  decimalMark,
  defaultDirection,
  defaultSystem,
  formatPlain,
  formatResult,
  homeSizeSystem,
  lookupSize,
  normaliseSizeChart,
  normaliseUnitsTab,
  pairsFor,
  parseNumber,
  SIZE_CHART_IDS,
  SIZE_CHART_KEY,
  SIZE_CHARTS,
  sizeOptions,
  swapUnits,
  toggleSign,
  UNIT_TABS,
  UNITS_TAB_KEY,
  valueToInput,
  type Direction,
  type SizeChartId,
  type SizeRow,
  type SizeSystem,
  type UnitId,
  type UnitSystem,
  type UnitTab,
} from '../src/core/units.ts';
import { DEFAULT_TEMP_UNIT, TEMP_UNIT_KEY } from '../src/core/weather.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { usePersisted } from '../src/state/persisted.ts';
import { duration, timed } from '../src/theme/motion.ts';
import { radius, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../src/ui/hero.tsx';
import { Button, Card, Chip, Label, PressableScale, TextField, Warning } from '../src/ui/kit.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICON: Record<UnitTab, IconName> = {
  temp: 'thermometer-outline',
  distance: 'speedometer-outline',
  weight: 'barbell-outline',
  volume: 'water-outline',
  sizes: 'shirt-outline',
};

const DEFAULT_TAB: unknown = 'temp';
const DEFAULT_CHART: unknown = 'womenTops';
const NO_HOME: unknown = null;
const NO_TEMP: unknown = DEFAULT_TEMP_UNIT;

const sym = (u: UnitId) => `units.u.${u}` as Key;
const spoken = (u: UnitId) => `units.name.${u}` as Key;

export default function UnitsScreen() {
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const [rawTab, setTab] = usePersisted<unknown>(UNITS_TAB_KEY, DEFAULT_TAB);
  const [rawHome] = usePersisted<unknown>(HOME_COUNTRY_KEY, NO_HOME);
  const [rawTemp] = usePersisted<unknown>(TEMP_UNIT_KEY, NO_TEMP);
  const tab = normaliseUnitsTab(rawTab);
  const homeIso = typeof rawHome === 'string' ? rawHome : null;
  const system = defaultSystem(homeIso, typeof rawTemp === 'string' ? rawTemp : null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" compact title={t('units.title')} subtitle={t('units.subtitle')} />
      </FadeInView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }} accessibilityRole="tablist" accessibilityLabel={t('units.tabs')}>
        {UNIT_TABS.map((x) => {
          const selected = x === tab;
          return (
            <PressableScale
              key={x}
              accessibilityRole="tab"
              accessibilityLabel={t(`units.tab.${x}` as Key)}
              accessibilityHint={t('units.tabHint')}
              accessibilityState={{ selected }}
              onPress={() => setTab(x)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                paddingHorizontal: space.l,
                borderRadius: radius.pill,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? theme.accent : theme.line,
                backgroundColor: selected ? theme.accentSoft : theme.cardRaised,
              }}
            >
              <Ionicons name={TAB_ICON[x]} size={18} color={selected ? theme.accentInk : theme.muted} />
              <Text style={[typeScale.bodyStrong, { fontSize: 15, color: selected ? theme.accentInk : theme.ink }]}>{t(`units.tab.${x}` as Key)}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      <FadeInView key={tab}>{tab === 'sizes' ? <SizesTab homeIso={homeIso} /> : <LinearTab tab={tab} system={system} />}</FadeInView>
    </ScrollView>
  );
}

/** Temperature, distance & speed, weight or volume: pair chips, the input, swap and the live result. */
function LinearTab({ tab, system }: { tab: Exclude<UnitTab, 'sizes'>; system: UnitSystem }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const pairs = useMemo(() => pairsFor(tab), [tab]);
  const [pairId, setPairId] = useState(pairs[0].id);
  const pair = pairs.find((p) => p.id === pairId) ?? pairs[0];
  // null = the home-system default (it may load after the first frame); a swap makes it explicit.
  const [chosen, setChosen] = useState<Direction | null>(null);
  const dir = chosen ?? defaultDirection(pair, system);
  const [text, setText] = useState('');
  const spin = useRef(new Animated.Value(0)).current;
  const spun = useRef(0);
  const mark = decimalMark(lang);

  const value = parseNumber(text, mark);
  const result = value == null ? null : convertUnit(value, dir.from, dir.to);
  const invalid = text.trim() !== '' && text.trim() !== '-' && value == null;
  const resultText = result == null ? t('units.resultNone') : formatResult(result, dir.to, lang);
  const one = convertUnit(1, dir.from, dir.to);
  const from = t(sym(dir.from));
  const to = t(sym(dir.to));

  const pickPair = (id: string) => {
    setPairId(id);
    setChosen(null);
    setText('');
  };
  const swap = () => {
    setChosen(swapUnits(dir));
    spun.current += 1;
    timed(spin, spun.current, duration.base, reduceMotion).start();
  };
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'], extrapolate: 'extend' });

  return (
    <View style={{ gap: space.l }}>
      {pairs.length > 1 ? (
        <View style={{ gap: space.s }}>
          <View accessibilityRole="header">
            <Label>{t('units.pairs')}</Label>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('units.pairs')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {pairs.map((p) => (
              <Chip
                key={p.id}
                label={t('units.pair', { a: t(sym(p.a)), b: t(sym(p.b)) })}
                a11yLabel={t('units.pairA11y', { a: t(spoken(p.a)), b: t(spoken(p.b)) })}
                hint={t('units.pairHint')}
                selected={p.id === pair.id}
                onPress={() => pickPair(p.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Card style={{ gap: space.m }}>
        <View style={{ gap: space.xs }}>
          <Label>{t('units.from')}</Label>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('units.inputLabel', { unit: t(spoken(dir.from)) })}
                value={text}
                onChange={(v) => setText(cleanInput(v))}
                placeholder={t('units.placeholder')}
                inputMode="decimal"
                autoCapitalize="none"
                error={invalid ? t('units.invalid') : undefined}
              />
            </View>
            {tab === 'temp' ? (
              <View style={{ marginBottom: invalid ? space.xl : 0 }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('units.signA11y')}
                  accessibilityHint={t('units.signHint')}
                  onPress={() => setText((x) => toggleSign(x))}
                  style={{ width: 52, borderRadius: radius.m, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, alignItems: 'center' }}
                >
                  <Text style={[typeScale.title, { color: theme.ink }]}>{t('units.sign')}</Text>
                </PressableScale>
              </View>
            ) : null}
          </View>
          <Text style={[typeScale.title, { color: theme.muted }]}>{from}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('units.swapA11y', { from: t(spoken(dir.from)), to: t(spoken(dir.to)) })}
            accessibilityHint={t('units.swapHint')}
            onPress={swap}
            style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: theme.seaSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="swap-vertical" size={26} color={theme.sea} />
            </Animated.View>
          </PressableScale>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
        </View>

        <View style={{ gap: space.xs }}>
          <Label>{t('units.to')}</Label>
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={result == null ? t('units.resultNoneA11y') : t('units.resultA11y', { value: resultText, unit: t(spoken(dir.to)) })}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[typeScale.displayL, { color: theme.accentInk, flex: 1, fontVariant: ['tabular-nums'] }]}>
              {resultText}
            </Text>
            <Text style={[typeScale.title, { color: theme.muted }]}>{to}</Text>
          </View>
          {one != null && tab !== 'temp' ? (
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('units.oneIs', { from, value: formatResult(one, dir.to, lang), to })}</Text>
          ) : null}
        </View>
        {text ? <Button kind="quiet" label={t('units.clear')} hint={t('units.clearHint')} onPress={() => setText('')} /> : null}
      </Card>

      <SectionCard title={t('units.quick')} icon="flash-outline" tone="teal">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {chipsFor(pair, dir.from).map((v) => {
            const shown = formatPlain(v, lang);
            return (
              <PressableScale
                key={v}
                accessibilityRole="button"
                accessibilityLabel={t('units.quickA11y', { value: shown, unit: t(spoken(dir.from)) })}
                accessibilityHint={t('units.quickHint')}
                onPress={() => setText(valueToInput(v, mark))}
                style={{ paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card }}
              >
                <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('units.quickChip', { value: shown, unit: from })}</Text>
              </PressableScale>
            );
          })}
        </View>
      </SectionCard>

      {tab === 'volume' ? <Warning text={t('units.liquids')} /> : null}
      {pair.b === 'ukgal' ? <Note text={t('units.ukGalNote')} /> : null}
      <Note text={t(system === 'imperial' ? 'units.homeSystem.imperial' : 'units.homeSystem.metric')} />
    </View>
  );
}

function Note({ text }: { text: string }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
        <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
      </View>
      <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** Clothing and shoe sizes: chart, the system you know, your size, the matches and the full chart. */
function SizesTab({ homeIso }: { homeIso: string | null }) {
  const { t, theme } = useApp();
  const [rawChart, setChart] = usePersisted<unknown>(SIZE_CHART_KEY, DEFAULT_CHART);
  const chartId = normaliseSizeChart(rawChart);
  const chart = SIZE_CHARTS[chartId];
  const [pickedSystem, setSystem] = useState<SizeSystem | null>(null);
  const system = pickedSystem && chart.systems.includes(pickedSystem) ? pickedSystem : homeSizeSystem(homeIso, chart);
  const [size, setSize] = useState('');
  const match = size.trim() ? lookupSize(chart, system, size) : null;
  const sysName = (s: SizeSystem) => t(`units.sizes.sys.${s}` as Key);
  const rowText = (r: SizeRow) =>
    chart.systems
      .filter((s) => r[s] != null)
      .map((s) => t('units.sizes.cell', { system: sysName(s), size: r[s] as string }))
      .join(', ');

  const pickChart = (id: SizeChartId) => {
    setChart(id);
    setSize('');
  };
  const pickSystem = (s: SizeSystem) => {
    setSystem(s);
    setSize('');
  };

  return (
    <View style={{ gap: space.l }}>
      <Warning text={t('units.sizes.disclaimer')} />
      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('units.sizes.chart')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('units.sizes.chart')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {SIZE_CHART_IDS.map((id) => (
            <Chip key={id} label={t(`units.sizes.chart.${id}` as Key)} hint={t('units.sizes.chartHint')} selected={id === chartId} onPress={() => pickChart(id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('units.sizes.system')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('units.sizes.system')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {chart.systems.map((s) => (
            <Chip key={s} label={sysName(s)} hint={t('units.sizes.systemHint')} selected={s === system} onPress={() => pickSystem(s)} />
          ))}
        </View>
      </View>

      <Card style={{ gap: space.m }}>
        <Label>{t('units.sizes.pick')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('units.sizes.pick')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {sizeOptions(chart, system).map((v) => (
            <Chip
              key={v}
              label={v}
              a11yLabel={t('units.sizes.pickA11y', { system: sysName(system), size: v })}
              hint={t('units.sizes.pickHint')}
              selected={match?.size === v}
              onPress={() => setSize(v)}
            />
          ))}
        </View>
        <TextField label={t('units.sizes.type')} value={size} onChange={(v) => setSize(v.slice(0, 8))} placeholder={t('units.sizes.typePlaceholder')} autoCapitalize="none" />
        <View accessible accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
          {match ? (
            <>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('units.sizes.result')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
                {chart.systems
                  .filter((s) => s !== system)
                  .map((s) => {
                    const v = convertSize(chart, system, match.size, s);
                    return v ? (
                      <Text key={s} style={[typeScale.displayM, { color: theme.accentInk, fontVariant: ['tabular-nums'] }]}>
                        {t('units.sizes.cell', { system: sysName(s), size: v })}
                      </Text>
                    ) : null;
                  })}
              </View>
              {!match.exact ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('units.sizes.nearest', { system: sysName(system), size: match.size })}</Text> : null}
            </>
          ) : size.trim() ? (
            <Text style={[typeScale.small, { color: theme.danger }]}>{t('units.sizes.none')}</Text>
          ) : null}
        </View>
      </Card>

      <SectionCard title={t('units.sizes.table')} icon="grid-outline" tone="sea">
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: space.s }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {chart.systems.map((s) => (
              <Text key={s} style={[typeScale.caption, { flex: 1, textAlign: 'center', color: s === system ? theme.accentInk : theme.muted }]}>
                {sysName(s)}
              </Text>
            ))}
          </View>
          {chart.rows.map((r, i) => {
            const selected = !!match && match.rows.includes(r);
            const label = rowText(r);
            return (
              <PressableScale
                key={i}
                accessibilityRole="button"
                accessibilityLabel={selected ? t('units.sizes.rowSelected', { row: label }) : t('units.sizes.rowA11y', { row: label })}
                accessibilityHint={t('units.sizes.rowHint')}
                accessibilityState={{ selected }}
                onPress={() => setSize(r[system] ?? '')}
                style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.line, borderRadius: selected ? radius.s : 0, backgroundColor: selected ? theme.accentSoft : 'transparent' }}
              >
                {chart.systems.map((s) => (
                  <Text key={s} style={[s === system ? typeScale.bodyStrong : typeScale.body, { flex: 1, textAlign: 'center', color: selected ? theme.accentInk : theme.ink, fontVariant: ['tabular-nums'] }]}>
                    {r[s]}
                  </Text>
                ))}
              </PressableScale>
            );
          })}
        </View>
        {chartId === 'womenShoes' || chartId === 'menShoes' ? <Note text={t('units.sizes.shoesNote')} /> : null}
      </SectionCard>
    </View>
  );
}
