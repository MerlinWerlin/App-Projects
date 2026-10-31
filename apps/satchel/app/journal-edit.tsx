// Journal page editor (T64): day (stepped within the trip's dates), note, mood and weather icon chips, an optional
// saved place from the trip, and up to six photos from the library or camera. Photos are copied into Satchel as
// they are picked; leaving without saving removes the copies added here, and after Save the copies of removed
// photos go (the item form's attachment rules, src/core/journal.ts droppedPhotos). Delete asks first.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { formatDay } from '../src/core/format.ts';
import {
  addPhotos,
  defaultJournalDay,
  draftFromEntry,
  droppedPhotos,
  entryFromDraft,
  findEntry,
  MAX_JOURNAL_PHOTOS,
  newJournalDraft,
  photosLeft,
  removeEntry,
  removePhoto,
  upsertEntry,
  validateJournal,
  type JournalDraft,
  type JournalError,
  type JournalPhoto,
} from '../src/core/journal.ts';
import { newId } from '../src/core/model.ts';
import { placesByName } from '../src/core/places.ts';
import { addDays } from '../src/core/tz.ts';
import type { Key } from '../src/i18n/en.ts';
import { haptic, openSettings } from '../src/native/device.ts';
import { pickJournalPhotos, removeJournalPhotos, takeJournalPhoto, type PhotoPick } from '../src/native/journal.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { IconChips, MOOD_ICONS, moodKey, MOODS, PhotoThumb, WEATHER_ICONS, weatherKey, WEATHERS } from '../src/ui/journal.tsx';
import { Body, Button, Card, EmptyState, Label, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';

const THUMB = 96;
const ERR_KEYS: Record<JournalError, Key> = { empty: 'journal.edit.err.empty', day: 'journal.edit.err.day', photos: 'journal.edit.err.photos' };
type Problem = { key: Key; settings?: boolean } | null;

const sameDraft = (a: JournalDraft, b: JournalDraft) =>
  a.day === b.day &&
  a.note === b.note &&
  a.placeId === b.placeId &&
  a.mood === b.mood &&
  a.weather === b.weather &&
  a.photos.length === b.photos.length &&
  a.photos.every((p, i) => p.id === b.photos[i].id);

export default function JournalEditScreen() {
  const params = useLocalSearchParams<{ tripId: string; entryId?: string; day?: string }>();
  const { t, theme, lang } = useApp();
  const { trips, saveTrip } = useTrips();
  const router = useRouter();
  const trip = trips.find((x) => x.id === params.tripId);
  const prev = trip && params.entryId ? findEntry(trip, params.entryId) : undefined;
  const [initial] = useState<JournalDraft>(() => {
    if (prev) return draftFromEntry(prev);
    const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : trip ? defaultJournalDay(trip) : '';
    return newJournalDraft(day);
  });
  const [d, setD] = useState<JournalDraft>(initial);
  const [errors, setErrors] = useState<JournalError[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [refused, setRefused] = useState(0);
  // Photos copied in by this form, and whether the page was saved: on leaving unsaved, those copies go.
  const added = useRef<JournalPhoto[]>([]);
  const committed = useRef(false);
  useEffect(
    () => () => {
      if (!committed.current) removeJournalPhotos(droppedPhotos(added.current, initial.photos));
    },
    [initial],
  );
  const { leaving, gestureEnabled } = useDiscardConfirm(!sameDraft(initial, d));
  const places = useMemo(() => (trip ? placesByName(trip) : []), [trip]);

  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('journal.title')} body={t('journal.notFound')} />
      </Screen>
    );
  }

  const left = photosLeft(d.photos);
  const canPrev = d.day > trip.startDate;
  const canNext = d.day < trip.endDate;
  const err = (e: JournalError) => (errors.includes(e) ? t(ERR_KEYS[e]) : undefined);

  const take = async (how: 'library' | 'camera') => {
    if (busy || left <= 0) return;
    setBusy(true);
    setProblem(null);
    setRefused(0);
    try {
      const r: PhotoPick = how === 'library' ? await pickJournalPhotos(left) : await takeJournalPhoto();
      if (!r.ok) {
        if (r.reason === 'canceled') return;
        if (r.reason === 'denied') setProblem(how === 'camera' ? { key: 'journal.edit.camera.denied', settings: true } : { key: 'journal.edit.photos.denied', settings: r.permission !== 'unavailable' });
        else if (r.reason === 'unavailable') setProblem({ key: 'journal.edit.camera.unavailable' });
        else if (r.reason === 'storage') setProblem({ key: 'journal.edit.photos.storage' });
        else setProblem({ key: 'journal.edit.photos.unreadable' });
        return;
      }
      // The picker is modal and `busy` blocks a second pick, so the draft's photos can't change meanwhile.
      const res = addPhotos(d.photos, r.photos);
      added.current = [...added.current, ...res.added];
      if (res.refused.length) {
        setRefused(res.refused.length);
        removeJournalPhotos(res.refused.map((p) => p.uri));
      }
      setD((o) => ({ ...o, photos: res.photos }));
      haptic.success();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const e = validateJournal(d);
    setErrors(e);
    if (e.length) {
      AccessibilityInfo.announceForAccessibility(t(ERR_KEYS[e[0]]));
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const entry = entryFromDraft(d, newId, prev);
    const ok = await saveTrip(upsertEntry(trip, entry));
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('journal.edit.saveFailed.title'));
      return;
    }
    committed.current = true;
    removeJournalPhotos(droppedPhotos([...initial.photos, ...added.current], entry.photos));
    haptic.success();
    leaving();
    router.back();
  };

  const remove = () => {
    if (!prev) return;
    Alert.alert(t('journal.edit.deleteConfirm'), t('journal.edit.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journal.edit.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!(await saveTrip(removeEntry(trip, prev.id)))) {
            setSaveFailed(true);
            return;
          }
          committed.current = true;
          removeJournalPhotos(droppedPhotos([...initial.photos, ...added.current], []));
          leaving();
          router.back();
        },
      },
    ]);
  };

  const stepDay = (n: number) => setD((o) => ({ ...o, day: addDays(o.day, n) }));

  return (
    <Screen>
      <Stack.Screen options={{ title: t(prev ? 'journal.edit.title' : 'journal.edit.newTitle'), gestureEnabled }} />

      <Card>
        <Label>{t('journal.edit.day')}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('journal.edit.dayPrev')}
            accessibilityHint={t('journal.edit.dayPrevHint')}
            accessibilityState={{ disabled: !canPrev }}
            disabled={!canPrev}
            onPress={() => stepDay(-1)}
            style={{ width: TOUCH, alignItems: 'center', opacity: canPrev ? 1 : 0.4 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.sea} />
          </PressableScale>
          <Text accessibilityLiveRegion="polite" style={[typeScale.title, { flex: 1, textAlign: 'center', color: theme.ink }]}>
            {d.day ? formatDay(d.day, lang) : ''}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('journal.edit.dayNext')}
            accessibilityHint={t('journal.edit.dayNextHint')}
            accessibilityState={{ disabled: !canNext }}
            disabled={!canNext}
            onPress={() => stepDay(1)}
            style={{ width: TOUCH, alignItems: 'center', opacity: canNext ? 1 : 0.4 }}
          >
            <Ionicons name="chevron-forward" size={24} color={theme.sea} />
          </PressableScale>
        </View>
        {err('day') ? <Warning text={err('day')!} /> : null}
      </Card>

      <TextField label={t('journal.edit.note')} value={d.note} onChange={(note) => setD((o) => ({ ...o, note }))} placeholder={t('journal.edit.notePlaceholder')} multiline error={err('empty')} />

      <Card style={{ gap: space.m }}>
        <Label>{t('journal.edit.mood')}</Label>
        <IconChips
          group={t('journal.edit.mood')}
          values={MOODS}
          selected={d.mood}
          icon={(m) => MOOD_ICONS[m]}
          label={(m) => t(moodKey(m))}
          onChange={(mood) => setD((o) => ({ ...o, mood }))}
        />
        <Label>{t('journal.edit.weather')}</Label>
        <IconChips
          group={t('journal.edit.weather')}
          values={WEATHERS}
          selected={d.weather}
          icon={(w) => WEATHER_ICONS[w]}
          label={(w) => t(weatherKey(w))}
          onChange={(weather) => setD((o) => ({ ...o, weather }))}
        />
      </Card>

      <Card style={{ gap: space.m }}>
        <Label>{t('journal.edit.place')}</Label>
        {places.length ? (
          <IconChips
            group={t('journal.edit.place')}
            values={places.map((p) => p.id)}
            selected={d.placeId}
            icon={() => 'location-outline'}
            label={(id) => places.find((p) => p.id === id)?.name ?? ''}
            onChange={(placeId) => setD((o) => ({ ...o, placeId }))}
          />
        ) : (
          <Body muted>{t('journal.edit.placeEmpty')}</Body>
        )}
      </Card>

      <Card style={{ gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>{t('journal.edit.photos')}</Label>
          </View>
          <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('journal.edit.photosCount', { n: d.photos.length, max: MAX_JOURNAL_PHOTOS })}</Text>
        </View>
        {d.photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {d.photos.map((p, i) => (
              <View key={p.id} style={{ width: THUMB, gap: space.xs, alignItems: 'center' }}>
                <PhotoThumb photo={p} size={THUMB} label={t('journal.entry.photoA11y', { n: i + 1, total: d.photos.length })} />
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.edit.photoRemove', { n: i + 1 })}
                  accessibilityHint={t('journal.edit.photoRemoveHint')}
                  onPress={() => setD((o) => ({ ...o, photos: removePhoto(o.photos, p.id) }))}
                  style={{ width: THUMB, alignItems: 'center', borderRadius: radius.pill, backgroundColor: theme.dangerSoft }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.danger} />
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}
        {busy ? (
          <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
            {t('journal.edit.adding')}
          </Text>
        ) : null}
        {refused ? <Warning text={t('journal.edit.refused', { n: refused })} /> : null}
        {problem ? <Warning text={t(problem.key)} /> : null}
        {problem?.settings ? <Button label={t('journal.edit.openSettings')} hint={t('journal.edit.openSettingsHint')} kind="secondary" onPress={openSettings} /> : null}
        {err('photos') ? <Warning text={err('photos')!} /> : null}
        {left > 0 ? (
          <>
            <Button label={t('journal.edit.addLibrary')} hint={t('journal.edit.addLibraryHint')} kind="secondary" icon="images-outline" onPress={() => take('library')} />
            <Button label={t('journal.edit.addCamera')} hint={t('journal.edit.addCameraHint')} kind="quiet" icon="camera-outline" onPress={() => take('camera')} />
          </>
        ) : (
          <Body muted>{t('journal.edit.photosFull')}</Body>
        )}
        <Body muted>{t('journal.offline')}</Body>
      </Card>

      {saveFailed ? <ErrorNotice title={t('journal.edit.saveFailed.title')} body={t('journal.edit.saveFailed.body')} action={t('common.tryAgain')} actionHint={t('journal.edit.saveHint')} onAction={save} /> : null}
      <Button label={t('journal.edit.save')} hint={t('journal.edit.saveHint')} icon="checkmark" onPress={save} />
      {prev ? <Button label={t('journal.edit.delete')} hint={t('journal.edit.deleteHint')} kind="quiet" icon="trash-outline" onPress={remove} /> : null}
      <Button label={t('common.cancel')} hint={t('journal.edit.cancelHint')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
