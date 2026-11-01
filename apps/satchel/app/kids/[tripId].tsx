// T149 Travelling with kids for one trip: who is coming (first name + age group, no birth dates), who the lost card
// says to call, an If I am lost card per child, packing rows by age group merged into the trip's packing list (own
// rows kept, nothing doubled), car-seat / stroller and snack / sleep reminders on the journeys and hire cars still
// ahead, the traveller's own kid-friendly marks on Places to go, and the trip-file switch for the names (default
// off). Everything here is kept on this phone (src/state/kids.ts). Logic in src/core/kids.ts.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { EMERGENCY_KEY, EMPTY_CARD, normaliseCard } from '../../src/core/emergency.ts';
import { deviceZone, formatDay, formatDuration, formatTime, todayIn } from '../../src/core/format.ts';
import { readIdeas } from '../../src/core/ideas.ts';
import {
  AGE_BANDS,
  bandsOf,
  isKidFriendly,
  mergeKidsPacking,
  missingKidsRows,
  parentToCall,
  removeChild,
  saveChild,
  setExportNames,
  setParent,
  toggleKidFriendly,
  tripReminders,
  type AgeBand,
  type Child,
  type ChildError,
  type KidsData,
} from '../../src/core/kids.ts';
import { newId, type EmergencyCard, type Trip } from '../../src/core/model.ts';
import { EMPTY_STORE, emptyList, listFor, PACKING_KEY, putList, type PackStore } from '../../src/core/packing.ts';
import { dialable } from '../../src/core/staydetails.ts';
import { localDate } from '../../src/core/tz.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveKids, useKids } from '../../src/state/kids.ts';
import { setPersistedChecked, usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView } from '../../src/ui/hero.tsx';
import { bandKey, KidsArt } from '../../src/ui/kids.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, TextField, Title, ToggleRow, Warning } from '../../src/ui/kit.tsx';
import { useMinute } from '../../src/ui/TripPass.tsx';

export default function KidsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="suitcase" title={t('kids.title')} body={t('kids.notFound')} />
      </Screen>
    );
  }
  return <Kids trip={trip} />;
}

type Draft = { id: string | null; name: string; band: AgeBand };
const NEW_DRAFT: Draft = { id: null, name: '', band: 'child' };

