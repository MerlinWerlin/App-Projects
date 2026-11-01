// T115 Local customs guide (src/core/customs.ts, src/content/customs.json). Reached from the arrival card, the
// Emergency tab (after the country essentials card) and the trip readiness card ("Read the customs for Japan").
// - Country: the route's iso2 when the guide covers it, else the list. A switcher shows the trip's covered
//   countries as chips (?tripId=, else the trip on now / next) and a searchable list of every covered country.
// - Sections with icons, in the core's order (greetings, tap water, shoes, dress, photos, gestures, out and about,
//   alcohol / smoking, good to know); a section the build was not sure about says "Not sure - check locally".
// - Always "General guidance only ... verify locally. Not legal advice.", the checked date and source hosts, and a
//   re-check marker on less certain rows.
// Free feature, works offline. Tokens only, timed motion only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeCountryFor } from '../../src/core/arrival.ts';
import { findCustoms, pickCustomsCountry, searchCustoms, sectionsFor, sourceHosts, tripCustomsCountries, type CustomsRow, type Section, type SectionId, type Water } from '../../src/core/customs.ts';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { focusTrip } from '../../src/core/glance.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { CUSTOMS_TABLE } from '../../src/ui/CustomsLink.tsx';
import { DrivingLink } from '../../src/ui/driving.tsx';
import { FadeInView, HeroHeader, IconBadge, SectionCard, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { useHomeCountry } from '../../src/ui/HomeCountryPicker.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, TextField } from '../../src/ui/kit.tsx';

const MAX_LIST = 30;

const SECTION_ICONS: Record<SectionId, IconName> = {
  greetings: 'chatbubbles-outline',
  water: 'water-outline',
  shoes: 'home-outline',
  dress: 'shirt-outline',
  photos: 'camera-outline',
  // Ionicons 7 names (hand-left-outline and shirt-outline ship with @expo/vector-icons 15); the rest are used elsewhere.
  gestures: 'hand-left-outline',
  public: 'walk-outline',
  alcohol: 'flask-outline',
  good_to_know: 'bulb-outline',
};

const SECTION_KEYS: Record<SectionId, Key> = {
  greetings: 'customs.section.greetings',
  water: 'customs.section.water',
  shoes: 'customs.section.shoes',
  dress: 'customs.section.dress',
  photos: 'customs.section.photos',
  gestures: 'customs.section.gestures',
  public: 'customs.section.public',
  alcohol: 'customs.section.alcohol',
  good_to_know: 'customs.section.good_to_know',
};
const WATER_KEYS: Record<Water, Key> = { yes: 'customs.water.yes', no: 'customs.water.no', varies: 'customs.water.varies' };
const WATER_TONES: Record<Water, Tone> = { yes: 'ok', no: 'danger', varies: 'warn' };

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default function CustomsScreen() {
  const params = useLocalSearchParams<{ iso2?: string; tripId?: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const { homeIso } = useHomeCountry();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const tripId = one(params.tripId);
  const trip = trips.find((x) => x.id === tripId) ?? focusTrip(trips, today) ?? null;
  const tripRows = useMemo(() => (trip ? tripCustomsCountries(trip, homeCountryFor(trip, homeIso), CUSTOMS_TABLE) : []), [trip, homeIso]);

  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const iso = picked ?? pickCustomsCountry(CUSTOMS_TABLE, [one(params.iso2)]);
  const row = findCustoms(CUSTOMS_TABLE, iso);
  const asked = one(params.iso2);
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
        <HeroHeader tone="emergency" illustration="none" compact title={row ? row.country : t('customs.title')} subtitle={t('customs.subtitle')} />
      </FadeInView>
      <Disclaimer />

      <Switcher tripRows={tripRows} selected={row?.iso2 ?? null} open={listOpen || !row} canClose={!!row} onToggle={() => setListOpen((v) => !v)} onPick={choose} />

      {row ? (
        <FadeInView key={row.iso2} style={{ gap: space.l }}>
          <Guide row={row} />
          {/* T122: driving notes for the same country. */}
          <DrivingLink iso2={row.iso2} tripId={trip?.id} />
        </FadeInView>
      ) : (
        <EmptyState art="compass" title={t('customs.noCountry')} body={notCovered ? t('customs.notCovered') : t('customs.noCountryBody')} />
      )}
    </ScrollView>
  );
}

function Disclaimer() {
  const { t, theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
        <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
      </View>
      <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('customs.disclaimer')}</Text>
    </View>
  );
}

