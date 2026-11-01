// T147 Postcards: the people to write to on this trip (name and postal address, on this phone only), a sent tick that
// records the date and the stop it was sent from (on that stop's own zone), a big-address view for the post office
// counter, and "what to write" prompts from that day's journal pages and ideas (no AI, no network). Logic in
// src/core/postcards.ts; store in src/state/postcards.ts; art in src/ui/postcardArt.tsx.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../../src/core/format.ts';
import { defaultJournalDay, tripZoneAt } from '../../src/core/journal.ts';
import { newId, type LocalDate, type Trip } from '../../src/core/model.ts';
import {
  draftFromPerson,
  hasAddress,
  newPersonDraft,
  orderedPeople,
  removePerson,
  sentCount,
  setSent,
  upsertPerson,
  validatePerson,
  writePrompts,
  type PersonDraft,
  type PostcardBook,
  type PostcardPerson,
  type Prompt,
} from '../../src/core/postcards.ts';
import { addDays } from '../../src/core/tz.ts';
import { weatherStops } from '../../src/core/weather.ts';
import { useApp } from '../../src/state/app.tsx';
import { savePostcards, usePostcards } from '../../src/state/postcards.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, SectionCard, type IconName } from '../../src/ui/hero.tsx';
import { Body, Button, EmptyState, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';
import { PostcardArt, StampMark } from '../../src/ui/postcardArt.tsx';
import { countLine, promptText, sentLine } from '../../src/ui/postcards.tsx';
import { TripAccentBand } from '../../src/ui/TripAccentBand.tsx';

export default function PostcardsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('postcards.title')} body={t('postcards.notFound')} />
      </Screen>
    );
  }
  return <Postcards trip={trip} />;
}

