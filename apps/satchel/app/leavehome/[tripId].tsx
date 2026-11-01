// T124 Leaving home: the "before you lock the door" checklist for one trip (from the usual list, with own items,
// rename / remove / put back, untick all), timed to the trip's first departure; the house-sitter / neighbour note
// (address, sitter tasks every day or on a trip day, pets, plants, bins, who to call), the phone-only Wi-Fi and alarm
// codes, and Share the note as plain text. Logic in src/core/leavehome.ts. The checklist and note travel with the
// trip; the codes never leave this phone unless the traveller switches them on for one shared note.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay, formatRange } from '../../src/core/format.ts';
import {
  addOwnRow,
  addTask,
  hasCodes,
  leaveDue,
  missingTemplate,
  readLeavingHome,
  removeRow,
  removeTask,
  renameRow,
  restoreTemplate,
  setRowDone,
  sitterNoteText,
  startLeavingHome,
  taskDays,
  untickAll,
  withNote,
  type HomeCodes,
  type LeaveRow,
  type SitterNote,
  type SitterWhen,
} from '../../src/core/leavehome.ts';
import { newId, type Trip } from '../../src/core/model.ts';
import { haptic } from '../../src/native/device.ts';
import { shareText } from '../../src/native/share.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveHomeCodes, useHomeCodes } from '../../src/state/leavehome.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { FadeInView, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, PressableScale, Screen, TextField, ToggleRow } from '../../src/ui/kit.tsx';
import { dueLine } from '../../src/ui/leavehome.tsx';
import { TripAccentBand } from '../../src/ui/TripAccentBand.tsx';

export default function LeaveHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('leavehome.title')} body={t('leavehome.notFound')} />
      </Screen>
    );
  }
  return <LeaveHome trip={trip} />;
}

function useCommit() {
  const { t } = useApp();
  const { saveTrip } = useTrips();
  return useCallback(
    async (next: Trip) => {
      const ok = await saveTrip(next);
      if (!ok) Alert.alert(t('leavehome.saveFailed.title'), t('leavehome.saveFailed.body'));
      return ok;
    },
    [saveTrip, t],
  );
}

function LeaveHome({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const due = useMemo(() => leaveDue(trip, now), [trip, now]);
  const lh = useMemo(() => readLeavingHome(trip), [trip]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('leavehome.route') }} />
      <TripAccentBand trip={trip} />
      <View accessible style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
          {t('leavehome.title')}
        </Text>
        {due ? <Text style={[typeScale.bodyStrong, { color: due.when === 'today' || due.when === 'tomorrow' ? theme.accentInk : theme.muted }]}>{dueLine(t, due, lang)}</Text> : null}
        {due?.dep.item ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('leavehome.due.from', { title: due.dep.item.title })}</Text> : null}
      </View>
      <Checklist trip={trip} rows={lh?.rows ?? []} />
      <SitterNoteCard trip={trip} note={lh?.note ?? {}} />
      <CodesCard />
      <ShareCard trip={trip} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------------------- checklist