/** Trip-country chips and a searchable list of the covered countries (open when nothing is chosen). */
function Switcher({
  tripRows,
  selected,
  open,
  canClose,
  onToggle,
  onPick,
}: {
  tripRows: CustomsRow[];
  selected: string | null;
  open: boolean;
  canClose: boolean;
  onToggle: () => void;
  onPick: (iso: string) => void;
}) {
  const { t, theme } = useApp();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCustoms(CUSTOMS_TABLE, query), [query]);
  return (
    <View style={{ gap: space.s }}>
      {tripRows.length > 1 || (tripRows.length === 1 && tripRows[0].iso2 !== selected) ? (
        <View style={{ gap: space.s }}>
          <View accessibilityRole="header">
            <Label>{t('customs.onThisTrip')}</Label>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('customs.onThisTrip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {tripRows.map((r) => (
              <Chip
                key={r.iso2}
                label={r.country}
                a11yLabel={t('customs.tripCountryA11y', { country: r.country })}
                hint={t('customs.tripCountryHint', { country: r.country })}
                selected={r.iso2 === selected}
                onPress={() => onPick(r.iso2)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {canClose ? <Button kind="secondary" icon="search-outline" label={open ? t('customs.listDone') : t('customs.change')} hint={open ? undefined : t('customs.changeHint')} onPress={onToggle} /> : null}
      {open ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('customs.search')} value={query} onChange={setQuery} placeholder={t('customs.searchPlaceholder')} autoCapitalize="none" />
          {results.length === 0 ? <Body muted>{t('customs.noMatch', { q: query.trim() })}</Body> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('customs.country')} style={{ gap: space.s }}>
            {results.slice(0, MAX_LIST).map((r) => {
              const on = r.iso2 === selected;
              return (
                <PressableScale
                  key={r.iso2}
                  accessibilityRole="radio"
                  accessibilityLabel={r.country}
                  accessibilityHint={t('customs.pickHint', { country: r.country })}
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
                    paddingHorizontal: space.l,
                    borderRadius: radius.m,
                    borderWidth: 1,
                    borderColor: on ? theme.accent : theme.line,
                    backgroundColor: on ? theme.accentSoft : theme.card,
                  }}
                >
                  <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{r.country}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{r.iso2}</Text>
                </PressableScale>
              );
            })}
          </View>
          {results.length > MAX_LIST ? <Body muted>{t('customs.more', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}
    </View>
  );
}

function Guide({ row }: { row: CustomsRow }) {
  const { t, theme, lang } = useApp();
  const sections = useMemo(() => sectionsFor(row), [row]);
  return (
    <>
      {row.recheck ? (
        <View
          accessible
          accessibilityLabel={t('customs.recheck')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.warnSoft }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="alert-circle-outline" size={18} color={theme.warn} />
          </View>
          <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('customs.recheck')}</Text>
        </View>
      ) : null}
      <SectionCard icon="people-outline" tone="teal" title={t('customs.title')} subtitle={row.country}>
        <View style={{ gap: space.m }}>
          {sections.map((s, i) => (
            <View key={s.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingTop: i ? space.m : 0 }}>
              <SectionRow section={s} />
            </View>
          ))}
        </View>
      </SectionCard>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('customs.verify')}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('customs.checked', { hosts: sourceHosts(row).join(', '), date: formatDay(row.checked, lang) })}</Text>
    </>
  );
}

function SectionRow({ section }: { section: Section }) {
  const { t, theme } = useApp();
  const title = t(SECTION_KEYS[section.id]);
  let tone: Tone = 'sea';
  let lines: string[] = [];
  let strong: string | null = null;
  if (!section.known) {
    tone = 'warn';
    lines = [t('customs.notSure')];
  } else if (section.id === 'water' && 'water' in section) {
    tone = WATER_TONES[section.water];
    strong = t(WATER_KEYS[section.water]);
    lines = section.note ? [section.note] : [];
  } else if ('lines' in section) {
    lines = section.lines;
  } else if ('text' in section) {
    lines = [section.text];
  }
  const spoken = [strong, ...lines].filter(Boolean).join('. ');
  const bullets = section.id === 'good_to_know' && section.known;
  return (
    <View accessible accessibilityLabel={t('customs.sectionA11y', { title, text: spoken })} style={{ flexDirection: 'row', gap: space.m, minHeight: TOUCH }}>
      <IconBadge name={SECTION_ICONS[section.id]} tone={tone} size="s" />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={[typeScale.caption, { color: theme.muted }]}>{title}</Text>
        {strong ? <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{strong}</Text> : null}
        {lines.map((l, i) => (
          <Text key={i} style={[typeScale.body, { color: section.known ? theme.ink : theme.warn }]}>
            {bullets ? `• ${l}` : l}
          </Text>
        ))}
      </View>
    </View>
  );
}
