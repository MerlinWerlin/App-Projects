// Idea editor (T81 Places to go): name, category chips, note, link (plain text; only a web address gets an Open
// link button), an optional map spot (Set on map / Pick a saved place, the booking form's PositionField), the trip
// day it is planned for (Not planned, or a timeline day), and Been there. Leaving with changes asks first; Delete
// asks first. Nothing is stored until Save.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, View } from 'react-native';
import { formatDay } from '../src/core/format.ts';
import {
  draftFromIdea,
  findIdea,
  ideaDayKeys,
  ideaDayNumber,
  ideaFromDraft,
  ideaJournalDay,
  isIdeaCategory,
  isWebLink,
  newIdeaDraft,
  removeIdea,
  sameIdeaDraft,
  upsertIdea,
  validateIdea,
  type IdeaDraft,
  type IdeaError,
} from '../src/core/ideas.ts';
import { entriesOn } from '../src/core/journal.ts';
import { newId } from '../src/core/model.ts';
import type { Key } from '../src/i18n/en.ts';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { space } from '../src/theme/tokens.ts';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { CATEGORIES, categoryKey, IDEA_ICONS } from '../src/ui/ideas.tsx';
import { IconChips } from '../src/ui/journal.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, Screen, TextField, ToggleRow, Warning } from '../src/ui/kit.tsx';
import { PositionField } from '../src/ui/PositionField.tsx';