function Checklist({ trip, rows }: { trip: Trip; rows: LeaveRow[] }) {
  const { t, theme } = useApp();
  const commit = useCommit();
  const [own, setOwn] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const done = rows.filter((r) => r.done).length;
  const missing = missingTemplate(rows.length ? { rows } : null);
  const label = (r: LeaveRow) => r.label?.trim() || (r.tpl ? t(`leavehome.tpl.${r.tpl}`) : '');

  const toggle = (r: LeaveRow) => {
    void commit(setRowDone(trip, r.id, !r.done)).then((ok) => {
      if (ok && !r.done && done + 1 === rows.length) AccessibilityInfo.announceForAccessibility(t('leavehome.allDone'));
    });
  };
  const add = () => {
    if (!own.trim()) return;
    void commit(addOwnRow(trip, own, newId)).then((ok) => ok && setOwn(''));
  };

  return (
    <SectionCard title={t('leavehome.list.title')} subtitle={t('leavehome.list.sub')} icon="key-outline" tone="accent">
      {rows.length ? (
        <ProgressBar progress={done / rows.length} tone="ok" label={t('leavehome.card.progress', { done, total: rows.length })} />
      ) : (
        <View style={{ gap: space.s }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('leavehome.emptyTitle')}</Text>
          <Body muted>{t('leavehome.emptyBody')}</Body>
          <Button label={t('leavehome.start')} hint={t('leavehome.startHint')} icon="list-outline" onPress={() => void commit(startLeavingHome(trip, newId))} />
        </View>
      )}
      {rows.length && done === rows.length ? <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('leavehome.allDone')}</Text> : null}
      {rows.map((r, i) => (
        <FadeInView key={r.id} delay={Math.min(i, 6) * 30}>
          {renaming === r.id ? (
            <RenameRow trip={trip} row={r} current={label(r)} onDone={() => setRenaming(null)} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityLabel={t('leavehome.row.tickA11y', { label: label(r) })}
                accessibilityHint={t('leavehome.row.tickHint')}
                accessibilityState={{ checked: r.done }}
                onPress={() => toggle(r)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}
              >
                <Ionicons name={r.done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={r.done ? theme.ok : theme.muted} />
                <Text style={[typeScale.body, { flex: 1, color: r.done ? theme.muted : theme.ink, textDecorationLine: r.done ? 'line-through' : 'none' }]}>{label(r)}</Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('leavehome.row.renameA11y', { label: label(r) })}
                accessibilityHint={t('leavehome.row.renameHint')}
                onPress={() => setRenaming(r.id)}
                style={{ width: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="create-outline" size={20} color={theme.muted} />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('leavehome.row.removeA11y', { label: label(r) })}
                accessibilityHint={t('leavehome.row.removeHint')}
                onPress={() => void commit(removeRow(trip, r.id))}
                style={{ width: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close-outline" size={22} color={theme.muted} />
              </PressableScale>
            </View>
          )}
        </FadeInView>
      ))}
      <TextField label={t('leavehome.own.label')} value={own} onChange={setOwn} placeholder={t('leavehome.own.placeholder')} />
      <Button label={t('leavehome.own.add')} hint={t('leavehome.own.addHint')} kind="secondary" icon="add" onPress={add} />
      {rows.length && missing.length ? (
        <Button
          label={missing.length === 1 ? t('leavehome.restoreOne') : t('leavehome.restore', { n: missing.length })}
          hint={t('leavehome.restoreHint')}
          kind="quiet"
          icon="refresh-outline"
          onPress={() => void commit(restoreTemplate(trip, newId))}
        />
      ) : null}
      {done ? <Button label={t('leavehome.untick')} hint={t('leavehome.untickHint')} kind="quiet" icon="square-outline" onPress={() => void commit(untickAll(trip))} /> : null}
    </SectionCard>
  );
}

function RenameRow({ trip, row, current, onDone }: { trip: Trip; row: LeaveRow; current: string; onDone: () => void }) {
  const { t } = useApp();
  const commit = useCommit();
  const [words, setWords] = useState(current);
  return (
    <View style={{ gap: space.s }}>
      <TextField label={t('leavehome.row.renameLabel')} value={words} onChange={setWords} />
      <Button label={t('leavehome.row.renameSave')} hint={t('leavehome.row.renameSaveHint')} kind="secondary" icon="checkmark" onPress={() => void commit(renameRow(trip, row.id, words)).then((ok) => ok && onDone())} />
      <Button label={t('leavehome.row.renameCancel')} hint={t('leavehome.row.renameCancelHint')} kind="quiet" onPress={onDone} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------- the note

type NoteDraft = Required<Omit<SitterNote, 'tasks'>>;
const toDraft = (n: SitterNote): NoteDraft => ({
  address: n.address ?? '',
  pets: n.pets ?? '',
  plants: n.plants ?? '',
  bins: n.bins ?? '',
  contactName: n.contactName ?? '',
  contactPhone: n.contactPhone ?? '',
  extra: n.extra ?? '',
});
const sameDraft = (a: NoteDraft, b: NoteDraft) => (Object.keys(a) as (keyof NoteDraft)[]).every((k) => a[k].trim() === b[k].trim());

function SitterNoteCard({ trip, note }: { trip: Trip; note: SitterNote }) {
  const { t, theme, lang } = useApp();
  const commit = useCommit();
  const saved = useMemo(() => toDraft(note), [note]);
  const [d, setD] = useState<NoteDraft>(saved);
  const dirty = !sameDraft(d, saved);
  const field = (k: keyof NoteDraft) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const [taskText, setTaskText] = useState('');
  const [when, setWhen] = useState<SitterWhen>('daily');
  const days = useMemo(() => taskDays(trip), [trip]);
  const tasks = note.tasks ?? [];
  const whenLabel = (w: SitterWhen) => (w === 'daily' ? t('leavehome.tasks.daily') : formatDay(w, lang));

  const save = () => {
    void commit(withNote(trip, d)).then((ok) => ok && haptic.success());
  };
  const add = () => {
    if (!taskText.trim()) return;
    void commit(addTask(trip, when, taskText, newId)).then((ok) => ok && setTaskText(''));
  };

  return (
    <SectionCard title={t('leavehome.note.title')} subtitle={t('leavehome.note.sub')} icon="home-outline" tone="sea">
      <TextField label={t('leavehome.note.address')} value={d.address} onChange={field('address')} placeholder={t('leavehome.note.addressPlaceholder')} multiline />
      <TextField label={t('leavehome.note.pets')} value={d.pets} onChange={field('pets')} placeholder={t('leavehome.note.petsPlaceholder')} multiline />
      <TextField label={t('leavehome.note.plants')} value={d.plants} onChange={field('plants')} placeholder={t('leavehome.note.plantsPlaceholder')} />
      <TextField label={t('leavehome.note.bins')} value={d.bins} onChange={field('bins')} placeholder={t('leavehome.note.binsPlaceholder')} />
      <TextField label={t('leavehome.note.contactName')} value={d.contactName} onChange={field('contactName')} placeholder={t('leavehome.note.contactNamePlaceholder')} autoCapitalize="words" />
      <TextField label={t('leavehome.note.contactPhone')} value={d.contactPhone} onChange={field('contactPhone')} inputMode="tel" />
      <TextField label={t('leavehome.note.extra')} value={d.extra} onChange={field('extra')} placeholder={t('leavehome.note.extraPlaceholder')} multiline />
      <Button label={t('leavehome.note.save')} hint={t('leavehome.note.saveHint')} icon="checkmark" onPress={save} />
      <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: dirty ? theme.warn : theme.muted }]}>
        {dirty ? t('leavehome.note.unsaved') : t('leavehome.note.saved')}
      </Text>

      <View style={{ gap: space.s, borderTopWidth: 1, borderColor: theme.line, paddingTop: space.m }}>
        <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
          {t('leavehome.tasks.title')}
        </Text>
        <Body muted>{t('leavehome.tasks.sub')}</Body>
        {tasks.length ? null : <Body muted>{t('leavehome.tasks.none')}</Body>}
        {tasks.map((task) => (
          <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.body, { color: theme.ink }]}>{task.text}</Text>
              <Text style={[typeScale.small, { color: theme.muted }]}>{whenLabel(task.when)}</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('leavehome.tasks.removeA11y', { text: task.text, when: whenLabel(task.when) })}
              accessibilityHint={t('leavehome.tasks.removeHint')}
              onPress={() => void commit(removeTask(trip, task.id))}
              style={{ width: TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close-outline" size={22} color={theme.muted} />
            </PressableScale>
          </View>
        ))}
        <TextField label={t('leavehome.tasks.label')} value={taskText} onChange={setTaskText} placeholder={t('leavehome.tasks.placeholder')} />
        <Text style={[typeScale.caption, { color: theme.muted }]}>{t('leavehome.tasks.when')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, minHeight: TOUCH }} accessibilityRole="radiogroup">
          <Chip label={t('leavehome.tasks.daily')} selected={when === 'daily'} onPress={() => setWhen('daily')} hint={t('leavehome.tasks.whenHint')} />
          {days.map((day) => (
            <Chip key={day} label={formatDay(day, lang)} a11yLabel={t('leavehome.tasks.dayA11y', { date: formatDay(day, lang) })} selected={when === day} onPress={() => setWhen(day)} hint={t('leavehome.tasks.whenHint')} />
          ))}
        </ScrollView>
        <Button label={t('leavehome.tasks.add')} hint={t('leavehome.tasks.addHint')} kind="secondary" icon="add" onPress={add} />
      </View>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------------------------------------- codes

function CodesCard() {
  const { t, theme } = useApp();
  const [codes, loaded] = useHomeCodes();
  const [d, setD] = useState<Required<HomeCodes>>({ wifiName: '', wifiPassword: '', alarmCode: '' });
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  useEffect(() => {
    if (loaded) setD({ wifiName: codes.wifiName ?? '', wifiPassword: codes.wifiPassword ?? '', alarmCode: codes.alarmCode ?? '' });
  }, [loaded, codes]);
  const save = async () => {
    const ok = await saveHomeCodes(d);
    setStatus(ok ? 'saved' : 'failed');
    if (ok) haptic.success();
    AccessibilityInfo.announceForAccessibility(t(ok ? 'leavehome.codes.saved' : 'leavehome.codes.failed'));
  };
  return (
    <SectionCard title={t('leavehome.codes.title')} subtitle={t('leavehome.codes.sub')} icon="lock-closed-outline" tone="ink">
      <TextField label={t('leavehome.codes.wifiName')} value={d.wifiName} onChange={(wifiName) => setD((x) => ({ ...x, wifiName }))} autoCapitalize="none" />
      <TextField label={t('leavehome.codes.wifiPassword')} value={d.wifiPassword} onChange={(wifiPassword) => setD((x) => ({ ...x, wifiPassword }))} autoCapitalize="none" />
      <TextField label={t('leavehome.codes.alarm')} value={d.alarmCode} onChange={(alarmCode) => setD((x) => ({ ...x, alarmCode }))} autoCapitalize="none" />
      <Button label={t('leavehome.codes.save')} hint={t('leavehome.codes.saveHint')} kind="secondary" icon="phone-portrait-outline" onPress={() => void save()} />
      {status === 'idle' ? null : (
        <View style={{ borderRadius: radius.m, padding: space.s, backgroundColor: status === 'saved' ? theme.okSoft : theme.dangerSoft }}>
          <Text style={[typeScale.small, { color: theme.ink }]}>{t(status === 'saved' ? 'leavehome.codes.saved' : 'leavehome.codes.failed')}</Text>
        </View>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------------------------------------- share

function ShareCard({ trip }: { trip: Trip }) {
  const { t, lang } = useApp();
  const [codes] = useHomeCodes();
  const [wifi, setWifi] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const [failed, setFailed] = useState(false);
  const canWifi = !!(codes.wifiName || codes.wifiPassword);
  const send = async () => {
    const text = sitterNoteText(
      trip,
      {
        title: t('leavehome.text.title'),
        away: (range) => t('leavehome.text.away', { range }),
        range: (a, b) => formatRange(a, b, lang),
        day: (date) => formatDay(date, lang),
        address: t('leavehome.text.address'),
        everyDay: t('leavehome.text.everyDay'),
        tasks: t('leavehome.text.tasks'),
        pets: t('leavehome.text.pets'),
        plants: t('leavehome.text.plants'),
        bins: t('leavehome.text.bins'),
        wifi: t('leavehome.text.wifi'),
        wifiName: (name) => t('leavehome.text.wifiName', { name }),
        wifiPassword: (pw) => t('leavehome.text.wifiPassword', { pw }),
        alarm: (code) => t('leavehome.text.alarm', { code }),
        call: t('leavehome.text.call'),
        stops: t('leavehome.text.stops'),
        stop: (s, range) => (s.phone ? t('leavehome.text.stopPhone', { range, name: s.name, city: s.city, phone: s.phone }) : t('leavehome.text.stop', { range, name: s.name, city: s.city })),
        extra: t('leavehome.text.extra'),
        empty: t('leavehome.text.empty'),
      },
      { codes, wifi: wifi && canWifi, alarm: alarm && !!codes.alarmCode },
    );
    const r = await shareText(text, t('leavehome.share.subject'));
    if (r === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('leavehome.share.failed'));
      return;
    }
    setFailed(false);
    if (r === 'shared') haptic.success();
  };
  return (
    <SectionCard title={t('leavehome.share.title')} subtitle={t('leavehome.share.sub')} icon="share-outline" tone="sea">
      {canWifi ? <ToggleRow label={t('leavehome.share.wifi')} hint={t('leavehome.share.wifiHint')} value={wifi} onChange={setWifi} /> : null}
      {codes.alarmCode ? <ToggleRow label={t('leavehome.share.alarm')} hint={t('leavehome.share.alarmHint')} value={alarm} onChange={setAlarm} /> : null}
      {hasCodes(codes) ? null : <Body muted>{t('leavehome.share.noCodes')}</Body>}
      <Button kind="secondary" icon="share-outline" label={t('leavehome.share.send')} hint={t('leavehome.share.sendHint')} onPress={() => void send()} />
      {failed ? <ErrorNotice title={t('leavehome.share.failedTitle')} body={t('leavehome.share.failed')} action={t('common.tryAgain')} actionHint={t('leavehome.share.sendHint')} onAction={() => void send()} /> : null}
    </SectionCard>
  );
}
