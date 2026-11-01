// T95 Arrival card: a colourful "Welcome to <country>" hero (theme.hero gradient per country) for the trip screen
// and the Trips tab, from src/core/arrival.ts: local time vs home, the traveller's own saved rate with 10 / 50 / 100,
// plugs / voltage / driving side and emergency numbers (both "verify locally"), hello / thank you phrase cards, and
// nearest-toilet, menu-words (T110, language from the stop's country) and way-back-to-hotel shortcuts. "Hide for <country>" is remembered per country per trip on this
// phone only (usePersisted). The "Countries on this trip" strip draws regional-indicator flags (decorative; each
// chip is labelled with the country name). Text on the gradient sits on heroChip glass (AA in both themes); timed
// fade only (FadeInView), no springs. Missing data shows a plain line, never a blank or a guess.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import emergencyTable from '../content/emergency_numbers.json';
import essentialsTable from '../content/country_essentials.json';
import { ARRIVAL_DISMISS_KEY, arrivalForTrips, arrivalView, countryStrip, dismissArrival, homeCountryFor, type ArrivalTables, type ArrivalView, type StripCountry } from '../core/arrival.ts';
import { lineLabelServices, type EmergencyTable, type NumberLine, type Service } from '../core/emergency.ts';
import type { EssentialsTable } from '../core/essentials.ts';
import { deviceZone, formatDay, zoneCity } from '../core/format.ts';
import { formatOffset } from '../core/glance.ts';
import { menuLangForCountry } from '../core/menu.ts';
import { currencyName } from '../core/countrycurrency.ts';
import type { Trip } from '../core/model.ts';
import { formatMoney, rateToText } from '../core/spending.ts';
import type { Key } from '../i18n/en.ts';
import { requestNearestToilet } from '../state/nearestToilet.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { callAndExplain } from './EmergencyCardView.tsx';
import { FadeInView, GradientFill, SectionCard, type IconName } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { PressableScale } from './kit.tsx';
import { PHRASE_TABLE } from './phrases.ts';
import { useMinute } from './TripPass.tsx';
import { holidayTodayIn } from '../core/holidays.ts';
import { holidayTodayLine } from './HolidaysCard.tsx';

const TABLES: ArrivalTables = { essentials: essentialsTable as EssentialsTable, emergency: emergencyTable as unknown as EmergencyTable, phrases: PHRASE_TABLE };
const NO_DISMISSED: unknown = [];

const SERVICE: Record<Service, Key> = {
  general: 'arrival.serviceGeneral',
  police: 'arrival.servicePolice',
  ambulance: 'arrival.serviceAmbulance',
  fire: 'arrival.serviceFire',
  tourist_police: 'arrival.serviceTourist',
};
const STATE: Record<StripCountry['state'], Key> = { been: 'arrival.stateBeen', now: 'arrival.stateNow', ahead: 'arrival.stateAhead' };

function useDismissed() {
  const [dismissed, setDismissed, loaded] = usePersisted<unknown>(ARRIVAL_DISMISS_KEY, NO_DISMISSED);
  return { dismissed, loaded, dismiss: (tripId: string, iso2: string) => setDismissed((old: unknown) => dismissArrival(old, tripId, iso2)) };
}

/** Trip screen: the welcome card while a country is arriving, else just the countries strip (nothing on a home trip). */
export function ArrivalCard({ trip }: { trip: Trip }) {
  const { homeIso } = useHomeCountry();
  const { dismissed, loaded, dismiss } = useDismissed();
  const now = useMinute();
  const view = useMemo(
    () => (loaded ? arrivalView(trip, { now, homeIso2: homeIso, phoneZone: deviceZone(), dismissed, tables: TABLES }) : null),
    [trip, now, homeIso, dismissed, loaded],
  );
  const strip = useMemo(() => countryStrip(trip, now, homeCountryFor(trip, homeIso), TABLES), [trip, now, homeIso]);
  if (!loaded) return null;
  if (view) return <ArrivalHero view={view} onDismiss={() => dismiss(view.tripId, view.iso2)} />;
  return strip.length ? <CountriesCard countries={strip} /> : null;
}

