// T86 Trip recap: one trip looked back on (or "so far" while it is on). The trip's cover with its name and dates,
// colourful stat tiles (days, cities, countries, km travelled, journal pages, photos), the best day picked from
// journal moods, where you went, distance, spending by category in the home currency (unrated currencies listed
// apart, never guessed), moods and a photo strip, places to go ticked "Been there", and Share recap (clean text:
// src/core/recap.ts recapText). All maths in src/core/recap.ts. Free, offline, theme tokens, timed fades only.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripCover } from '../../src/core/covers.ts';
import { formatDay, formatRange } from '../../src/core/format.ts';
import type { ExpenseCategory, Trip } from '../../src/core/model.ts';
import { recapText, tripRecap, type Recap, type RecapWords, type StripPhoto } from '../../src/core/recap.ts';
import { formatMoney } from '../../src/core/spending.ts';
import { journalToday } from '../../src/core/journal.ts';
import { isRecapPreview, recapToday } from '../../src/core/followups91.ts';
import type { T } from '../../src/i18n/core.ts';
import { haptic } from '../../src/native/device.ts';
import { shareText } from '../../src/native/share.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, shadowOf, space, typeScale } from '../../src/theme/tokens.ts';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { FadeInView, GradientFill, IconBadge, ProgressBar, SectionCard, StatTile, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { IDEA_ICONS, IDEA_TONES } from '../../src/ui/ideas.tsx';
import { MOOD_ICONS, moodKey, PhotoThumb } from '../../src/ui/journal.tsx';
import { Body, Button, EmptyState, PressableScale, Screen, ToggleRow } from '../../src/ui/kit.tsx';
import { TripCoverHero } from '../../src/ui/TripCover.tsx';
import { PlanAgainButton } from '../../src/ui/PlanAgainButton.tsx';
import { RecapStamps } from '../../src/ui/PassportCard.tsx';
import { countryName, displayCountryName, formatInt } from '../../src/ui/useTravelStats.ts';

const THUMB = 96;
const CATEGORY_ICONS: Record<ExpenseCategory, IconName> = {
  food: 'restaurant-outline',
  transport: 'bus-outline',
  stay: 'bed-outline',
  activities: 'ticket-outline',
  shopping: 'bag-handle-outline',
  other: 'ellipsis-horizontal-circle-outline',
};
const CATEGORY_TONES: Record<ExpenseCategory, Tone> = { food: 'accent', transport: 'sea', stay: 'teal', activities: 'ok', shopping: 'warn', other: 'ink' };
const MOOD_TONES: Record<string, Tone> = { joyful: 'accent', adventurous: 'sea', grateful: 'danger', relaxed: 'teal', tired: 'warn', meh: 'ink' };

/** The catalogue wording for the share text. */
function recapWords(t: T): RecapWords {
  return {
    heading: (name) => t('recap.text.heading', { name }),
    dates: (range, n) => t('recap.text.dates', { range, n }),
    soFar: (n, days) => t('recap.text.soFar', { n, days }),
    cities: (list) => t('recap.text.cities', { list }),
    countries: (list) => t('recap.text.countries', { list }),
    distance: (km, flown) => t('recap.text.distance', { km, flown }),
    spent: (amount) => t('recap.text.spent', { amount }),
    category: (c, amount) => t('recap.text.category', { category: t(`spending.cat.${c}`), amount }),
    unrated: (list) => t('recap.text.unrated', { list }),
    moods: (list) => t('recap.text.moods', { list }),
    mood: (m) => t(moodKey(m)),
    best: (day, mood) => t('recap.text.best', { day, mood }),
    bestOutside: (day, mood) => t('recap.text.best', { day, mood }),
    dayLabel: (n) => t('recap.text.dayLabel', { n }),
    been: (list) => t('recap.text.been', { list }),
    footer: t('recap.text.footer'),
  };
}

export default function RecapScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('recap.route')} body={t('recap.notFound')} />
      </Screen>
    );
  }
  return <RecapView trip={trip} />;
}

