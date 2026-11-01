// T136 Outfit planner: what to wear each day of one trip. The clothes are this trip's packing-list clothes (category
// guessed from each name, changeable) plus own pieces added here; each day card has a daytime outfit and an optional
// evening one, the day's weather from the forecast already saved on this phone (no network asked here), a laundry-day
// marker that starts the wear counts again, "Same as <day>" and Clear. Wear counts per piece with the hints "never
// worn in your plan: leave it at home?" and "worn 4+ days: pack a spare?". Logic in src/core/outfits.ts; the plan is
// stored on the trip (Trip.outfits) and travels in .satchel files. Timed FadeInView motion only (Reduce Motion
// respected there); colours from theme tokens; original garment art (src/ui/garments.tsx).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../../src/core/format.ts';
import { outfitTodayIndex } from '../../src/core/followups104.ts';
import { newId, type LocalDate, type Trip } from '../../src/core/model.ts';
import {
  addExtra,
  clearSlot,
  copyDayOutfit,
  dayPlan,
  GARMENT_CATS,
  guessGarment,
  outfitComplete,
  outfitDates,
  outfitToday,
  plannedCount,
  previousOutfitDay,
  readOutfits,
  removeExtra,
  setLaundryDay,
  setPiece,
  setPieceCat,
  slotPieces,
  sortPieces,
  stopForDate,
  wearCounts,
  wearHint,
  type OutfitDay,
  type OutfitSlot,
  type Piece,
  type TripOutfits,
  type Wear,
} from '../../src/core/outfits.ts';
import { dailySummary, dayOn, formatTemp, weatherStops, type TempUnit, type WeatherDay } from '../../src/core/weather.ts';
import { cachedForecast } from '../../src/native/weather.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { GarmentGlyph } from '../../src/ui/garments.tsx';
import { FadeInView, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';
import { catLabel, pieceList, usePieces } from '../../src/ui/outfits.tsx';
import { TripAccentBand } from '../../src/ui/TripAccentBand.tsx';
import { GROUP_ICON, useTempUnit } from '../../src/ui/WeatherCard.tsx';

export default function OutfitsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('outfits.title')} body={t('outfits.notFound')} />
      </Screen>
    );
  }
  return <Outfits trip={trip} />;
}

function useCommit() {
  const { t } = useApp();
  const { saveTrip } = useTrips();
  return useCallback(
    async (next: Trip) => {
      const ok = await saveTrip(next);
      if (!ok) Alert.alert(t('outfits.saveFailed.title'), t('outfits.saveFailed.body'));
      return ok;
    },
    [saveTrip, t],
  );
}

/** Cached daily weather per date (from forecasts already on the phone; nothing is fetched here). */
function useCachedWeather(trip: Trip, now: number): Map<LocalDate, WeatherDay> {
  const stops = useMemo(() => weatherStops(trip, now), [trip, now]);
  const dates = useMemo(() => outfitDates(trip), [trip]);
  const [byDate, setByDate] = useState<Map<LocalDate, WeatherDay>>(() => new Map());
  useEffect(() => {
    let live = true;
    void Promise.all(stops.map(async (s) => ({ s, r: await cachedForecast(s) }))).then((rows) => {
      if (!live) return;
      const days = new Map(rows.map(({ s, r }) => [s.key, r ? dailySummary(r.forecast, s.tz) : []]));
      const out = new Map<LocalDate, WeatherDay>();
      for (const d of dates) {
        const stop = stopForDate(stops, d);
        const w = stop ? dayOn(days.get(stop.key) ?? [], d) : null;
        if (w) out.set(d, w);
      }
      setByDate(out);
    });
    return () => {
      live = false;
    };
  }, [stops, dates]);
  return byDate;
}