/** Trips tab: the first trip (in list order) with a country arriving now and not hidden. */
export function ArrivalHomeCard({ trips }: { trips: Trip[] }) {
  const { homeIso } = useHomeCountry();
  const { dismissed, loaded, dismiss } = useDismissed();
  const now = useMinute();
  const view = useMemo(
    () => (loaded ? arrivalForTrips(trips, { now, homeIso2: homeIso, phoneZone: deviceZone(), dismissed, tables: TABLES }) : null),
    [trips, now, homeIso, dismissed, loaded],
  );
  return view ? <ArrivalHero view={view} onDismiss={() => dismiss(view.tripId, view.iso2)} /> : null;
}

/** Glass panel on the gradient with a small-caps heading. */
function Panel({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={{ backgroundColor: theme.heroChip, borderRadius: radius.m, padding: space.m, gap: space.xs }}>
      <View accessible accessibilityRole="header" accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Ionicons name={icon} size={16} color={theme.heroInk} />
        <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Line({ children, strong, muted }: { children: ReactNode; strong?: boolean; muted?: boolean }) {
  const { theme } = useApp();
  return <Text style={[strong ? typeScale.bodyStrong : muted ? typeScale.small : typeScale.body, { color: muted ? theme.heroMuted : theme.heroInk }]}>{children}</Text>;
}

/** A pill button on the gradient (heroChip glass, heroInk text), 48 pt tall. */
function HeroButton({ label, hint, icon, onPress, a11yLabel }: { label: string; hint: string; icon: IconName; onPress: () => void; a11yLabel?: string }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.heroChip, borderWidth: 1, borderColor: theme.heroWash }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={18} color={theme.heroInk} />
      </View>
      <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{label}</Text>
    </PressableScale>
  );
}