function Postcards({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const [book, loaded] = usePostcards(trip.id);
  // null: form closed; '': adding; an id: editing that person.
  const [editing, setEditing] = useState<string | null>(null);
  const c = sentCount(book);
  const people = useMemo(() => orderedPeople(book), [book]);

  const save = async (next: PostcardBook) => {
    const ok = await savePostcards(trip.id, next);
    if (!ok) Alert.alert(t('postcards.saveFailed.title'), t('postcards.saveFailed.body'));
    return ok;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('postcards.route') }} />
      <TripAccentBand trip={trip} />
      <FadeInView style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <PostcardArt width={128} />
        <View accessible style={{ flex: 1, gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
            {t('postcards.title')}
          </Text>
          <Text style={[typeScale.bodyStrong, { color: c.total && c.sent < c.total ? theme.accentInk : theme.muted }]}>{countLine(t, c)}</Text>
        </View>
      </FadeInView>
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="phone-portrait-outline" size={16} color={theme.muted} />
        </View>
        <Text style={[typeScale.small, { flex: 1, color: theme.muted }]}>{t('postcards.phoneOnly')}</Text>
      </View>

      {loaded && !people.length && editing === null ? (
        <SectionCard title={t('postcards.emptyTitle')} subtitle={t('postcards.emptyBody')} icon="mail-outline" tone="accent">
          <Button label={t('postcards.add')} hint={t('postcards.addHint')} icon="person-add-outline" onPress={() => setEditing('')} />
        </SectionCard>
      ) : null}

      {people.map((p, i) =>
        editing === p.id ? (
          <PersonForm key={p.id} person={p} onCancel={() => setEditing(null)} onSave={(d) => save(upsertPerson(book, d, newId, p.id)).then((ok) => ok && setEditing(null))} onRemove={() => save(removePerson(book, p.id)).then((ok) => ok && setEditing(null))} />
        ) : (
          <FadeInView key={p.id} delay={Math.min(i, 6) * 40}>
            <PersonRow trip={trip} person={p} onEdit={() => setEditing(p.id)} onToggle={(sent) => save(setSent(book, p.id, sent, Date.now(), weatherStops(trip, Date.now()), tripZoneAt(trip, Date.now())))} />
          </FadeInView>
        ),
      )}

      {editing === '' ? (
        <PersonForm onCancel={() => setEditing(null)} onSave={(d) => save(upsertPerson(book, d, newId)).then((ok) => ok && setEditing(null))} />
      ) : people.length && editing === null ? (
        <Button label={t('postcards.addAnother')} hint={t('postcards.addHint')} kind="secondary" icon="person-add-outline" onPress={() => setEditing('')} />
      ) : null}

      <PromptsCard trip={trip} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------------------- people

function PersonRow({ trip, person, onEdit, onToggle }: { trip: Trip; person: PostcardPerson; onEdit: () => void; onToggle: (sent: boolean) => Promise<boolean> }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const sent = !!person.sent;
  const preview = [person.lines[0], person.country.trim()].filter(Boolean).join(' · ');
  const toggle = () => {
    void onToggle(!sent).then((ok) => {
      if (ok) AccessibilityInfo.announceForAccessibility(sent ? t('postcards.unsentDone', { name: person.name }) : t('postcards.sentDone', { name: person.name }));
    });
  };
  return (
    <View style={{ borderRadius: radius.l, padding: space.l, gap: space.m, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <StampMark sent={sent} size={36} />
        <View accessible style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{person.name}</Text>
          {preview ? (
            <Text numberOfLines={1} style={[typeScale.small, { color: theme.muted }]}>
              {preview}
            </Text>
          ) : (
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('postcards.noAddress')}</Text>
          )}
          {person.sent ? <Text style={[typeScale.small, { color: theme.ok }]}>{sentLine(t, person.sent, lang)}</Text> : null}
        </View>
      </View>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={t('postcards.sentToggle', { name: person.name })}
        accessibilityHint={sent ? t('postcards.sentToggleOffHint') : t('postcards.sentToggleHint')}
        accessibilityState={{ checked: sent }}
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, borderRadius: radius.pill, paddingHorizontal: space.l, backgroundColor: sent ? theme.okSoft : theme.accentSoft }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={sent ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sent ? theme.ok : theme.accentInk} />
        </View>
        <Text style={[typeScale.bodyStrong, { color: sent ? theme.ok : theme.accentInk }]}>{sent ? t('postcards.sentYes') : t('postcards.markSent')}</Text>
      </PressableScale>
      <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
        <SmallButton
          icon="expand-outline"
          label={t('postcards.big')}
          a11y={t('postcards.bigA11y', { name: person.name })}
          hint={hasAddress(person) ? t('postcards.bigHint') : t('postcards.bigHintEmpty')}
          onPress={() => router.push({ pathname: '/postcards/address', params: { tripId: trip.id, personId: person.id } })}
        />
        <SmallButton icon="create-outline" label={t('postcards.edit')} a11y={t('postcards.editA11y', { name: person.name })} hint={t('postcards.editHint')} onPress={onEdit} />
      </View>
    </View>
  );
}

function SmallButton({ icon, label, a11y, hint, onPress }: { icon: IconName; label: string; a11y: string; hint: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.cardRaised }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={18} color={theme.sea} />
      </View>
      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{label}</Text>
    </PressableScale>
  );
}

function PersonForm({ person, onSave, onCancel, onRemove }: { person?: PostcardPerson; onSave: (d: PersonDraft) => Promise<unknown>; onCancel: () => void; onRemove?: () => Promise<unknown> }) {
  const { t, theme } = useApp();
  const [d, setD] = useState<PersonDraft>(() => (person ? draftFromPerson(person) : newPersonDraft()));
  const [tried, setTried] = useState(false);
  const errors = validatePerson(d);
  const submit = () => {
    setTried(true);
    if (errors.length) {
      AccessibilityInfo.announceForAccessibility(t('postcards.form.nameError'));
      return;
    }
    void onSave(d);
  };
  const remove = () =>
    Alert.alert(t('postcards.remove.title', { name: person?.name ?? '' }), t('postcards.remove.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('postcards.remove.confirm'), style: 'destructive', onPress: () => void onRemove?.() },
    ]);
  return (
    <FadeInView>
      <SectionCard title={person ? t('postcards.form.editTitle') : t('postcards.form.addTitle')} icon="person-outline" tone="sea">
        <TextField label={t('postcards.form.name')} value={d.name} onChange={(v) => setD((o) => ({ ...o, name: v }))} placeholder={t('postcards.form.namePlaceholder')} autoCapitalize="words" error={tried && errors.includes('name') ? t('postcards.form.nameError') : undefined} />
        <TextField label={t('postcards.form.address')} value={d.address} onChange={(v) => setD((o) => ({ ...o, address: v }))} placeholder={t('postcards.form.addressPlaceholder')} multiline autoCapitalize="words" />
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('postcards.form.addressHelp')}</Text>
        <TextField label={t('postcards.form.country')} value={d.country} onChange={(v) => setD((o) => ({ ...o, country: v }))} placeholder={t('postcards.form.countryPlaceholder')} autoCapitalize="words" />
        <Button label={t('postcards.form.save')} hint={t('postcards.form.saveHint')} icon="checkmark" onPress={submit} />
        <Button label={t('common.cancel')} hint={t('postcards.form.cancelHint')} kind="quiet" onPress={onCancel} />
        {person && onRemove ? <Button label={t('postcards.remove.button')} hint={t('postcards.remove.hint')} kind="quiet" icon="trash-outline" onPress={remove} /> : null}
      </SectionCard>
    </FadeInView>
  );
}

// ---------------------------------------------------------------------------------------------------------- prompts

const PROMPT_ICON: Record<Prompt['kind'], IconName> = {
  note: 'book-outline',
  place: 'location-outline',
  went: 'footsteps-outline',
  plan: 'compass-outline',
  mood: 'happy-outline',
  weather: 'partly-sunny-outline',
  generic: 'sparkles-outline',
};

function PromptsCard({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const [day, setDay] = useState<LocalDate>(() => defaultJournalDay(trip));
  const prompts = useMemo(() => writePrompts(trip, day), [trip, day]);
  const canBack = day > trip.startDate;
  const canNext = day < trip.endDate;
  const dayText = formatDay(day, lang);
  return (
    <SectionCard title={t('postcards.prompts.title')} subtitle={t('postcards.prompts.sub')} icon="create-outline" tone="accent">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <DayStep icon="chevron-back" label={t('postcards.prompts.prev')} enabled={canBack} onPress={() => setDay((d) => addDays(d, -1))} />
        <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { flex: 1, textAlign: 'center', color: theme.ink }]}>
          {dayText}
        </Text>
        <DayStep icon="chevron-forward" label={t('postcards.prompts.next')} enabled={canNext} onPress={() => setDay((d) => addDays(d, 1))} />
      </View>
      <FadeInView key={day} style={{ gap: space.s }}>
        {prompts.map((p, i) => (
          <View key={`${p.kind}${i}`} accessible style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
              <Ionicons name={PROMPT_ICON[p.kind]} size={18} color={theme.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Body>{promptText(t, p)}</Body>
            </View>
          </View>
        ))}
      </FadeInView>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('postcards.prompts.from')}</Text>
    </SectionCard>
  );
}

function DayStep({ icon, label, enabled, onPress }: { icon: IconName; label: string; enabled: boolean; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{ width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardRaised, opacity: enabled ? 1 : 0.4 }}
    >
      <Ionicons name={icon} size={20} color={theme.ink} />
    </PressableScale>
  );
}