function Outfits({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const commit = useCommit();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const pieces = usePieces(trip);
  const sorted = useMemo(() => sortPieces(pieces), [pieces]);
  const dates = useMemo(() => outfitDates(trip), [trip]);
  const o = useMemo(() => readOutfits(trip), [trip]);
  const today = useMemo(() => outfitToday(trip, now), [trip, now]);
  const counts = useMemo(() => wearCounts(o, dates, pieces), [o, dates, pieces]);
  const planned = plannedCount(o, dates, pieces);
  const weather = useCachedWeather(trip, now);
  const [unit] = useTempUnit();
  const [open, setOpen] = useState<LocalDate | null>(null);
  // T138: on open, scroll to today's card while the trip is on (once; not again when the day ticks over).
  const listRef = useRef<FlatList<LocalDate>>(null);
  const todayIndex = outfitTodayIndex(dates, today);
  const scrolled = useRef(false);
  const retries = useRef(0);
  useEffect(() => {
    if (todayIndex === null || scrolled.current) return;
    scrolled.current = true;
    const id = setTimeout(() => listRef.current?.scrollToIndex({ index: todayIndex, animated: false, viewOffset: space.l }), 0);
    return () => clearTimeout(id);
  }, [todayIndex]);

  const header = (
    <View style={{ gap: space.l, paddingBottom: space.l }}>
      <Stack.Screen options={{ title: t('outfits.route') }} />
      <TripAccentBand trip={trip} />
      <View accessible style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
          {t('outfits.title')}
        </Text>
        <Text style={[typeScale.bodyStrong, { color: theme.muted }]}>{trip.name}</Text>
      </View>
      {dates.length ? <ProgressBar progress={planned / dates.length} tone="accent" label={t('outfits.planned', { n: planned, total: dates.length })} /> : null}
      <HintsCard pieces={sorted} counts={counts} planned={planned} />
      <WardrobeCard trip={trip} pieces={sorted} counts={counts} commit={commit} />
      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('outfits.days.title')}
        </Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('outfits.days.sub')}</Text>
        {weather.size ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('outfits.weatherNote')}</Text> : null}
      </View>
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l }}
      keyboardShouldPersistTaps="handled"
      data={dates}
      keyExtractor={(d) => d}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Gap}
      initialNumToRender={Math.max(10, (todayIndex ?? 0) + 1)}
      onScrollToIndexFailed={(info) => {
        // Cards above today aren't measured yet: jump near it, then try again once they are.
        if (retries.current >= 3) return;
        retries.current += 1;
        listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: space.l }), 100);
      }}
      renderItem={({ item: date, index }) => (
        <DayCard
          trip={trip}
          o={o}
          date={date}
          index={index}
          today={date === today}
          pieces={sorted}
          weather={weather.get(date) ?? null}
          unit={unit}
          open={open === date}
          onOpen={(v) => setOpen(v ? date : null)}
          commit={commit}
        />
      )}
    />
  );
}

const Gap = () => <View style={{ height: space.m }} />;

// ---------------------------------------------------------------------------------------------------------- hints