function ArrivalHero({ view: v, onDismiss }: { view: ArrivalView; onDismiss: () => void }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const when = v.when === 'here' ? t('arrival.whenHere') : t('arrival.whenToday');
  const services = (l: NumberLine) => lineLabelServices(l).map((s) => t(SERVICE[s])).join(', ');
  // T106: today is a public holiday in this country (today on its own calendar).
  const now = useMinute();
  const holiday = useMemo(() => holidayTodayLine(t, holidayTodayIn(v.zone, now)), [t, v.zone, now]);

  const clock = v.clock;
  const off = clock ? formatOffset(clock.diffMinutes) : '';
  const home = clock ? zoneCity(clock.homeZone) : '';
  const diff = clock ? (off ? t('arrival.timeAhead', { d: off, home }) : t('arrival.timeSame', { home })) : '';

  const p = v.power;
  const e = v.emergency;
  const m = v.money;
  // T96: the local currency named from the ISO 4217 table (name from the phone's Intl data when it has one).
  const cur = v.currency;
  const curName = cur ? currencyName(cur.code, lang) : null;

  return (
    <FadeInView>
      <View style={[{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.hero[v.tone][0] }, shadowOf(theme, 'mid')]}>
        <GradientFill tone={v.tone} />
        <View style={{ padding: space.l, gap: space.m }}>
          {/* Heading: the flag is decorative; the title names the country. */}
          <View accessible accessibilityRole="header" accessibilityLabel={t('arrival.a11y', { country: v.country, when, trip: v.tripName })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            {v.flag ? (
              <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 44, lineHeight: 52 }}>
                {v.flag}
              </Text>
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{v.when === 'here' ? t('arrival.eyebrowHere', { trip: v.tripName }) : t('arrival.eyebrowToday', { trip: v.tripName })}</Text>
              <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{t('arrival.title', { country: v.country })}</Text>
              <Text style={[typeScale.small, { color: theme.heroMuted }]}>{t('arrival.subtitle')}</Text>
            </View>
          </View>

          {holiday ? (
            <View accessible accessibilityLabel={`${holiday} ${t('holidays.todayHint')}`}>
              <Panel title={t('holidays.badge')} icon="flag-outline">
                <Line strong>{holiday}</Line>
                <Line muted>{t('holidays.todayHint')}</Line>
              </Panel>
            </View>
          ) : null}

          {clock ? (
            <View accessible accessibilityLabel={t('arrival.timeA11y', { time: clock.time, homeTime: clock.homeTime, diff })}>
              <Panel title={t('arrival.timeLabel')} icon="time-outline">
                <Text style={[typeScale.displayL, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{clock.time}</Text>
                <Line muted>{diff}</Line>
              </Panel>
            </View>
          ) : null}

          <Panel title={cur ? t('f93.moneyTitle') : t('arrival.moneyLabel')} icon="cash-outline">
            {cur ? (
              <>
                <Line strong>{curName ? t('f93.localCurrency', { name: curName, code: cur.code }) : t('f93.localCurrencyCode', { code: cur.code })}</Line>
                {cur.also.length ? <Line>{t('f93.localCurrencyAlso', { codes: cur.also.join(', ') })}</Line> : null}
                <Line muted>{t('f93.currencyVerify')}</Line>
              </>
            ) : null}
            {cur?.sameAsHome ? (
              <Line>{t('f93.sameAsHome')}</Line>
            ) : m ? (
              <>
                <Line strong>{t('arrival.moneyRate', { local: m.local, rate: rateToText(m.rate), home: m.home })}</Line>
                {m.rows.map((r) => (
                  <Line key={r.local}>{t('arrival.moneyRow', { local: formatMoney(r.local, m.local, lang), home: formatMoney(r.home, m.home, lang) })}</Line>
                ))}
                <Line muted>{m.rateDay ? t('arrival.moneyRateDay', { day: formatDay(m.rateDay, lang) }) : t('arrival.moneyRateNoDay')}</Line>
              </>
            ) : (
              <Line>{v.moneyMissing === 'home' ? t('arrival.moneyNoHome') : cur ? t('f93.noRateFor', { code: cur.code }) : t('arrival.moneyNoRate')}</Line>
            )}
            <View style={{ flexDirection: 'row' }}>
              <HeroButton label={t('arrival.openConverter')} hint={t('arrival.openConverterHint')} icon="calculator-outline" onPress={() => router.push({ pathname: '/convert', params: { tripId: v.tripId } })} />
            </View>
            {/* T105: what's usual for tipping here, with a tip calculator. */}
            <View style={{ flexDirection: 'row' }}>
              <HeroButton label={t('tipping.fromArrival')} hint={t('tipping.fromArrivalHint', { country: v.country })} icon="happy-outline" onPress={() => router.push({ pathname: '/tipping', params: { tripId: v.tripId, country: v.iso2 } })} />
            </View>
          </Panel>

          <Panel title={t('arrival.powerLabel')} icon="flash-outline">
            {p ? (
              <>
                <Line>{p.plugs ? t('arrival.plugs', { list: p.plugs }) : t('arrival.plugsUnknown')}</Line>
                <Line>{p.voltage ? t('arrival.voltage', { value: [p.voltage, p.frequency].filter(Boolean).join(', ') }) : t('arrival.voltageUnknown')}</Line>
                <Line>{p.driving === 'left' ? t('arrival.drivingLeft') : p.driving === 'right' ? t('arrival.drivingRight') : t('arrival.drivingUnknown')}</Line>
                <Line muted>{p.checked ? t('arrival.verifyChecked', { date: formatDay(p.checked, lang) }) : t('arrival.verify')}</Line>
              </>
            ) : (
              <Line>{t('arrival.noPower', { country: v.country })}</Line>
            )}
          </Panel>

          <Panel title={t('arrival.emergencyLabel')} icon="medkit-outline">
            {e && e.lines.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {e.lines.map((l) => (
                  <HeroButton
                    key={l.number}
                    icon="call-outline"
                    label={`${l.number} · ${services(l)}`}
                    a11yLabel={t('arrival.callA11y', { number: l.number, services: services(l) }) + (l.doubted ? `. ${t('arrival.doubted')}` : '')}
                    hint={t('arrival.callHint')}
                    onPress={() => void callAndExplain(l.number, t)}
                  />
                ))}
              </View>
            ) : null}
            {e && e.lines.some((l) => l.doubted) ? <Line muted>{t('arrival.doubted')}</Line> : null}
            {e?.fallback ? <Line>{t('arrival.fallback', { number: e.fallback })}</Line> : null}
            {!e ? <Line>{t('arrival.noEmergency', { country: v.country })}</Line> : null}
            {e ? <Line muted>{e.checked ? t('arrival.verifyChecked', { date: formatDay(e.checked, lang) }) : t('arrival.verify')}</Line> : null}
            <View style={{ flexDirection: 'row' }}>
              <HeroButton label={t('arrival.openEmergency')} hint={t('arrival.openEmergencyHint')} icon="medkit-outline" onPress={() => router.navigate('/emergency')} />
            </View>
          </Panel>

          {v.phrases ? (
            <Panel title={t('arrival.phrasesLabel')} icon="chatbubbles-outline">
              <View style={{ flexDirection: 'row', gap: space.s }}>
                {v.phrases.cards.map((c) => (
                  <PressableScale
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('arrival.phraseA11y', { english: c.english, text: c.roman ?? c.text })}
                    accessibilityHint={t('arrival.phraseHint')}
                    onPress={() => router.push({ pathname: '/phrase-card', params: { lang: c.lang, phrase: c.id } })}
                    style={{ flex: 1, minHeight: TOUCH, padding: space.m, borderRadius: radius.m, backgroundColor: theme.heroChip, borderWidth: 1, borderColor: theme.heroWash, gap: 2 }}
                  >
                    <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{c.english}</Text>
                    <Text style={[typeScale.title, { color: theme.heroInk }]}>{c.text}</Text>
                    {c.roman ? <Text style={[typeScale.small, { color: theme.heroMuted }]}>{c.roman}</Text> : null}
                  </PressableScale>
                ))}
              </View>
            </Panel>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <HeroButton label={t('arrival.toilet')} hint={t('arrival.toiletHint')} icon="male-female-outline" onPress={() => router.navigate({ pathname: '/toilets', params: { find: requestNearestToilet() } })} />
            {menuLangForCountry(PHRASE_TABLE, v.iso2) ? (
              <HeroButton
                label={t('menu.openFromArrival')}
                hint={t('menu.openFromArrivalHint')}
                icon="restaurant-outline"
                onPress={() => router.push({ pathname: '/menu', params: { lang: menuLangForCountry(PHRASE_TABLE, v.iso2) ?? '' } })}
              />
            ) : null}
            {v.hotelTarget ? (
              <HeroButton label={t('arrival.wayback')} hint={t('arrival.waybackHint')} icon="compass-outline" onPress={() => router.push({ pathname: '/wayback', params: { target: v.hotelTarget ?? '' } })} />
            ) : null}
          </View>

          {v.countries.length > 1 ? <Strip countries={v.countries} onHero /> : null}

          <View style={{ flexDirection: 'row' }}>
            <HeroButton label={t('arrival.dismiss', { country: v.country })} hint={t('arrival.dismissHint', { country: v.country })} icon="eye-off-outline" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </FadeInView>
  );
}

/** Flags in a wrapping row. The emoji is decorative; each chip is labelled "<country>, <state>". */
function Strip({ countries, onHero }: { countries: StripCountry[]; onHero?: boolean }) {
  const { t, theme } = useApp();
  return (
    <View style={{ gap: space.xs }}>
      {onHero ? (
        <View accessible accessibilityRole="header" accessibilityLabel={t('arrival.stripTitle')}>
          <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('arrival.stripTitle')}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {countries.map((c) => {
          const now = c.state === 'now';
          const bg = onHero ? theme.heroChip : now ? theme.tealSoft : theme.seaSoft;
          const fg = onHero ? theme.heroInk : theme.ink;
          return (
            <View
              key={c.iso2}
              accessible
              accessibilityLabel={t('arrival.stripA11y', { country: c.country, state: t(STATE[c.state]) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, minHeight: 36, borderRadius: radius.pill, backgroundColor: bg, borderWidth: now ? 2 : 0, borderColor: onHero ? theme.heroInk : theme.teal }}
            >
              {c.flag ? (
                <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 18 }}>
                  {c.flag}
                </Text>
              ) : null}
              <Text style={[typeScale.small, { color: fg }]}>{c.country}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CountriesCard({ countries }: { countries: StripCountry[] }) {
  const { t } = useApp();
  return (
    <SectionCard title={t('arrival.stripTitle')} icon="flag-outline" tone="teal">
      <Strip countries={countries} />
    </SectionCard>
  );
}