function Kids({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useMinute();
  const [data, loaded] = useKids(trip.id);
  const [storedCard] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [error, setError] = useState<ChildError | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [parentPhone, setParentPhone] = useState<string | null>(null);
  const [parentSaved, setParentSaved] = useState(false);
  const [packNote, setPackNote] = useState<string | null>(null);

  const card = useMemo(() => normaliseCard(storedCard), [storedCard]);
  const bands = bandsOf(data);
  const label = (row: string) => t(`kids.pack.${row}` as Key);
  const list = listFor(store, trip.id) ?? emptyList(trip.id);
  const missing = missingKidsRows(list, bands, label);
  const reminders = useMemo(() => tripReminders(trip, data, now), [trip, data, now]);
  const ideas = useMemo(() => readIdeas(trip), [trip]);
  const pName = parentName ?? data.parentName;
  const pPhone = parentPhone ?? data.parentPhone;
  const caller = parentToCall(data, card);

  const commit = async (next: KidsData) => {
    const ok = await saveKids(trip.id, next);
    setSaveFailed(!ok);
    return ok;
  };

  const saveDraft = async () => {
    const r = saveChild(data, draft.name, draft.band, draft.id ?? newId('kid'));
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    if (await commit(r.data)) setDraft(NEW_DRAFT);
  };

  const saveParent = async () => {
    if (pPhone.trim() && !dialable(pPhone)) return;
    const ok = await commit(setParent(data, pName, pPhone));
    setParentSaved(ok);
    if (ok) {
      setParentName(null);
      setParentPhone(null);
    }
  };

  const addRows = async () => {
    let added = 0;
    const ok = await setPersistedChecked<PackStore>(
      PACKING_KEY,
      (s) => {
        const base = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
        const m = mergeKidsPacking(listFor(base, trip.id) ?? emptyList(trip.id), bands, label, newId);
        added = m.added;
        return m.added ? putList(base, m.list) : base;
      },
      EMPTY_STORE,
    );
    setSaveFailed(!ok);
    if (ok) setPackNote(added === 0 ? t('kids.pack.none') : added === 1 ? t('kids.pack.addedOne') : t('kids.pack.addedMany', { n: added }));
  };

  const phoneError = pPhone.trim() && !dialable(pPhone) ? t('kids.parent.err') : undefined;
  const today = todayIn(deviceZone(), now);
  const lostDate = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;

  const childRow = (c: Child) => (
    <FadeInView key={c.id}>
      <View style={{ gap: space.s, paddingVertical: space.s, borderTopWidth: 1, borderTopColor: theme.line }}>
        <View accessible accessibilityLabel={t('kids.child.a11y', { name: c.name, band: t(bandKey(c.band)) })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: theme.accentInk }}>{c.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{c.name}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t(bandKey(c.band))}</Text>
          </View>
        </View>
        <Button
          kind="secondary"
          icon="help-buoy-outline"
          label={t('kids.child.lost')}
          hint={t('kids.child.lostHint', { name: c.name })}
          onPress={() => router.push({ pathname: '/kids/lost', params: { tripId: trip.id, childId: c.id, date: lostDate } })}
        />
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <View style={{ flex: 1 }}>
            <Button kind="quiet" icon="create-outline" label={t('kids.child.edit')} hint={t('kids.child.editHint', { name: c.name })} onPress={() => setDraft({ id: c.id, name: c.name, band: c.band })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="quiet" icon="trash-outline" label={t('kids.child.remove')} hint={t('kids.child.removeHint', { name: c.name })} onPress={() => commit(removeChild(data, c.id))} />
          </View>
        </View>
      </View>
    </FadeInView>
  );

  if (!loaded) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('kids.route') }} />
      <View style={{ alignItems: 'center' }}>
        <KidsArt size={150} />
      </View>
      <Title>{t('kids.title')}</Title>
      <Body muted>{trip.name}</Body>
      {saveFailed ? <Warning text={t('kids.saveFailed')} /> : null}

      <Card>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('kids.who.title')}
        </Text>
        {data.children.length === 0 ? (
          <View style={{ gap: space.xs }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('kids.empty.title')}</Text>
            <Body muted>{t('kids.empty.body')}</Body>
          </View>
        ) : (
          data.children.map(childRow)
        )}
        <View style={{ gap: space.s, paddingTop: space.s, borderTopWidth: 1, borderTopColor: theme.line }}>
          <TextField
            label={t('kids.add.name')}
            value={draft.name}
            placeholder={t('kids.add.namePlaceholder')}
            autoCapitalize="words"
            error={error === 'name' ? t('kids.err.name') : error === 'full' ? t('kids.err.full') : undefined}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <Label>{t('kids.band.label')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('kids.band.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {AGE_BANDS.map((b) => (
              <Chip key={b} label={t(bandKey(b))} hint={t('kids.band.hint')} selected={draft.band === b} onPress={() => setDraft((d) => ({ ...d, band: b }))} />
            ))}
          </View>
          <Body muted>{t('kids.who.note')}</Body>
          <Button
            icon={draft.id ? 'checkmark' : 'add'}
            label={draft.id ? t('kids.add.update') : t('kids.add.save')}
            hint={draft.id ? t('kids.add.updateHint') : t('kids.add.saveHint')}
            onPress={saveDraft}
          />
          {draft.id ? <Button kind="quiet" label={t('kids.add.cancel')} hint={t('kids.add.cancelHint')} onPress={() => setDraft(NEW_DRAFT)} /> : null}
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('kids.parent.title')}
        </Text>
        <TextField label={t('kids.parent.name')} value={pName} autoCapitalize="words" onChange={(v) => (setParentName(v), setParentSaved(false))} />
        <TextField label={t('kids.parent.phone')} value={pPhone} inputMode="tel" error={phoneError} onChange={(v) => (setParentPhone(v), setParentSaved(false))} />
        <Button kind="secondary" icon="call-outline" label={t('kids.parent.save')} hint={t('kids.parent.saveHint')} onPress={saveParent} />
        <View accessibilityLiveRegion="polite">
          {parentSaved ? <Body>{t('kids.parent.saved')}</Body> : null}
          {!dialable(data.parentPhone) ? <Body muted>{caller ? t('kids.parent.fromCard', { name: caller.name || caller.phone }) : t('kids.parent.none')}</Body> : null}
        </View>
      </Card>

      {bands.length ? (
        <Card>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('kids.pack.title')}
          </Text>
          <Body muted>{t('kids.pack.body')}</Body>
          {missing.length ? (
            <Button icon="bag-add-outline" label={missing.length === 1 ? t('kids.pack.addOne') : t('kids.pack.addMany', { n: missing.length })} hint={t('kids.pack.addHint')} onPress={addRows} />
          ) : null}
          <View accessibilityLiveRegion="polite">{packNote ? <Body>{packNote}</Body> : !missing.length ? <Body>{t('kids.pack.none')}</Body> : null}</View>
          <Button kind="quiet" icon="list-outline" label={t('kids.pack.open')} hint={t('kids.pack.openHint')} onPress={() => router.push({ pathname: '/packing/[tripId]', params: { tripId: trip.id } })} />
        </Card>
      ) : null}

      {bands.length ? (
        <Card>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('kids.remind.title')}
          </Text>
          {reminders.length === 0 ? <Body muted>{t('kids.remind.none')}</Body> : null}
          {reminders.map((r) => {
            const when = t('kids.remind.when', { date: formatDay(localDate(r.item.start.local), lang), time: formatTime(r.item.start.local) });
            const length = r.minutes != null && r.item.kind !== 'car' ? t('kids.remind.length', { d: formatDuration(r.minutes) }) : '';
            const lines = r.reminders.map((x) => t(`kids.remind.${x}` as Key));
            return (
              <PressableScale
                key={r.item.id}
                accessibilityRole="button"
                accessibilityLabel={[r.item.title, when, length, ...lines].filter(Boolean).join('. ')}
                accessibilityHint={t('kids.remind.openHint', { title: r.item.title })}
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: r.item.id } })}
                style={{ gap: space.xs, paddingVertical: space.s, borderTopWidth: 1, borderTopColor: theme.line }}
              >
                <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{r.item.title}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{[when, length].filter(Boolean).join(' · ')}</Text>
                {lines.map((l) => (
                  <View key={l} style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
                    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
                      <Ionicons name="ellipse" size={8} color={theme.accent} />
                    </View>
                    <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{l}</Text>
                  </View>
                ))}
              </PressableScale>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('kids.ideas.title')}
        </Text>
        <Body muted>{t('kids.ideas.body')}</Body>
        {ideas.length === 0 ? <Body muted>{t('kids.ideas.none')}</Body> : null}
        {ideas.map((i) => {
          const on = isKidFriendly(data, i.id);
          return (
            <PressableScale
              key={i.id}
              accessibilityRole="checkbox"
              accessibilityLabel={t('kids.ideas.markA11y', { name: i.name })}
              accessibilityHint={t('kids.ideas.markHint')}
              accessibilityState={{ checked: on }}
              onPress={() => commit(toggleKidFriendly(data, i.id))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderRadius: radius.m }}
            >
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? theme.accent : theme.muted} />
              <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{i.name}</Text>
            </PressableScale>
          );
        })}
      </Card>

      <Card>
        <ToggleRow label={t('kids.export.label')} hint={t('kids.export.hint')} value={data.exportNames} onChange={(v) => commit(setExportNames(data, v))} />
        <Body muted>{data.exportNames ? t('kids.export.on') : t('kids.export.off')}</Body>
      </Card>
      <Body muted>{t('kids.phoneOnly')}</Body>
    </Screen>
  );
}
