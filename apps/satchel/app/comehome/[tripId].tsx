// T128 Coming home: "Before you head home" (due on the final departure's clock: check out, keys and cards, passports,
// chargers, leftover coins with a link to Cash on hand, and the duty-free reminder for the home country set in
// Settings, with its official page, checked date and "verify before you fly") and "Home again" for the day after
// (unpack, laundry, photos, spending and settle up, recap, rate the trip). Own rows, rename / remove / put back and
// untick per list. Logic in src/core/comehome.ts; the official pages in src/content/comehome.json.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import table from '../../src/content/comehome.json';
import {
  addOwnRow,
  allowanceFor,
  allowanceHost,
  COME_LINKS,
  comeDue,
  lastCheckout,
  missingTemplate,
  readComingHome,
  removeRow,
  renameRow,
  restoreTemplate,
  rowsOf,
  setRating,
  setRowDone,
  startComingHome,
  untickList,
  type AllowanceTable,
  type ComeList,
  type ComeRow,
  type ComingHome,
} from '../../src/core/comehome.ts';
import { formatDay } from '../../src/core/format.ts';
import { newId, type Trip } from '../../src/core/model.ts';
import { haptic } from '../../src/native/device.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { comeDueLine } from '../../src/ui/comehome.tsx';
import { PostcardsComeHomeRow } from '../../src/ui/postcards.tsx';
import { FadeInView, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { useHomeCountry } from '../../src/ui/HomeCountryPicker.tsx';
import { Body, Button, EmptyState, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';
import { TripAccentBand } from '../../src/ui/TripAccentBand.tsx';

const TABLE = table as unknown as AllowanceTable;

export default function ComeHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('comehome.title')} body={t('comehome.notFound')} />
      </Screen>
    );
  }
  return <ComeHome trip={trip} />;
}

function useCommit() {
  const { t } = useApp();
  const { saveTrip } = useTrips();
  return useCallback(
    async (next: Trip) => {
      const ok = await saveTrip(next);
      if (!ok) Alert.alert(t('comehome.saveFailed.title'), t('comehome.saveFailed.body'));
      return ok;
    },
    [saveTrip, t],
  );
}