function RecapView({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // T88: the sample trip before its dates opens as a preview of the whole trip (src/core/followups91.ts).
  const realToday = journalToday(trip);
  const preview = isRecapPreview(trip, realToday);
  const today = recapToday(trip, realToday);
  const r = useMemo(() => tripRecap(trip, today, { countryName }), [trip, today]);
  const cover = useMemo(() => tripCover(trip), [trip]);
  const range = formatRange(r.start, r.end, lang);

  const eyebrow = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.xs }}>
      <Pill icon="sparkles" text={r.phase === 'active' ? `${t('recap.eyebrowSoFar')} · ${t('recap.soFar', { n: r.daysSoFar, days: r.days })}` : t('recap.eyebrow')} />
      {r.demo ? <Pill icon="flask-outline" text={t('recap.demoBadge')} /> : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('recap.route') }} />
      <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        <FadeInView>
          <TripCoverHero scene={cover} title={trip.name} subtitle={range}>
            {eyebrow}
          </TripCoverHero>
        </FadeInView>
        {preview ? <Body muted>{t('f91.recap.preview')}</Body> : null}
        {r.available ? (
          <RecapBody trip={trip} r={r} onOpen={(path) => router.push(path)} />
        ) : (
          <FadeInView delay={60}>
            <EmptyState art="clock" title={t('recap.upcoming.title')} body={t('recap.upcoming.body')} />
          </FadeInView>
        )}
        {/* T118: go again, on new dates. */}
        <PlanAgainButton trip={trip} card />
        <Body muted>{t('recap.offline')}</Body>
      </ScrollView>
    </>
  );
}

function Pill({ icon, text }: { icon: IconName; text: string }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: theme.heroChip, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={14} color={theme.heroAccent} />
      </View>
      <Text style={[typeScale.small, { color: theme.heroInk }]}>{text}</Text>
    </View>
  );
}

function RecapBody({ trip, r, onOpen }: { trip: Trip; r: Recap; onOpen: (path: string) => void }) {
  const { t, theme, lang } = useApp();
  const km = formatInt(r.distance.km, lang);
  return (
    <>
      <FadeInView delay={40} style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <StatTile value={r.phase === 'active' ? r.daysSoFar : r.days} label={t(r.phase === 'active' ? 'recap.stat.daysSoFar' : 'recap.stat.days')} icon="sunny-outline" tone="accent" />
          <StatTile value={r.cities.length} label={t('recap.stat.cities')} icon="business-outline" tone="teal" />
          <StatTile value={r.countries.length} label={t('recap.stat.countries')} icon="flag-outline" tone="sea" />
        </View>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <StatTile value={r.distance.km} label={t('recap.stat.km')} icon="navigate-outline" tone="danger" />
          <StatTile value={r.journal.pages} label={t('recap.stat.pages')} icon="journal-outline" tone="ok" />
          <StatTile value={r.journal.photos} label={t('recap.stat.photos')} icon="images-outline" tone="warn" />
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <BestDayCard r={r} onOpen={() => onOpen(`/journal/${trip.id}`)} />
      </FadeInView>

      <FadeInView delay={120}>
        <SectionCard icon="earth-outline" tone="teal" title={t('recap.places.title')} subtitle={t('recap.places.subtitle')}>
          {r.cities.length || r.countries.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {r.countries.map((c) => (
                <Tag key={`c-${c}`} icon="flag" text={displayCountryName(c, lang)} bg={theme.seaSoft} fg={theme.sea} />
              ))}
              {r.cities.map((c) => (
                <Tag key={`t-${c}`} icon="location" text={c} bg={theme.tealSoft} fg={theme.teal} />
              ))}
            </View>
          ) : (
            <Body muted>{t('recap.places.none')}</Body>
          )}
        </SectionCard>
      </FadeInView>

      <FadeInView delay={140}>
        <RecapStamps trip={trip} />
      </FadeInView>

      <FadeInView delay={160}>
        <SectionCard icon="airplane-outline" tone="warn" title={t('recap.distance.title')}>
          {r.distance.legs === 0 ? (
            <Body muted>{t('recap.distance.none')}</Body>
          ) : r.distance.measured === 0 ? (
            <Body muted>{t('recap.distance.noneMeasured')}</Body>
          ) : (
            <>
              <Body>{r.distance.measured === 1 ? t('recap.distance.bodyOne', { km }) : t('recap.distance.body', { km, legs: r.distance.measured })}</Body>
              {r.distance.flownKm > 0 ? <Body muted>{t('recap.distance.flown', { km: formatInt(r.distance.flownKm, lang) })}</Body> : null}
            </>
          )}
          {r.distance.unmeasured && r.distance.measured ? (
            <Body muted>{r.distance.unmeasured === 1 ? t('recap.distance.unmeasuredOne') : t('recap.distance.unmeasured', { n: r.distance.unmeasured })}</Body>
          ) : null}
        </SectionCard>
      </FadeInView>

      <FadeInView delay={200}>
        <SpendingCard r={r} onOpen={() => onOpen(`/spending/${trip.id}`)} />
      </FadeInView>

      <FadeInView delay={240}>
        <MoodsCard r={r} onOpen={() => onOpen(`/journal/${trip.id}`)} />
      </FadeInView>

      <FadeInView delay={280}>
        <SectionCard
          icon="checkmark-done-outline"
          tone="ok"
          title={t('recap.ideas.title')}
          subtitle={r.ideas.total ? t('recap.ideas.subtitle', { done: r.ideas.done, total: r.ideas.total }) : undefined}
          action={{ label: t('recap.ideas.open'), hint: t('recap.ideas.openHint'), onPress: () => onOpen(`/ideas/${trip.id}`) }}
        >
          {r.ideas.been.length ? (
            <View style={{ gap: space.s }}>
              {r.ideas.been.map((i) => (
                <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <IconBadge name={IDEA_ICONS[i.category]} tone={IDEA_TONES[i.category]} size="s" />
                  <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{i.name}</Text>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Ionicons name="checkmark-circle" size={20} color={theme.ok} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Body muted>{t('recap.ideas.none')}</Body>
          )}
        </SectionCard>
      </FadeInView>

      <FadeInView delay={320}>
        <ShareCard trip={trip} r={r} />
      </FadeInView>
    </>
  );
}

function Tag({ icon, text, bg, fg }: { icon: IconName; text: string; bg: string; fg: string }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: bg }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={14} color={fg} />
      </View>
      <Text style={[typeScale.small, { color: theme.ink }]}>{text}</Text>
    </View>
  );
}

