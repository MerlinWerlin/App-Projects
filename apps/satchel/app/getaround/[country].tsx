// T132 Getting around (src/core/getaround.ts, src/content/getaround.json). Reached from the arrival card, the trip
// screen (Getting around card) and the Map tab.
// - Country: the route's code when the guide covers it, else the list. Chips for the trip's covered countries
//   (?tripId=, else the trip on now / next) and a searchable list of every covered country. A country the guide lists
//   as not yet covered says so instead of guessing.
// - Sections with icons in the core's order (how transit works, cards and tickets, tap your bank card, hours, taxis,
//   app-based rides, airport); a section not on the pages read says "Not sure - check locally".
// - Links: tipping for taxi drivers (when the tipping table has the country) and the station / address phrase cards
//   in the country's language (when the phrase table has one).
// - Always the disclaimer, the area checked, the checked date and source hosts, and the re-check reason when marked.
// Free feature, bundled data, works offline. Tokens only, timed motion only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { findGetaround, notCoveredEntry, pickGetaroundCountry, searchGetaround, sectionsFor, sourceHosts, USEFUL_PHRASES, type Contactless, type GetaroundRow, type Section, type SectionId, type UsefulPhrase } from '../../src/core/getaround.ts';
import { focusTrip } from '../../src/core/glance.ts';
import { languageForCountry } from '../../src/core/phrases.ts';
import { hasTipping } from '../../src/core/tipping.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { GETAROUND_TABLE, useTripGetaround } from '../../src/ui/getaround.tsx';
import { FadeInView, HeroHeader, IconBadge, SectionCard, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, TextField } from '../../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE } from '../../src/ui/phrases.ts';

const MAX_LIST = 40;

const SECTION_ICONS: Record<SectionId, IconName> = {
  transit: 'train-outline',
  tickets: 'card-outline',
  contactless: 'wifi-outline',
  hours: 'time-outline',
  taxi: 'car-outline',
  rides: 'phone-portrait-outline',
  airport: 'airplane-outline',
};