function ComeHome({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const insets = useSafeAreaInsets();
  const commit = useCommit();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const due = useMemo(() => comeDue(trip, now), [trip, now]);
  const ch = useMemo(() => readComingHome(trip), [trip]);
  const started = !!ch && ch.rows.length > 0;
  const soon = !!due && due.when !== 'later' && due.when !== 'done';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('comehome.route') }} />
      <TripAccentBand trip={trip} />
      <View accessible style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
          {t('comehome.title')}
        </Text>
        {due ? <Text style={[typeScale.bodyStrong, { color: soon ? theme.accentInk : theme.muted }]}>{comeDueLine(t, due, lang)}</Text> : null}
        {due?.dep.item ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.due.from', { title: due.dep.item.title })}</Text> : null}
        {due ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.due.homeOn', { date: formatDay(due.dep.home, lang) })}</Text> : null}
      </View>
      {started ? null : (
        <SectionCard title={t('comehome.emptyTitle')} subtitle={t('comehome.emptyBody')} icon="home-outline" tone="accent">
          <Button label={t('comehome.start')} hint={t('comehome.startHint')} icon="list-outline" onPress={() => void commit(startComingHome(trip, newId))} />
        </SectionCard>
      )}
      <ListCard trip={trip} ch={ch} list="before" />
      {/* T147: "Postcards · 3 of 5 sent" once someone is on the trip's postcard list. */}
      <PostcardsComeHomeRow trip={trip} />
      <AllowanceCard />
      <ListCard trip={trip} ch={ch} list="after" />
      <RatingCard trip={trip} rating={ch?.rating} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------------------- lists

function ListCard({ trip, ch, list }: { trip: Trip; ch: ComingHome | null; list: ComeList }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const commit = useCommit();
  const [own, setOwn] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const rows = rowsOf(ch, list);
  const done = rows.filter((r) => r.done).length;
  const missing = ch && ch.rows.length ? missingTemplate(ch, list) : [];
  const checkout = useMemo(() => (list === 'before' ? lastCheckout(trip) : null), [trip, list]);
  const label = (r: ComeRow) => r.label?.trim() || (r.tpl ? t(`comehome.tpl.${r.tpl}`) : '');
  const allDone = t(list === 'before' ? 'comehome.allDoneBefore' : 'comehome.allDoneAfter');

  const sub = (r: ComeRow): string => {
    if (r.tpl !== 'checkout' || !checkout) return '';
    const dep = comeDue(trip, Date.now())?.dep;
    const sameDay = !dep || dep.stamp.local.slice(0, 10) === checkout.date;
    return sameDay ? t('comehome.checkout.by', { name: checkout.name, time: checkout.time }) : t('comehome.checkout.byDate', { name: checkout.name, time: checkout.time, date: formatDay(checkout.date, lang) });
  };

  const linkFor = (r: ComeRow): { label: string; hint: string; go: () => void } | null => {
    const link = r.tpl ? COME_LINKS[r.tpl] : undefined;
    if (link === 'cash') return { label: t('comehome.link.cash'), hint: t('comehome.link.cashHint'), go: () => router.push(`/cash/${trip.id}`) };
    if (link === 'spending') return { label: t('comehome.link.spending'), hint: t('comehome.link.spendingHint'), go: () => router.push(`/spending/${trip.id}`) };
    if (link === 'recap') return { label: t('comehome.link.recap'), hint: t('comehome.link.recapHint'), go: () => router.push(`/recap/${trip.id}`) };
    return null;
  };

  const toggle = (r: ComeRow) => {
    void commit(setRowDone(trip, r.id, !r.done)).then((ok) => {
      if (ok && !r.done && done + 1 === rows.length) AccessibilityInfo.announceForAccessibility(allDone);
    });
  };
  const add = () => {
    if (!own.trim()) return;
    void commit(addOwnRow(trip, list, own, newId)).then((ok) => ok && setOwn(''));
  };

  return (
    <SectionCard
      title={t(list === 'before' ? 'comehome.before.title' : 'comehome.after.title')}
      subtitle={t(list === 'before' ? 'comehome.before.sub' : 'comehome.after.sub')}
      icon={list === 'before' ? 'airplane-outline' : 'home-outline'}
      tone={list === 'before' ? 'accent' : 'sea'}
    >
      {rows.length ? <ProgressBar progress={done / rows.length} tone="ok" label={t('comehome.card.progress', { done, total: rows.length })} /> : <Body muted>{t('comehome.listEmpty')}</Body>}
      {rows.length && done === rows.length ? <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{allDone}</Text> : null}
      {rows.map((r, i) => {
        const extra = sub(r);
        const link = linkFor(r);
        return (
          <FadeInView key={r.id} delay={Math.min(i, 6) * 30}>
            {renaming === r.id ? (
              <RenameRow trip={trip} row={r} current={label(r)} onDone={() => setRenaming(null)} />
            ) : (
              <View style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <PressableScale
                    accessibilityRole="checkbox"
                    accessibilityLabel={[t('comehome.row.tickA11y', { label: label(r) }), extra].filter(Boolean).join('. ')}
                    accessibilityHint={t('comehome.row.tickHint')}
                    accessibilityState={{ checked: r.done }}
                    onPress={() => toggle(r)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}
                  >
                    <Ionicons name={r.done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={r.done ? theme.ok : theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.body, { color: r.done ? theme.muted : theme.ink, textDecorationLine: r.done ? 'line-through' : 'none' }]}>{label(r)}</Text>
                      {extra ? <Text style={[typeScale.small, { color: theme.muted }]}>{extra}</Text> : null}
                    </View>
                  </PressableScale>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('comehome.row.renameA11y', { label: label(r) })}
                    accessibilityHint={t('comehome.row.renameHint')}
                    onPress={() => setRenaming(r.id)}
                    style={{ width: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.muted} />
                  </PressableScale>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('comehome.row.removeA11y', { label: label(r) })}
                    accessibilityHint={t('comehome.row.removeHint')}
                    onPress={() => void commit(removeRow(trip, r.id))}
                    style={{ width: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close-outline" size={22} color={theme.muted} />
                  </PressableScale>
                </View>
                {link ? (
                  <View style={{ paddingLeft: space.xl }}>
                    <Button label={link.label} hint={link.hint} kind="quiet" icon="arrow-forward-outline" onPress={link.go} />
                  </View>
                ) : null}
              </View>
            )}
          </FadeInView>
        );
      })}
      {ch && ch.rows.length ? (
        <>
          <TextField label={t('comehome.own.label')} value={own} onChange={setOwn} placeholder={t(list === 'before' ? 'comehome.own.placeholderBefore' : 'comehome.own.placeholderAfter')} />
          <Button label={t('comehome.own.add')} hint={t('comehome.own.addHint')} kind="secondary" icon="add" onPress={add} />
        </>
      ) : null}
      {missing.length ? (
        <Button
          label={missing.length === 1 ? t('comehome.restoreOne') : t('comehome.restore', { n: missing.length })}
          hint={t('comehome.restoreHint')}
          kind="quiet"
          icon="refresh-outline"
          onPress={() => void commit(restoreTemplate(trip, list, newId))}
        />
      ) : null}
      {done ? <Button label={t('comehome.untick')} hint={t('comehome.untickHint')} kind="quiet" icon="square-outline" onPress={() => void commit(untickList(trip, list))} /> : null}
    </SectionCard>
  );
}

function RenameRow({ trip, row, current, onDone }: { trip: Trip; row: ComeRow; current: string; onDone: () => void }) {
  const { t } = useApp();
  const commit = useCommit();
  const [words, setWords] = useState(current);
  return (
    <View style={{ gap: space.s }}>
      <TextField label={t('comehome.row.renameLabel')} value={words} onChange={setWords} />
      <Button label={t('comehome.row.renameSave')} hint={t('comehome.row.renameSaveHint')} kind="secondary" icon="checkmark" onPress={() => void commit(renameRow(trip, row.id, words)).then((ok) => ok && onDone())} />
      <Button label={t('comehome.row.renameCancel')} hint={t('comehome.row.renameCancelHint')} kind="quiet" onPress={onDone} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------- duty-free

function AllowanceCard() {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const { homeIso } = useHomeCountry();
  const row = allowanceFor(TABLE, homeIso);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    if (!row) return;
    setFailed(false);
    try {
      await Linking.openURL(row.url);
    } catch {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('comehome.customs.openFailed', { url: row.url }));
    }
  };
  return (
    <SectionCard title={t('comehome.customs.title')} subtitle={t('comehome.customs.generic')} icon="pricetags-outline" tone="ink">
      {row ? (
        <View style={{ gap: space.s }}>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.customs.from', { authority: row.authority })}</Text>
          <Text style={[typeScale.body, { color: theme.ink }]}>{row.summary}</Text>
          <View style={{ borderRadius: radius.m, padding: space.s, backgroundColor: theme.warnSoft }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('comehome.customs.verify')}</Text>
          </View>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.customs.checked', { host: allowanceHost(row), date: formatDay(row.checked, lang) })}</Text>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={t('comehome.customs.openA11y', { authority: row.authority })}
            accessibilityHint={t('comehome.customs.openHint')}
            onPress={() => void open()}
            style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s }}
          >
            <Ionicons name="open-outline" size={18} color={theme.sea} />
            <Text style={[typeScale.bodyStrong, { color: theme.sea }]}>{t('comehome.customs.open')}</Text>
          </PressableScale>
          {failed ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('comehome.customs.openFailed', { url: row.url })}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: space.s }}>
          <Body muted>{t(homeIso ? 'comehome.customs.noRow' : 'comehome.customs.noHome')}</Body>
          <View style={{ borderRadius: radius.m, padding: space.s, backgroundColor: theme.warnSoft }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('comehome.customs.verify')}</Text>
          </View>
          {homeIso ? null : <Button label={t('comehome.customs.settings')} hint={t('comehome.customs.settingsHint')} kind="secondary" icon="settings-outline" onPress={() => router.push('/settings')} />}
        </View>
      )}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('comehome.customs.notAdvice')}</Text>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------------------------------------- rating

function RatingCard({ trip, rating }: { trip: Trip; rating?: number }) {
  const { t, theme } = useApp();
  const commit = useCommit();
  const rate = (n: number) => {
    void commit(setRating(trip, n)).then((ok) => {
      if (!ok) return;
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t('comehome.rate.rated', { n }));
    });
  };
  return (
    <SectionCard title={t('comehome.rate.title')} icon="star-outline" tone="accent">
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.xs }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <PressableScale
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={t('comehome.rate.starA11y', { n })}
            accessibilityHint={t('comehome.rate.starHint')}
            accessibilityState={{ checked: rating === n }}
            onPress={() => rate(n)}
            style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={rating && n <= rating ? 'star' : 'star-outline'} size={30} color={rating && n <= rating ? theme.accent : theme.muted} />
          </PressableScale>
        ))}
      </View>
      {rating ? (
        <>
          <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
            {t('comehome.rate.rated', { n: rating })}
          </Text>
          <Button label={t('comehome.rate.clear')} hint={t('comehome.rate.clearHint')} kind="quiet" onPress={() => void commit(setRating(trip, null))} />
        </>
      ) : null}
    </SectionCard>
  );
}