function BestDayCard({ r, onOpen }: { r: Recap; onOpen: () => void }) {
  const { t, theme, lang } = useApp();
  const b = r.bestDay;
  if (!b) {
    return <SectionCard icon="trophy-outline" tone="accent" title={t('recap.best.title')} subtitle={t('recap.best.none')} />;
  }
  const date = formatDay(b.day, lang);
  const day = b.dayNumber != null ? t('recap.best.day', { n: b.dayNumber, date }) : date;
  const mood = t('recap.best.mood', { mood: t(moodKey(b.mood)) });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('recap.best.a11y', { day, mood, rule: t('recap.best.rule') })}
      accessibilityHint={t('recap.best.hint')}
      onPress={onOpen}
      style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.wallet[0] }, shadowOf(theme, 'low')]}
    >
      <GradientFill tone="wallet" />
      <View style={{ padding: space.l, gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trophy" size={24} color={theme.heroAccent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('recap.best.title')}</Text>
            <Text style={[typeScale.title, { color: theme.heroInk }]}>{day}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name={MOOD_ICONS[b.mood]} size={16} color={theme.heroAccent} />
              <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{mood}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
        </View>
        <Text style={[typeScale.small, { color: theme.heroMuted }]}>{t('recap.best.rule')}</Text>
      </View>
    </PressableScale>
  );
}

function SpendingCard({ r, onOpen }: { r: Recap; onOpen: () => void }) {
  const { t, theme, lang } = useApp();
  const s = r.spending;
  const action = { label: t('recap.spending.open'), hint: t('recap.spending.openHint'), onPress: onOpen };
  if (!s.count) {
    return (
      <SectionCard icon="wallet-outline" tone="accent" title={t('recap.spending.title')} action={action}>
        <Body muted>{t('recap.spending.none')}</Body>
      </SectionCard>
    );
  }
  const home = s.home;
  const converted = home != null && s.totalHome != null && s.categories.some((c) => c.home != null);
  return (
    <SectionCard icon="wallet-outline" tone="accent" title={t('recap.spending.title')} subtitle={t('recap.spending.subtitle')} action={action}>
      {converted && home ? (
        <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('recap.spending.total', { amount: formatMoney(s.totalHome as number, home, lang) })}</Text>
      ) : null}
      {home == null ? <Body muted>{t('recap.spending.noHome')}</Body> : null}
      {converted && home
        ? s.categories.map((c) => {
            const label = t(`spending.cat.${c.category}`);
            const amount = c.home != null ? formatMoney(c.home, home, lang) : t('recap.spending.noRate');
            const pct = Math.round(c.fraction * 100);
            return (
              <View key={c.category} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <IconBadge name={CATEGORY_ICONS[c.category]} tone={CATEGORY_TONES[c.category]} size="s" />
                  <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{label}</Text>
                  <Text style={[typeScale.bodyStrong, { color: c.home != null ? theme.ink : theme.muted, fontVariant: ['tabular-nums'] }]}>{amount}</Text>
                </View>
                <ProgressBar
                  progress={c.fraction}
                  tone={CATEGORY_TONES[c.category]}
                  label={c.home != null ? t('recap.spending.catA11y', { category: label, amount, pct }) : t('recap.spending.catNoRate', { category: label })}
                />
                {c.partial && c.home != null ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('recap.spending.partial')}</Text> : null}
              </View>
            );
          })
        : null}
      {s.unrated.length ? (
        <View style={{ backgroundColor: theme.warnSoft, borderRadius: radius.m, padding: space.m, gap: space.xs }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('recap.spending.unratedTitle')}</Text>
          {s.unrated.map((m) => (
            <Text key={m.currency} style={[typeScale.body, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {formatMoney(m.amount, m.currency, lang)}
            </Text>
          ))}
          {home != null ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('recap.spending.unratedBody')}</Text> : null}
        </View>
      ) : null}
    </SectionCard>
  );
}