const ERR_KEYS: Record<IdeaError, Key> = { name: 'ideas.edit.err.name', day: 'ideas.edit.err.day', pos: 'ideas.edit.err.pos' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function IdeaEditScreen() {
  const params = useLocalSearchParams<{ tripId: string; ideaId?: string; day?: string; category?: string }>();
  const { t, lang } = useApp();
  const { trips, saveTrip } = useTrips();
  const router = useRouter();
  const trip = trips.find((x) => x.id === params.tripId);
  const prev = trip && params.ideaId ? findIdea(trip, params.ideaId) : undefined;
  const [initial] = useState<IdeaDraft>(() =>
    prev ? draftFromIdea(prev) : newIdeaDraft(params.day && DATE.test(params.day) ? params.day : '', isIdeaCategory(params.category) ? params.category : 'see'),
  );
  const [d, setD] = useState<IdeaDraft>(initial);
  const [errors, setErrors] = useState<IdeaError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const { leaving, gestureEnabled } = useDiscardConfirm(!sameIdeaDraft(initial, d));
  const days = useMemo(() => (trip ? ideaDayKeys(trip) : []), [trip]);

  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('ideas.title')} body={t('ideas.notFound')} />
      </Screen>
    );
  }

  // A day the idea was planned for that is no longer on the timeline (trip dates changed) stays offered.
  const dayChoices = d.day && !days.includes(d.day) ? [...days, d.day].sort() : days;
  const err = (e: IdeaError) => (errors.includes(e) ? t(ERR_KEYS[e]) : undefined);
  const dayLabel = (day: string) => {
    const n = ideaDayNumber(trip, day);
    const date = formatDay(day, lang);
    return n != null ? t('ideas.edit.dayChip', { n, date }) : date;
  };
  const linkPlain = d.link.trim() !== '' && !isWebLink(d.link);

  const save = async () => {
    const e = validateIdea(d);
    setErrors(e);
    if (e.length) {
      AccessibilityInfo.announceForAccessibility(t(ERR_KEYS[e[0]]));
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const idea = ideaFromDraft(d, newId, prev);
    const ok = await saveTrip(upsertIdea(trip, idea));
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('ideas.saveFailed.title'));
      return;
    }
    haptic.success();
    leaving();
    router.back();
    // Just ticked Been there: offer the journal page for that day (never written without asking).
    if (d.done && !initial.done) {
      const day = ideaJournalDay(trip, idea);
      const page = entriesOn(trip, day)[0];
      Alert.alert(t('ideas.been.title'), t(page ? 'ideas.been.bodyOpen' : 'ideas.been.body', { name: idea.name, day: formatDay(day, lang) }), [
        { text: t('ideas.been.notNow'), style: 'cancel' },
        { text: t(page ? 'ideas.been.open' : 'ideas.been.write'), onPress: () => router.push({ pathname: '/journal-edit', params: { tripId: trip.id, entryId: page?.id ?? '', day } }) },
      ]);
    }
  };

  const remove = () => {
    if (!prev) return;
    Alert.alert(t('ideas.edit.deleteConfirm'), t('ideas.edit.deleteBody', { name: prev.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ideas.edit.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!(await saveTrip(removeIdea(trip, prev.id)))) {
            setSaveFailed(true);
            return;
          }
          leaving();
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t(prev ? 'ideas.edit.title' : 'ideas.edit.newTitle'), gestureEnabled }} />

      <TextField label={t('ideas.edit.name')} value={d.name} onChange={(name) => setD((o) => ({ ...o, name }))} placeholder={t('ideas.edit.namePlaceholder')} error={err('name')} />

      <Card style={{ gap: space.m }}>
        <Label>{t('ideas.edit.category')}</Label>
        <IconChips
          group={t('ideas.edit.category')}
          values={CATEGORIES}
          selected={d.category}
          icon={(c) => IDEA_ICONS[c]}
          label={(c) => t(categoryKey(c))}
          a11yLabel={(c) => t('f90.ideaCat.a11y', { cat: t(categoryKey(c)) })}
          a11yHint={(c, on) => (on ? t('f90.ideaCat.hintOn') : t('f90.ideaCat.hint', { cat: t(categoryKey(c)) }))}
          onChange={(c) => setD((o) => ({ ...o, category: c ?? o.category }))}
        />
      </Card>

      <TextField label={t('ideas.edit.note')} value={d.note} onChange={(note) => setD((o) => ({ ...o, note }))} placeholder={t('ideas.edit.notePlaceholder')} multiline />

      <View style={{ gap: space.xs }}>
        <TextField label={t('ideas.edit.link')} value={d.link} onChange={(link) => setD((o) => ({ ...o, link }))} placeholder={t('ideas.edit.linkPlaceholder')} autoCapitalize="none" />
        {linkPlain ? <Body muted>{t('ideas.edit.linkPlain')}</Body> : null}
      </View>

      <Card style={{ gap: space.m }}>
        <PositionField
          label={t('ideas.edit.spot')}
          value={d.pos}
          trip={trip}
          onChange={(pos, name) => setD((o) => ({ ...o, pos, spotName: pos ? (name ?? '') : '', name: o.name.trim() || !name ? o.name : name }))}
        />
        {err('pos') ? <Warning text={err('pos')!} /> : null}
        <Body muted>{t('ideas.edit.spotNote')}</Body>
      </Card>

      <Card style={{ gap: space.m }}>
        <Label>{t('ideas.edit.day')}</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('ideas.edit.day')} contentContainerStyle={{ gap: space.s, paddingVertical: space.xs }}>
          <Chip label={t('ideas.edit.dayNone')} selected={d.day === ''} onPress={() => setD((o) => ({ ...o, day: '' }))} />
          {dayChoices.map((day) => (
            <Chip key={day} label={dayLabel(day)} selected={d.day === day} onPress={() => setD((o) => ({ ...o, day }))} />
          ))}
        </ScrollView>
        {err('day') ? <Warning text={err('day')!} /> : null}
        <Body muted>{t('ideas.edit.dayNote')}</Body>
      </Card>

      <Card>
        <ToggleRow label={t('ideas.edit.been')} hint={t('ideas.edit.beenHint')} value={d.done} onChange={(done) => setD((o) => ({ ...o, done }))} />
      </Card>

      {saveFailed ? <ErrorNotice title={t('ideas.saveFailed.title')} body={t('ideas.saveFailed.body')} action={t('common.tryAgain')} actionHint={t('ideas.edit.saveHint')} onAction={save} /> : null}
      <Button label={t('ideas.edit.save')} hint={t('ideas.edit.saveHint')} icon="checkmark" onPress={save} />
      {prev ? <Button label={t('ideas.edit.delete')} hint={t('ideas.edit.deleteHint')} kind="quiet" icon="trash-outline" onPress={remove} /> : null}
      <Button label={t('common.cancel')} hint={t('ideas.edit.cancelHint')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