function HintsCard({ pieces, counts, planned }: { pieces: Piece[]; counts: Map<string, Wear>; planned: number }) {
  const { t, theme } = useApp();
  const rows = pieces
    .map((p) => ({ p, w: counts.get(p.key), h: wearHint(counts.get(p.key), p, planned) }))
    .filter((r) => r.h);
  if (!rows.length) return null;
  return (
    <FadeInView>
      <SectionCard title={t('outfits.hints.title')} subtitle={t('outfits.hints.sub')} icon="bulb-outline" tone="warn">
        {rows.map(({ p, w, h }) => {
          const hint = h === 'never' ? t('outfits.hint.never') : t('outfits.hint.spare', { n: w?.peak ?? 0 });
          return (
            <View key={p.key} accessible accessibilityLabel={t('outfits.hint.line', { label: p.label, hint })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <GarmentGlyph cat={p.cat} size={28} />
              <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{t('outfits.hint.line', { label: p.label, hint })}</Text>
            </View>
          );
        })}
      </SectionCard>
    </FadeInView>
  );
}

// ---------------------------------------------------------------------------------------------------------- wardrobe

type Commit = (next: Trip) => Promise<boolean>;

function WardrobeCard({ trip, pieces, counts, commit }: { trip: Trip; pieces: Piece[]; counts: Map<string, Wear>; commit: Commit }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [own, setOwn] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const guess = own.trim() ? guessGarment(own) : null;
  const add = () => {
    if (!own.trim()) return;
    void commit(addExtra(trip, own, newId)).then((ok) => ok && setOwn(''));
  };
  const groups = GARMENT_CATS.map((c) => ({ c, list: pieces.filter((p) => p.cat === c) })).filter((g) => g.list.length);

  return (
    <SectionCard title={t('outfits.wardrobe.title')} subtitle={t('outfits.wardrobe.sub')} icon="shirt-outline" tone="accent">
      {pieces.length ? null : (
        <View style={{ gap: space.s }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('outfits.wardrobe.emptyTitle')}</Text>
          <Body muted>{t('outfits.wardrobe.emptyBody')}</Body>
          <Button label={t('outfits.wardrobe.openPacking')} hint={t('outfits.wardrobe.openPackingHint')} kind="secondary" icon="list-outline" onPress={() => router.push(`/packing/${trip.id}`)} />
        </View>
      )}
      {groups.map(({ c, list }) => (
        <View key={c} style={{ gap: space.xs }}>
          <Text style={[typeScale.caption, { color: theme.muted }]}>{t(`outfits.cats.${c}`)}</Text>
          {list.map((p) => (
            <FadeInView key={p.key}>
              <PieceRow trip={trip} piece={p} n={counts.get(p.key)?.total ?? 0} open={editing === p.key} onOpen={(v) => setEditing(v ? p.key : null)} commit={commit} />
            </FadeInView>
          ))}
        </View>
      ))}
      <TextField label={t('outfits.add.label')} value={own} onChange={setOwn} placeholder={t('outfits.add.placeholder')} />
      {guess && guess !== 'skip' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <GarmentGlyph cat={guess} size={24} />
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('outfits.add.guess', { cat: catLabel(t, guess) })}</Text>
        </View>
      ) : null}
      <Button label={t('outfits.add.button')} hint={t('outfits.add.hint')} kind="secondary" icon="add" onPress={add} />
    </SectionCard>
  );
}