function MoodsCard({ r, onOpen }: { r: Recap; onOpen: () => void }) {
  const { t, theme, lang } = useApp();
  const moods = r.journal.moods;
  const max = moods.reduce((m, x) => Math.max(m, x.count), 0);
  const renderPhoto = useCallback(
    ({ item, index }: { item: StripPhoto; index: number }) => (
      <PhotoThumb photo={item} size={THUMB} label={t('recap.photos.a11y', { n: index + 1, total: r.strip.length, day: formatDay(item.day, lang) })} />
    ),
    [t, r.strip.length, lang],
  );
  return (
    <SectionCard
      icon="happy-outline"
      tone="sea"
      title={t('recap.moods.title')}
      subtitle={moods.length ? t('recap.moods.subtitle') : undefined}
      action={{ label: t('recap.journal.open'), hint: t('recap.journal.openHint'), onPress: onOpen }}
    >
      {moods.length ? (
        <View style={{ gap: space.s }}>
          {moods.map((m) => {
            const label = t(moodKey(m.mood));
            return (
              <View key={m.mood} accessible accessibilityLabel={m.count === 1 ? t('recap.moods.a11yOne', { mood: label }) : t('recap.moods.a11y', { mood: label, n: m.count })} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <IconBadge name={MOOD_ICONS[m.mood]} tone={MOOD_TONES[m.mood] ?? 'sea'} size="s" />
                  <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{label}</Text>
                  <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{m.count}</Text>
                </View>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <ProgressBar progress={max ? m.count / max : 0} tone={MOOD_TONES[m.mood] ?? 'sea'} label={label} />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Body muted>{t('recap.moods.none')}</Body>
      )}
      {r.strip.length ? (
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
            {t('recap.photos.title')}
          </Text>
          <FlatList
            horizontal
            data={r.strip}
            keyExtractor={(p) => p.id}
            renderItem={renderPhoto}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.s }}
            initialNumToRender={6}
          />
          {r.journal.photos > r.strip.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('recap.photos.more', { n: r.strip.length })}</Text> : null}
        </View>
      ) : null}
    </SectionCard>
  );
}

function ShareCard({ trip, r }: { trip: Trip; r: Recap }) {
  const { t, theme, lang } = useApp();
  const [spending, setSpending] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = useMemo(
    () =>
      recapText(r, recapWords(t), {
        lang,
        includeSpending: spending,
        formatRange: (a, b) => formatRange(a, b, lang),
        formatDay: (d) => formatDay(d, lang),
        formatInt: (n) => formatInt(n, lang),
        countryName: (c) => displayCountryName(c, lang),
      }),
    [r, t, lang, spending],
  );
  const send = async () => {
    const res = await shareText(text, t('recap.share.subject', { name: trip.name }));
    if (res === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('recap.share.failed'));
      return;
    }
    setFailed(false);
    if (res === 'shared') haptic.success();
  };
  return (
    <SectionCard icon="share-social-outline" tone="sea" title={t('recap.share.title')} subtitle={t('recap.share.body')}>
      {r.spending.count ? <ToggleRow label={t('recap.share.spending')} hint={t('recap.share.spendingHint')} value={spending} onChange={setSpending} /> : null}
      <Text style={[typeScale.caption, { color: theme.muted }]}>{t('recap.share.preview')}</Text>
      <View style={{ backgroundColor: theme.paper, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.m }}>
        <Text selectable style={[typeScale.small, { color: theme.ink }]}>
          {text}
        </Text>
      </View>
      {failed ? <ErrorNotice title={t('recap.share.title')} body={t('recap.share.failed')} action={t('common.tryAgain')} actionHint={t('recap.share.sendHint')} onAction={send} /> : null}
      <Button label={t('recap.share.send')} hint={t('recap.share.sendHint')} icon="share-outline" onPress={send} />
    </SectionCard>
  );
}
