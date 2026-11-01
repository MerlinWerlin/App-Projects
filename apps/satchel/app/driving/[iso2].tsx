// T122 Driving abroad guide (src/core/driving.ts, src/content/driving.json). Reached from the trip screen's
// "Drive on the LEFT / RIGHT" banner, the arrival card ("Driving here"), the customs guide country screen and the
// rental car checklist.
// - Country: the route's iso2 when the guide covers it, else the list. A switcher shows the countries of the trip's
//   car bookings as chips (?tripId=, else the trip on now / next) and a searchable list of every covered country.
// - A big side-of-the-road banner, the speed unit with common limits in both units, then the sections (permit,
//   seat belts / child seats, phones, fuel words, tolls / vignettes, good to know); an unsure section says
//   "Not sure - check locally".
// - The trip's car bookings in this country link to their rental checklist.
// - Always the disclaimer ("verify locally ... Not legal advice"), the checked date, source hosts and a re-check
//   marker on less certain rows. Free feature, works offline. Tokens only, timed motion only, 48 pt targets.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { carBookings, carCountries, findDriving, guideSections, limitPairs, searchDriving, sourceHosts, type DrivingBanner, type DrivingRow, type GuideSection } from '../../src/core/driving.ts';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { focusTrip } from '../../src/core/glance.ts';
import type { Trip } from '../../src/core/model.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { DRIVING_TABLE, sideIcon, sideKey, useDrivingBanners } from '../../src/ui/driving.tsx';
import { FadeInView, HeroHeader, IconBadge, SectionCard, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, TextField } from '../../src/ui/kit.tsx';

const MAX_LIST = 30;