function PieceRow({ trip, piece, n, open, onOpen, commit }: { trip: Trip; piece: Piece; n: number; open: boolean; onOpen: (v: boolean) => void; commit: Commit }) {
  const { t, theme } = useApp();
  return (
    <View style={{ gap: space.s }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('outfits.piece.a11y', { label: piece.label, cat: catLabel(t, piece.cat), n })}
        accessibilityHint={t('outfits.piece.hint')}
        accessibilityState={{ expanded: open }}
        onPress={() => onOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <GarmentGlyph cat={piece.cat} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.body, { color: theme.ink }]}>{piece.label}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{piece.source === 'own' ? t('outfits.piece.own') : t('outfits.piece.fromPacking')}</Text>
        </View>
        <View style={{ minWidth: 36, paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: n ? theme.accentSoft : theme.paper, alignItems: 'center' }}>
          <Text style={[typeScale.caption, { color: n ? theme.accentInk : theme.muted, fontVariant: ['tabular-nums'] }]}>{t('outfits.piece.worn', { n })}</Text>
        </View>
      </PressableScale>
      {open ? (
        <FadeInView style={{ gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.paper }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('outfits.piece.kindTitle', { label: piece.label })}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup">
            {GARMENT_CATS.map((c) => (
              <Chip
                key={c}
                label={catLabel(t, c)}
                a11yLabel={t('outfits.piece.kindA11y', { cat: catLabel(t, c), label: piece.label })}
                selected={piece.cat === c}
                icon={<GarmentGlyph cat={c} size={22} />}
                onPress={() => void commit(setPieceCat(trip, piece.key, c))}
              />
            ))}
          </View>
          {piece.source === 'own' ? (
            <Button label={t('outfits.piece.remove')} hint={t('outfits.piece.removeHint')} kind="quiet" icon="trash-outline" onPress={() => void commit(removeExtra(trip, piece.key)).then((ok) => ok && onOpen(false))} />
          ) : null}
          <Button label={t('outfits.piece.close')} hint={t('outfits.piece.closeHint')} kind="quiet" onPress={() => onOpen(false)} />
        </FadeInView>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------- days

type DayProps = {
  trip: Trip;
  o: TripOutfits | null;
  date: LocalDate;
  index: number;
  today: boolean;
  pieces: Piece[];
  weather: WeatherDay | null;
  unit: TempUnit;
  open: boolean;
  onOpen: (v: boolean) => void;
  commit: Commit;
};

const DayCard = memo(function DayCard({ trip, o, date, index, today, pieces, weather, unit, open, onOpen, commit }: DayProps) {
  const { t, theme, lang } = useApp();
  const plan = dayPlan(o, date);
  const day = slotPieces(plan, 'day', pieces);
  const evening = slotPieces(plan, 'evening', pieces);
  const label = t('outfits.day.label', { n: index + 1, date: formatDay(date, lang) });
  const sky = weather ? t(weather.group ? `weather.group.${weather.group}` : 'weather.group.unknown') : '';
  const high = weather ? formatTemp(weather.high, unit) : '';
  const low = weather ? formatTemp(weather.low, unit) : '';
  const ready = outfitComplete(day);
  const spoken = [
    today ? t('outfits.day.today') : '',
    t('outfits.day.a11y', { label, day: day.length ? pieceList(t, day) : t('outfits.slot.none'), evening: evening.length ? pieceList(t, evening) : t('outfits.slot.none') }),
    weather ? t('outfits.day.weatherA11y', { sky, high, low }) : '',
    ready ? t('outfits.day.ready') : '',
    plan?.laundry ? t('outfits.day.laundry') : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={{
        borderRadius: radius.l,
        padding: space.l,
        gap: space.s,
        backgroundColor: theme.card,
        borderWidth: today ? 2 : 1,
        borderColor: today ? theme.accent : theme.line,
      }}
    >
      <View accessible accessibilityLabel={spoken} style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>{label}</Text>
          {today ? (
            <View style={{ borderRadius: radius.pill, backgroundColor: theme.accentSoft, paddingHorizontal: space.m, paddingVertical: 2 }}>
              <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('outfits.day.today')}</Text>
            </View>
          ) : null}
        </View>
        {weather ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {weather.group ? <Ionicons name={GROUP_ICON[weather.group]} size={18} color={theme.sea} /> : null}
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('outfits.day.weather', { sky, high, low })}</Text>
          </View>
        ) : null}
        <SlotLine slot="day" pieces={day} />
        {evening.length ? <SlotLine slot="evening" pieces={evening} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {ready ? <Tag icon="sparkles-outline" text={t('outfits.day.ready')} tone="ok" /> : null}
          {plan?.laundry ? <Tag icon="water-outline" text={t('outfits.day.laundry')} tone="sea" /> : null}
        </View>
      </View>
      {open ? (
        <DayPicker trip={trip} o={o} date={date} plan={plan} pieces={pieces} onClose={() => onOpen(false)} commit={commit} />
      ) : (
        <Button label={t('outfits.day.choose')} hint={t('outfits.day.chooseHint')} kind={day.length ? 'quiet' : 'secondary'} icon="shirt-outline" onPress={() => onOpen(true)} />
      )}
    </View>
  );
});

function Tag({ icon, text, tone }: { icon: 'sparkles-outline' | 'water-outline'; text: string; tone: 'ok' | 'sea' }) {
  const { theme } = useApp();
  const fg = tone === 'ok' ? theme.ok : theme.sea;
  const bg = tone === 'ok' ? theme.okSoft : theme.seaSoft;
  return (
    <FadeInView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, backgroundColor: bg, paddingHorizontal: space.m, paddingVertical: 2 }}>
        <Ionicons name={icon} size={14} color={fg} />
        <Text style={[typeScale.caption, { color: theme.ink }]}>{text}</Text>
      </View>
    </FadeInView>
  );
}

