// T114 Call home planner (owner-1031 D: deepen Trips + Emergency contacts). People back home with a name, time zone
// (searchable list), optional phone and their awake hours; the traveller's own awake hours. For each person: their
// clock right now ("It's 03:10 for Mum - asleep"), the next good window and Call / Message / FaceTime links; for the
// chosen person, every trip day in that day's stop zone with a 24 h strip and the windows in words. People can be
// started from a trusted contact (I'm safe). Everything is kept on this phone only (src/state/callhome.ts).
// T116: a trip day's zone can be set by hand (an overnight flight day), kept in the same phone-only store.
import { useLocalSearchParams } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import {
  dayZonesFor,
  DEFAULT_HOURS,
  draftErrors,
  draftFromContact,
  draftOf,
  importable,
  MAX_PEOPLE,
  newDraft,
  removePerson,
  savePerson,
  setDayZone,
  tripCallDays,
  type CallDay,
  type CallHomeStore,
  type CallPerson,
  type DraftError,
  type PersonDraft,
} from '../src/core/callhome.ts';
import { deviceZone, formatDay, zoneCity } from '../src/core/format.ts';
import { newId, type Trip } from '../src/core/model.ts';
import type { SafeContact } from '../src/core/safecheck.ts';
import type { Key } from '../src/i18n/en.ts';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { saveCallHome, useCallHome } from '../src/state/callhome.ts';
import { useSafeContacts } from '../src/state/safeContacts.ts';
import { useTrips } from '../src/state/trips.tsx';
import { space, typeScale } from '../src/theme/tokens.ts';
import { CallButtons, DayBlock, HoursField, nextLine, nowLine, phoneTrip, StripLegend, useNextDays } from '../src/ui/callhome.tsx';
import { FadeInView, SectionCard } from '../src/ui/hero.tsx';
import { useMinute } from '../src/ui/JetLagCard.tsx';
import { Body, Button, Chip, Label, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { ZoneField } from '../src/ui/ZonePicker.tsx';

type Editing = { id: string | null; draft: PersonDraft };

/**
 * T116: under each trip day, set its zone by hand (suggesting the neighbouring days' and the home zones, so an
 * overnight flight day is one tap) or go back to what the bookings give.
 */
function DayZoneRow({
  day,
  suggestions,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  day: CallDay;
  suggestions: string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (tz: string | null) => void;
}) {
  const { t, theme, lang } = useApp();
  const label = formatDay(day.date, lang);
  if (open) {
    return (
      <View style={{ gap: space.s }}>
        <ZoneField
          label={t('f98.callhome.zone.field', { day: label })}
          value={day.tz}
          onChange={onPick}
          hint={t('f98.callhome.zone.fieldHint')}
          suggestions={suggestions.filter((z) => z !== day.tz)}
          chipLabel={(city) => t('f98.callhome.zone.chip', { city })}
        />
        <Button label={t('f98.callhome.zone.cancel')} hint={t('f98.callhome.zone.cancelHint')} kind="quiet" onPress={onClose} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      {day.manual ? <Text style={[typeScale.small, { color: theme.accent }]}>{t('f98.callhome.zone.manual', { city: zoneCity(day.tz) })}</Text> : null}
      {day.manual ? (
        <Button label={t('f98.callhome.zone.reset', { day: label })} hint={t('f98.callhome.zone.resetHint')} kind="quiet" icon="refresh-outline" onPress={() => onPick(null)} />
      ) : (
        <Button label={t('f98.callhome.zone.set', { day: label })} hint={t('f98.callhome.zone.setHint')} kind="quiet" icon="globe-outline" onPress={onOpen} />
      )}
    </View>
  );
}

function PersonCard({ person, trip, store, now, onEdit }: { person: CallPerson; trip: Trip; store: CallHomeStore; now: number; onEdit: () => void }) {
  const { t, theme, lang } = useApp();
  const days = useNextDays(trip, store, person, now);
  const youTz = days[0]?.tz ?? deviceZone();
  const right = nowLine(t, person, youTz, now);
  const next = nextLine(t, person, days, now, lang);
  return (
    <SectionCard
      title={person.name}
      subtitle={t('callhome.now.zone', { city: zoneCity(person.tz) })}
      icon="person-outline"
      tone="sea"
      action={{ label: t('callhome.people.edit', { name: person.name }), hint: t('callhome.people.editHint'), onPress: onEdit }}
    >
      <View accessible style={{ gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{right}</Text>
        <Text style={[typeScale.body, { color: next.now ? theme.ok : theme.ink, fontVariant: ['tabular-nums'] }]}>{next.text}</Text>
      </View>
      <CallButtons person={person} />
    </SectionCard>
  );
}

function PersonForm({
  editing,
  homeTz,
  onChange,
  onSave,
  onCancel,
  onDelete,
  error,
}: {
  editing: Editing;
  homeTz: string;
  onChange: (d: PersonDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (() => void) | null;
  error: string | null;
}) {
  const { t } = useApp();
  const [tried, setTried] = useState(false);
  const d = editing.draft;
  const errs: DraftError[] = tried ? draftErrors(d) : [];
  const err = (k: DraftError) => (errs.includes(k) ? t(`callhome.form.err.${k}` as Key) : undefined);
  const name = d.name.trim();
  return (
    <SectionCard title={editing.id ? t('callhome.form.editTitle', { name: name || '…' }) : t('callhome.form.newTitle')} icon="create-outline" tone="accent">
      <TextField
        label={t('callhome.form.name')}
        value={d.name}
        onChange={(v) => onChange({ ...d, name: v })}
        placeholder={t('callhome.form.namePlaceholder')}
        error={err('name')}
        autoCapitalize="words"
      />
      <ZoneField
        label={t('callhome.form.zone')}
        value={d.tz}
        onChange={(tz) => onChange({ ...d, tz })}
        hint={t('callhome.form.zoneHint')}
        error={err('tz')}
        suggestions={[homeTz]}
        chipLabel={(city) => t('callhome.form.zoneChip', { city })}
      />
      <TextField
        label={t('callhome.form.phone')}
        value={d.phone}
        onChange={(v) => onChange({ ...d, phone: v })}
        placeholder={t('callhome.form.phonePlaceholder')}
        error={err('phone')}
        inputMode="tel"
      />
      <Label>{t('callhome.form.hours')}</Label>
      <HoursField hours={d.hours} onChange={(hours) => onChange({ ...d, hours })} />
      {err('hours') ? <Warning text={err('hours') as string} /> : null}
      {error ? <Warning text={error} /> : null}
      <Button
        label={t('callhome.form.save')}
        hint={t('callhome.form.saveHint')}
        icon="checkmark"
        onPress={() => {
          setTried(true);
          onSave();
        }}
      />
      <Button label={t('callhome.form.cancel')} hint={t('callhome.form.cancelHint')} kind="quiet" onPress={onCancel} />
      {onDelete ? (
        <Button
          label={t('callhome.form.delete', { name: name || '…' })}
          hint={t('callhome.form.deleteHint')}
          kind="quiet"
          icon="trash-outline"
          onPress={onDelete}
        />
      ) : null}
    </SectionCard>
  );
}

export default function CallHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const found = trips.find((x) => x.id === tripId);
  const trip = useMemo(() => found ?? phoneTrip(), [found]);
  const [store, loaded] = useCallHome();
  const [contacts] = useSafeContacts();
  const now = useMinute();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [zoneDate, setZoneDate] = useState<string | null>(null);
  const homeTz = trip.homeTz || deviceZone();
  const picked = store.people.find((p) => p.id === pickedId) ?? store.people[0] ?? null;
  const zones = dayZonesFor(store, found?.id ?? '');
  const days = useMemo(() => (found && picked ? tripCallDays(found, store.me, picked, zones) : []), [found, picked, store.me, zones]);
  const offers = useMemo(() => importable(contacts, store), [contacts, store]);
  const full = store.people.length >= MAX_PEOPLE;

  const save = async () => {
    if (!editing) return;
    setError(null);
    if (draftErrors(editing.draft).length) return;
    const id = editing.id ?? newId('call');
    let reason: string | null = null;
    const ok = await saveCallHome((old) => {
      const r = savePerson(old, editing.draft, id);
      if (!r.ok) {
        reason = r.reason;
        return old;
      }
      return r.store;
    });
    if (reason) return setError(reason === 'full' ? t('callhome.people.full', { n: MAX_PEOPLE }) : t(`callhome.form.err.${reason}` as Key));
    if (!ok) return setError(t('callhome.form.err.save'));
    haptic.success();
    setEditing(null);
    setPickedId(id);
  };

  const remove = (p: CallPerson) =>
    Alert.alert(t('callhome.form.deleteConfirmTitle', { name: p.name }), t('callhome.form.deleteConfirmBody'), [
      { text: t('callhome.form.cancel'), style: 'cancel' },
      {
        text: t('callhome.form.delete', { name: p.name }),
        style: 'destructive',
        onPress: async () => {
          if (await saveCallHome((old) => removePerson(old, p.id))) {
            setEditing(null);
            setError(null);
          } else setError(t('callhome.form.err.save'));
        },
      },
    ]);

  const saveMe = async (me: CallHomeStore['me']) => {
    if (!(await saveCallHome((old) => ({ ...old, me })))) setError(t('callhome.form.err.save'));
  };

  const pickDayZone = async (date: string, tz: string | null) => {
    if (!found) return;
    setZoneDate(null);
    if (await saveCallHome((old) => setDayZone(old, found.id, date, tz))) haptic.success();
    else setError(t('f98.callhome.zone.err'));
  };

  const startFrom = (c: SafeContact) => {
    setError(null);
    setEditing({ id: null, draft: draftFromContact(c, homeTz) });
    AccessibilityInfo.announceForAccessibility(t('callhome.form.newTitle'));
  };

  return (
    <Screen>
      <FadeInView>
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
            {t('callhome.title')}
          </Text>
          {found ? <Text style={[typeScale.bodyStrong, { color: theme.teal }]}>{found.name}</Text> : null}
          <Body muted>{t('callhome.intro')}</Body>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('callhome.phoneOnly')}</Text>
          {tripId && !found ? <Warning text={t('callhome.tripNotFound')} /> : null}
        </View>
      </FadeInView>

      <SectionCard title={t('callhome.me.title')} subtitle={t('callhome.me.body')} icon="sunny-outline" tone="accent">
        <HoursField hours={loaded ? store.me : DEFAULT_HOURS} onChange={saveMe} />
      </SectionCard>

      {editing ? (
        <PersonForm
          editing={editing}
          homeTz={homeTz}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
          onDelete={editing.id ? () => remove(store.people.find((p) => p.id === editing.id) as CallPerson) : null}
          error={error}
        />
      ) : null}

      <View style={{ gap: space.m }}>
        <View accessibilityRole="header">
          <Label>{t('callhome.people.title')}</Label>
        </View>
        {store.people.length === 0 ? <Body muted>{t('callhome.people.empty')}</Body> : null}
        {store.people.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            trip={trip}
            store={store}
            now={now}
            onEdit={() => {
              setError(null);
              setEditing({ id: p.id, draft: draftOf(p) });
            }}
          />
        ))}
        {!editing && !full ? (
          <Button
            label={t('callhome.people.add')}
            hint={t('callhome.people.addHint')}
            icon="person-add-outline"
            kind={store.people.length ? 'secondary' : 'primary'}
            onPress={() => {
              setError(null);
              setEditing({ id: null, draft: newDraft(homeTz) });
            }}
          />
        ) : null}
        {full ? <Body muted>{t('callhome.people.full', { n: MAX_PEOPLE })}</Body> : null}
        {!editing && !full && offers.length ? (
          <View style={{ gap: space.s }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('callhome.import.title')}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('callhome.import.body')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {offers.map((c) => (
                <Button
                  key={c.id}
                  kind="quiet"
                  icon="person-outline"
                  label={t('callhome.import.chip', { name: c.name || c.phone })}
                  hint={t('callhome.import.hint')}
                  onPress={() => startFrom(c)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {found && picked ? (
        <SectionCard title={t('callhome.days.title', { name: picked.name })} subtitle={t('f98.callhome.days.body')} icon="calendar-outline" tone="teal">
          {store.people.length > 1 ? (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('callhome.people.pick')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}
            >
              {store.people.map((p) => (
                <Chip key={p.id} label={p.name} selected={p.id === picked.id} onPress={() => setPickedId(p.id)} />
              ))}
            </View>
          ) : null}
          <StripLegend name={picked.name} />
          {!editing && error ? <Warning text={error} /> : null}
          {days.length ? (
            days.map((d, k) => (
              <Fragment key={d.date}>
                <DayBlock day={d} name={picked.name} now={now} />
                <DayZoneRow
                  day={d}
                  suggestions={[days[k - 1]?.tz, days[k + 1]?.tz, homeTz].filter((z): z is string => !!z)}
                  open={zoneDate === d.date}
                  onOpen={() => {
                    setError(null);
                    setZoneDate(d.date);
                  }}
                  onClose={() => setZoneDate(null)}
                  onPick={(tz) => pickDayZone(d.date, tz)}
                />
              </Fragment>
            ))
          ) : (
            <Body muted>{t('callhome.days.none')}</Body>
          )}
        </SectionCard>
      ) : null}
    </Screen>
  );
}