const SECTION_ICONS: Record<GuideSection, IconName> = {
  idp: 'id-card-outline',
  seatbelts: 'shield-checkmark-outline',
  phone: 'phone-portrait-outline',
  fuel: 'color-fill-outline',
  tolls: 'cash-outline',
  note: 'bulb-outline',
};
const SECTION_KEYS: Record<GuideSection, Key> = {
  idp: 'driving.section.idp',
  seatbelts: 'driving.section.seatbelts',
  phone: 'driving.section.phone',
  fuel: 'driving.section.fuel',
  tolls: 'driving.section.tolls',
  note: 'driving.section.note',
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const NO_TRIP: Trip = { id: '', name: '', startDate: '', endDate: '', homeTz: 'UTC', items: [], createdAt: '' };

export default function DrivingScreen() {
  const params = useLocalSearchParams<{ iso2?: string; tripId?: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const tripId = one(params.tripId);
  const trip = trips.find((x) => x.id === tripId) ?? focusTrip(trips, today) ?? null;
  const banners = useDrivingBanners(trip ?? NO_TRIP);

  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const asked = one(params.iso2);
  const row = findDriving(DRIVING_TABLE, picked ?? asked);
  const notCovered = !picked && !!asked && !row && asked.trim().length === 2;

  const choose = (code: string) => {
    setPicked(code);
    setListOpen(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <FadeInView>
        <HeroHeader tone="trips" illustration="none" compact title={row ? row.country : t('driving.title')} subtitle={t('driving.subtitle')} />
      </FadeInView>
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
        </View>
        <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('driving.disclaimer')}</Text>
      </View>

      <Switcher banners={banners} selected={row?.iso2 ?? null} open={listOpen || !row} canClose={!!row} onToggle={() => setListOpen((v) => !v)} onPick={choose} />

      {row ? (
        <FadeInView key={row.iso2} style={{ gap: space.l }}>
          <Guide row={row} trip={trip} />
        </FadeInView>
      ) : (
        <EmptyState art="compass" title={t('driving.noCountry')} body={notCovered ? t('driving.notCovered') : t('driving.noCountryBody')} />
      )}
    </ScrollView>
  );
}

function Switcher({
  banners,
  selected,
  open,
  canClose,
  onToggle,
  onPick,
}: {
  banners: DrivingBanner[];
  selected: string | null;
  open: boolean;
  canClose: boolean;
  onToggle: () => void;
  onPick: (iso: string) => void;
}) {
  const { t, theme } = useApp();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchDriving(DRIVING_TABLE, query), [query]);
  return (
    <View style={{ gap: space.s }}>
      {banners.length > 1 || (banners.length === 1 && banners[0].iso2 !== selected) ? (
        <View style={{ gap: space.s }}>
          <View accessibilityRole="header">
            <Label>{t('driving.onThisTrip')}</Label>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('driving.onThisTrip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {banners.map((b) => (
              <Chip
                key={b.iso2}
                label={b.country}
                a11yLabel={t('driving.tripCountryA11y', { country: b.country })}
                hint={t('driving.tripCountryHint', { country: b.country })}
                selected={b.iso2 === selected}
                onPress={() => onPick(b.iso2)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {canClose ? <Button kind="secondary" icon="search-outline" label={open ? t('driving.listDone') : t('driving.change')} hint={open ? undefined : t('driving.changeHint')} onPress={onToggle} /> : null}
      {open ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('driving.search')} value={query} onChange={setQuery} placeholder={t('driving.searchPlaceholder')} autoCapitalize="none" />
          {results.length === 0 ? <Body muted>{t('driving.noMatch', { q: query.trim() })}</Body> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('driving.country')} style={{ gap: space.s }}>
            {results.slice(0, MAX_LIST).map((r) => {
              const on = r.iso2 === selected;
              return (
                <PressableScale
                  key={r.iso2}
                  accessibilityRole="radio"
                  accessibilityLabel={r.country}
                  accessibilityHint={t('driving.pickHint', { country: r.country })}
                  accessibilityState={{ selected: on, checked: on }}
                  onPress={() => {
                    setQuery('');
                    onPick(r.iso2);
                  }}
                  style={{
                    minHeight: TOUCH,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.m,
                    paddingHorizontal: space.l,
                    borderRadius: radius.m,
                    borderWidth: 1,
                    borderColor: on ? theme.accent : theme.line,
                    backgroundColor: on ? theme.accentSoft : theme.card,
                  }}
                >
                  <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{r.country}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{t(sideKey(r.side))}</Text>
                </PressableScale>
              );
            })}
          </View>
          {results.length > MAX_LIST ? <Body muted>{t('driving.more', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}
    </View>
  );
}

function Guide({ row, trip }: { row: DrivingRow; trip: Trip | null }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const sections = useMemo(() => guideSections(row), [row]);
  const unit = t(row.speed === 'mph' ? 'driving.unit.mph' : 'driving.unit.kmh');
  const otherUnit = t(row.speed === 'mph' ? 'driving.unit.kmh' : 'driving.unit.mph');
  const pairs = limitPairs(row.speed).map((p) => t('driving.speed.pair', { value: p.value, unit, other: p.other, otherUnit }));
  const cars = useMemo(() => (trip ? carBookings(trip).filter((i) => carCountries(i).includes(row.iso2)) : []), [trip, row.iso2]);
  const sideTitle = t(sideKey(row.side));
  const sideBody = t(row.side === 'left' ? 'driving.side.leftBody' : 'driving.side.rightBody');
  return (
    <>
      {row.recheck ? (
        <View
          accessible
          accessibilityLabel={t('driving.recheck')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.warnSoft }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="alert-circle-outline" size={18} color={theme.warn} />
          </View>
          <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('driving.recheck')}</Text>
        </View>
      ) : null}

      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${sideTitle}. ${sideBody}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: theme.warnSoft, borderLeftWidth: 4, borderLeftColor: theme.warn }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 2 }}>
          <Ionicons name={sideIcon(row.side)} size={28} color={theme.warn} />
          <Ionicons name="car-outline" size={28} color={theme.warn} />
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[typeScale.displayM, { color: theme.ink }]}>{sideTitle}</Text>
          <Text style={[typeScale.small, { color: theme.ink }]}>{sideBody}</Text>
        </View>
      </View>

      <SectionCard icon="speedometer-outline" tone="sea" title={t('driving.speed.title')} subtitle={t(row.speed === 'mph' ? 'driving.speed.mph' : 'driving.speed.kmh')}>
        <View accessible accessibilityLabel={t('driving.speed.pairsA11y', { list: pairs.join(', ') })} style={{ gap: space.xs }}>
          {pairs.map((p) => (
            <Text key={p} style={[typeScale.body, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {p}
            </Text>
          ))}
        </View>
      </SectionCard>

      <SectionCard icon="car-outline" tone="warn" title={t('driving.title')} subtitle={row.country}>
        <View style={{ gap: space.m }}>
          {sections.map((s, i) => (
            <View key={s.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingTop: i ? space.m : 0 }}>
              <SectionRow row={row} id={s.id} known={s.known} />
            </View>
          ))}
        </View>
      </SectionCard>

      {cars.length ? (
        <SectionCard icon="key-outline" tone="teal" title={t('driving.cars.title')}>
          {cars.map((c) => (
            <Button
              key={c.id}
              kind="secondary"
              icon="checkbox-outline"
              label={t('driving.cars.open', { name: c.place?.name?.trim() || c.title })}
              hint={t('driving.cars.openHint')}
              onPress={() => router.push({ pathname: '/rental/[itemId]', params: { itemId: c.id } })}
            />
          ))}
        </SectionCard>
      ) : null}

      <Text style={[typeScale.small, { color: theme.muted }]}>{t('driving.verify')}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('driving.checked', { hosts: sourceHosts(row).join(', '), date: formatDay(row.checked, lang) })}</Text>
    </>
  );
}

function SectionRow({ row, id, known }: { row: DrivingRow; id: GuideSection; known: boolean }) {
  const { t, theme } = useApp();
  const title = t(SECTION_KEYS[id]);
  let lines: string[] = [];
  let foot: string | null = null;
  let tone: Tone = 'sea';
  if (!known) {
    tone = 'warn';
    lines = [t('driving.notSure')];
    if (id === 'idp') foot = t('driving.idp.foot');
  } else if (id === 'idp' && row.idp) {
    tone = row.idp === 'often' || row.idp === 'not_accepted' ? 'warn' : 'ok';
    lines = [t(`driving.idp.${row.idp}` as Key)];
    foot = t('driving.idp.foot');
  } else if (id === 'fuel' && row.fuel) {
    lines = [t('driving.fuel.petrol', { word: row.fuel.petrol }), t('driving.fuel.diesel', { word: row.fuel.diesel })];
    foot = t('driving.fuel.foot');
  } else if (id !== 'idp' && id !== 'fuel') {
    const v = row[id];
    lines = v ? [v] : [];
  }
  const spoken = [...lines, foot].filter(Boolean).join('. ');
  return (
    <View accessible accessibilityLabel={t('driving.sectionA11y', { title, text: spoken })} style={{ flexDirection: 'row', gap: space.m, minHeight: TOUCH }}>
      <IconBadge name={SECTION_ICONS[id]} tone={tone} size="s" />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={[typeScale.caption, { color: theme.muted }]}>{title}</Text>
        {lines.map((l, i) => (
          <Text key={i} style={[typeScale.body, { color: known ? theme.ink : theme.warn }]}>
            {l}
          </Text>
        ))}
        {foot ? <Text style={[typeScale.small, { color: theme.muted }]}>{foot}</Text> : null}
      </View>
    </View>
  );
}