function SlotLine({ slot, pieces }: { slot: OutfitSlot; pieces: Piece[] }) {
  const { t, theme } = useApp();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[typeScale.caption, { color: theme.muted }]}>{t(slot === 'day' ? 'outfits.slot.day' : 'outfits.slot.evening')}</Text>
      {pieces.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {pieces.map((p) => (
            <FadeInView key={p.key} style={{ alignItems: 'center', width: 72, gap: 2 }}>
              <GarmentGlyph cat={p.cat} size={40} />
              <Text numberOfLines={2} style={[typeScale.small, { color: theme.ink, textAlign: 'center' }]}>
                {p.label}
              </Text>
            </FadeInView>
          ))}
        </View>
      ) : (
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('outfits.slot.empty')}</Text>
      )}
    </View>
  );
}

function DayPicker({ trip, o, date, plan, pieces, onClose, commit }: { trip: Trip; o: TripOutfits | null; date: LocalDate; plan: OutfitDay | null; pieces: Piece[]; onClose: () => void; commit: Commit }) {
  const { t, theme, lang } = useApp();
  const [slot, setSlot] = useState<OutfitSlot>('day');
  const chosen = new Set(plan?.[slot] ?? []);
  const prev = previousOutfitDay(o, date, pieces);
  const laundry = plan?.laundry === true;
  return (
    <FadeInView style={{ gap: space.m, paddingTop: space.s, borderTopWidth: 1, borderColor: theme.line }}>
      <View style={{ flexDirection: 'row', gap: space.s }} accessibilityRole="radiogroup">
        {(['day', 'evening'] as const).map((s) => {
          const name = t(s === 'day' ? 'outfits.slot.day' : 'outfits.slot.evening');
          return <Chip key={s} label={name} a11yLabel={t('outfits.slot.a11y', { slot: name })} selected={slot === s} onPress={() => setSlot(s)} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {pieces.map((p) => {
          const on = chosen.has(p.key);
          return (
            <PressableScale
              key={p.key}
              accessibilityRole="checkbox"
              accessibilityLabel={t('outfits.pick.a11y', { label: p.label, cat: catLabel(t, p.cat) })}
              accessibilityHint={t('outfits.pick.hint')}
              accessibilityState={{ checked: on }}
              onPress={() => void commit(setPiece(trip, date, slot, p.key, !on))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                minHeight: TOUCH,
                paddingHorizontal: space.m,
                borderRadius: radius.pill,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? theme.accent : theme.line,
                backgroundColor: on ? theme.accentSoft : theme.cardRaised,
              }}
            >
              <GarmentGlyph cat={p.cat} size={26} />
              <Text style={[typeScale.bodyStrong, { color: on ? theme.accentInk : theme.ink }]}>{p.label}</Text>
              {on ? <Ionicons name="checkmark" size={16} color={theme.accentInk} /> : null}
            </PressableScale>
          );
        })}
      </View>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={t('outfits.day.laundry')}
        accessibilityHint={t('outfits.day.laundryHint')}
        accessibilityState={{ checked: laundry }}
        onPress={() => void commit(setLaundryDay(trip, date, !laundry))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <Ionicons name={laundry ? 'checkbox' : 'square-outline'} size={24} color={laundry ? theme.sea : theme.muted} />
        <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{laundry ? t('outfits.day.laundryOn') : t('outfits.day.laundry')}</Text>
      </PressableScale>
      {prev ? (
        <Button label={t('outfits.day.same', { date: formatDay(prev.date, lang) })} hint={t('outfits.day.sameHint')} kind="quiet" icon="copy-outline" onPress={() => void commit(copyDayOutfit(trip, prev.date, date))} />
      ) : null}
      {chosen.size ? <Button label={t('outfits.day.clear')} hint={t('outfits.day.clearHint')} kind="quiet" icon="close-outline" onPress={() => void commit(clearSlot(trip, date, slot))} /> : null}
      <Button label={t('outfits.day.done')} hint={t('outfits.day.doneHint')} onPress={onClose} />
    </FadeInView>
  );
}