const SECTION_KEYS: Record<SectionId, Key> = {
  transit: 'getaround.section.transit',
  tickets: 'getaround.section.tickets',
  contactless: 'getaround.section.contactless',
  hours: 'getaround.section.hours',
  taxi: 'getaround.section.taxi',
  rides: 'getaround.section.rides',
  airport: 'getaround.section.airport',
};
const CONTACTLESS_KEYS: Record<Contactless, Key> = { yes: 'getaround.contactless.yes', some: 'getaround.contactless.some', no: 'getaround.contactless.no' };
const CONTACTLESS_TONES: Record<Contactless, Tone> = { yes: 'ok', some: 'warn', no: 'danger' };
const WORD_KEYS: Record<UsefulPhrase, Key> = { station: 'getaround.word.station', address: 'getaround.word.address' };

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default function GetaroundScreen() {
  const params = useLocalSearchParams<{ country?: string; tripId?: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const tripId = one(params.tripId);
  const trip = trips.find((x) => x.id === tripId) ?? focusTrip(trips, today) ?? null;
  const tripRows = useTripGetaround(trip);

  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const asked = one(params.country);
  const iso = picked ?? pickGetaroundCountry(GETAROUND_TABLE, [asked]);
  const row = findGetaround(GETAROUND_TABLE, iso);
  const notYet = !picked && !row ? notCoveredEntry(GETAROUND_TABLE, asked) : null;
  const notCovered = !picked && !!asked && !row && !notYet && asked.trim().length === 2;

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
        <HeroHeader tone="map" illustration="none" compact title={row ? row.country : t('getaround.title')} subtitle={t('getaround.subtitle')} />
      </FadeInView>
      <Disclaimer />

      <Switcher tripRows={tripRows} selected={row?.iso2 ?? null} open={listOpen || !row} canClose={!!row} onToggle={() => setListOpen((v) => !v)} onPick={choose} />

      {row ? (
        <FadeInView key={row.iso2} style={{ gap: space.l }}>
          <Guide row={row} tripId={trip?.id} />
        </FadeInView>
      ) : (
        <EmptyState
          art="compass"
          title={t('getaround.noCountry')}
          body={notYet ? t('getaround.notYet', { country: notYet.country }) : notCovered ? t('getaround.notCovered') : t('getaround.noCountryBody')}
        />
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
      <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('getaround.disclaimer')}</Text>
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
  tripRows: GetaroundRow[];
  selected: string | null;
  open: boolean;
  canClose: boolean;
  onToggle: () => void;
  onPick: (iso: string) => void;
}) {
  const { t, theme } = useApp();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchGetaround(GETAROUND_TABLE, query), [query]);
  return (
    <View style={{ gap: space.s }}>
      {tripRows.length > 1 || (tripRows.length === 1 && tripRows[0].iso2 !== selected) ? (
        <View style={{ gap: space.s }}>
          <View accessibilityRole="header">
            <Label>{t('getaround.onThisTrip')}</Label>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('getaround.onThisTrip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {tripRows.map((r) => (
              <Chip
                key={r.iso2}
                label={r.country}
                a11yLabel={t('getaround.tripCountryA11y', { country: r.country })}
                hint={t('getaround.tripCountryHint', { country: r.country })}
                selected={r.iso2 === selected}
                onPress={() => onPick(r.iso2)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {canClose ? <Button kind="secondary" icon="search-outline" label={open ? t('getaround.listDone') : t('getaround.change')} hint={open ? undefined : t('getaround.changeHint')} onPress={onToggle} /> : null}
      {open ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('getaround.search')} value={query} onChange={setQuery} placeholder={t('getaround.searchPlaceholder')} autoCapitalize="none" />
          {results.length === 0 ? <Body muted>{t('getaround.noMatch', { q: query.trim() })}</Body> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('getaround.country')} style={{ gap: space.s }}>
            {results.slice(0, MAX_LIST).map((r) => {
              const on = r.iso2 === selected;
              return (
                <PressableScale
                  key={r.iso2}
                  accessibilityRole="radio"
                  accessibilityLabel={`${r.country}, ${r.area}`}
                  accessibilityHint={t('getaround.pickHint', { country: r.country })}
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
                  <Text style={[typeScale.small, { color: theme.muted }]}>{r.area}</Text>
                </PressableScale>
              );
            })}
          </View>
          {results.length > MAX_LIST ? <Body muted>{t('getaround.more', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}
    </View>
  );
}

function Guide({ row, tripId }: { row: GetaroundRow; tripId?: string }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const sections = useMemo(() => sectionsFor(row), [row]);
  const phraseLang = languageForCountry(PHRASE_TABLE, row.iso2);
  return (
    <>
      {row.recheck ? (
        <View
          accessible
          accessibilityLabel={t('getaround.recheck', { reason: row.recheck_reason ?? '' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.warnSoft }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="alert-circle-outline" size={18} color={theme.warn} />
          </View>
          <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('getaround.recheck', { reason: row.recheck_reason ?? '' })}</Text>
        </View>
      ) : null}
      <SectionCard icon="train-outline" tone="sea" title={t('getaround.title')} subtitle={t('getaround.area', { area: row.area })}>
        <View style={{ gap: space.m }}>
          {sections.map((s, i) => (
            <View key={s.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingTop: i ? space.m : 0 }}>
              <SectionRow section={s} />
            </View>
          ))}
        </View>
      </SectionCard>

      {hasTipping(row.iso2) ? (
        <Button
          kind="secondary"
          icon="happy-outline"
          label={t('getaround.tipping')}
          hint={t('getaround.tippingHint', { country: row.country })}
          onPress={() => router.push({ pathname: '/tipping', params: { country: row.iso2, ...(tripId ? { tripId } : {}) } })}
        />
      ) : null}

      {phraseLang ? (
        <SectionCard icon="language-outline" tone="teal" title={t('getaround.words')} subtitle={t('getaround.wordsBody', { lang: t(LANG_KEY[phraseLang]) })}>
          <View style={{ gap: space.s }}>
            {USEFUL_PHRASES.map((id) => (
              <Button
                key={id}
                kind="quiet"
                icon="chatbubble-ellipses-outline"
                label={t(WORD_KEYS[id])}
                hint={t('getaround.wordHint', { lang: t(LANG_KEY[phraseLang]) })}
                onPress={() => router.push({ pathname: '/phrases', params: { lang: phraseLang, phrase: id } })}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <Text style={[typeScale.small, { color: theme.muted }]}>{t('getaround.verify')}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('getaround.checked', { hosts: sourceHosts(row).join(', '), date: formatDay(row.checked, lang) })}</Text>
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
    lines = [t('getaround.notSure')];
  } else if ('answer' in section) {
    tone = CONTACTLESS_TONES[section.answer];
    strong = t(CONTACTLESS_KEYS[section.answer]);
    lines = section.note ? [section.note] : [];
  } else if ('names' in section) {
    lines = section.names;
  } else if ('text' in section) {
    lines = [section.text];
  } else if (section.id === 'rides') {
    lines = [t('getaround.rides.available')];
  }
  const spoken = [strong, ...lines].filter(Boolean).join('. ');
  const bullets = section.id === 'tickets' && section.known;
  return (
    <View accessible accessibilityLabel={t('getaround.sectionA11y', { title, text: spoken })} style={{ flexDirection: 'row', gap: space.m, minHeight: TOUCH }}>
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
