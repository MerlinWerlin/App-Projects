// Trip to-dos (T93): the trip's pre-trip checklist. Suggestions built offline from the trip (insurance, entry and
// visa rules per country, bank, roaming or eSIM, the offline map per stop, airport transfer per arriving flight,
// online check-in per flight, tickets), each tickable or hidden (and shown again), plus the traveller's own to-dos with
// an optional due date. Due dates count back from departure, in the departure zone; overdue and due-soon rows say so.
// Logic in src/core/todos.ts. Free and offline; to-dos travel in .satchel files.
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay, zoneCity } from '../../src/core/format.ts';
import { newId, type Trip } from '../../src/core/model.ts';
import {
  departure,
  dismissTodo,
  draftFromTodo,
  findTodo,
  newTodoDraft,
  removeTodo,
  restoreTodo,
  setTodoDone,
  todoCounts,
  todoFromDraft,
  todoList,
  upsertTodo,
  validateTodo,
  type TodoDraft,
  type TodoView,
} from '../../src/core/todos.ts';
import { localDate } from '../../src/core/tz.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { DateField } from '../../src/ui/DateTimeField.tsx';
import { FadeInView, HeroHeader } from '../../src/ui/hero.tsx';
import { AccentStripe, useTripAccent } from '../../src/ui/TripAccentBand.tsx';
import { Body, Button, Card, EmptyState, Screen, TextField } from '../../src/ui/kit.tsx';
import { useMapsOnPhone } from '../../src/ui/ReadinessCard.tsx';
import { TodoRow } from '../../src/ui/todos.tsx';

type Row = { kind: 'head'; key: string; title: string; count: number } | { kind: 'todo'; key: string; view: TodoView };

export default function TodosScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('todos.title')} body={t('todos.notFound')} />
      </Screen>
    );
  }
  return <Todos trip={trip} />;
}

/** Add your own / Edit to-do: words and an optional due date (a day in the departure zone). */
function TodoForm({ trip, editing, onDone }: { trip: Trip; editing: string | null; onDone: () => void }) {
  const { t, theme } = useApp();
  const { saveTrip } = useTrips();
  const prev = editing ? findTodo(trip, editing) : undefined;
  const [d, setD] = useState<TodoDraft>(() => (prev ? draftFromTodo(prev) : newTodoDraft()));
  const [tried, setTried] = useState(false);
  const errors = validateTodo(d);
  const dep = departure(trip);

  const save = useCallback(async () => {
    setTried(true);
    if (validateTodo(d).length) return;
    const next = upsertTodo(trip, todoFromDraft(d, newId, prev));
    if (!(await saveTrip(next))) {
      Alert.alert(t('todos.saveFailed.title'), t('todos.saveFailed.body'));
      return;
    }
    setD(newTodoDraft());
    setTried(false);
    onDone();
  }, [d, trip, prev, saveTrip, t, onDone]);

  const remove = useCallback(() => {
    if (!prev) return;
    Alert.alert(t('todos.delete.title'), t('todos.delete.body', { title: prev.title }), [
      { text: t('todos.delete.keep'), style: 'cancel' },
      {
        text: t('todos.delete.confirm'),
        style: 'destructive',
        onPress: () => {
          void saveTrip(removeTodo(trip, prev.id)).then((ok) => (ok ? onDone() : Alert.alert(t('todos.saveFailed.title'), t('todos.saveFailed.body'))));
        },
      },
    ]);
  }, [prev, trip, saveTrip, t, onDone]);

  return (
    <Card style={{ gap: space.m }}>
      <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
        {t(prev ? 'todos.form.editTitle' : 'todos.form.addTitle')}
      </Text>
      <TextField
        label={t('todos.form.title')}
        value={d.title}
        onChange={(title) => setD((x) => ({ ...x, title }))}
        placeholder={t('todos.form.placeholder')}
        error={tried && errors.includes('title') ? t('todos.form.titleError') : undefined}
      />
      <DateField
        label={t('todos.form.due')}
        typedLabel={t('todos.form.dueTyped')}
        value={d.due}
        onChange={(due) => setD((x) => ({ ...x, due }))}
        hint={t('todos.form.dueHint')}
        fallbackDay={localDate(dep.local)}
        error={tried && errors.includes('due') ? t('todos.form.dueError') : undefined}
      />
      {d.due ? <Button label={t('todos.form.clearDue')} hint={t('todos.form.clearDueHint')} kind="quiet" onPress={() => setD((x) => ({ ...x, due: '' }))} /> : null}
      <Body muted>{t('todos.form.zoneNote', { city: zoneCity(dep.tz) })}</Body>
      {prev ? (
        <>
          <Button label={t('todos.form.save')} hint={t('todos.form.saveHint')} icon="checkmark" onPress={save} />
          <Button label={t('todos.form.cancel')} hint={t('todos.form.cancelHint')} kind="quiet" onPress={onDone} />
          <Button label={t('todos.form.delete')} hint={t('todos.form.deleteHint')} kind="quiet" icon="trash-outline" onPress={remove} />
        </>
      ) : (
        <Button label={t('todos.form.add')} hint={t('todos.form.addHint')} icon="add" onPress={save} />
      )}
    </Card>
  );
}

function Todos({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const { saveTrip } = useTrips();
  const insets = useSafeAreaInsets();
  const maps = useMapsOnPhone();
  // T120: group headings in the trip's own accent (from its cover), like the trip screen's days.
  const accent = useTripAccent(trip);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const [editing, setEditing] = useState<string | null>(null);

  const list = useMemo(() => todoList(trip, now, { catalog: maps.catalog, installed: maps.installed }), [trip, now, maps]);
  const counts = todoCounts(list);
  const dep = departure(trip);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const section = (key: string, title: string, views: TodoView[]) => {
      if (!views.length) return;
      out.push({ kind: 'head', key: `h:${key}`, title, count: views.length });
      for (const v of views) out.push({ kind: 'todo', key: v.key, view: v });
    };
    section('open', t('todos.section.open'), list.open);
    section('done', t('todos.section.done'), list.done);
    section('hidden', t('todos.section.hidden'), list.hidden);
    return out;
  }, [list, t]);

  const commit = useCallback(
    async (next: Trip) => {
      setNow(Date.now());
      if (!(await saveTrip(next))) Alert.alert(t('todos.saveFailed.title'), t('todos.saveFailed.body'));
    },
    [saveTrip, t],
  );
  const toggle = useCallback((v: TodoView) => void commit(setTodoDone(trip, v.key, !v.done, newId)), [commit, trip]);
  const hide = useCallback((v: TodoView) => void commit(dismissTodo(trip, v.key, newId)), [commit, trip]);
  const restore = useCallback((v: TodoView) => void commit(restoreTodo(trip, v.key, newId)), [commit, trip]);
  const edit = useCallback((v: TodoView) => setEditing(v.id ?? null), []);
  const doneEditing = useCallback(() => setEditing(null), []);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'head') {
        return (
          <View accessible accessibilityRole="header" accessibilityLabel={`${item.title}. ${item.count}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.m }}>
            <AccentStripe accent={accent} height={22} />
            <Text style={[typeScale.title, { flex: 1, color: accent.ink }]}>{item.title}</Text>
            <Text style={[typeScale.caption, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{item.count}</Text>
          </View>
        );
      }
      return (
        <FadeInView>
          <TodoRow view={item.view} now={now} onToggle={toggle} onEdit={edit} onHide={hide} onRestore={restore} />
        </FadeInView>
      );
    },
    [theme, accent, now, toggle, edit, hide, restore],
  );

  const subtitle = [t('todos.summary', { open: counts.open, done: counts.done }), counts.overdue ? t('todos.summaryOverdue', { n: counts.overdue }) : null].filter(Boolean).join(' · ');
  const editingTitle = editing ? list.open.concat(list.done).find((v) => v.id === editing) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('todos.forTrip', { trip: trip.name }) }} />
      <FlatList
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.s }}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        extraData={now}
        initialNumToRender={16}
        ListHeaderComponent={
          <View style={{ gap: space.m }}>
            <HeroHeader tone="trips" title={t('todos.title')} eyebrow={trip.name} subtitle={subtitle} illustration="passport" compact />
            {counts.open === 0 ? <Body muted>{t('todos.empty')}</Body> : null}
            <TodoForm key={editing ?? 'new'} trip={trip} editing={editingTitle ? editing : null} onDone={doneEditing} />
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: space.s, marginTop: space.m }}>
            <Body muted>{t('todos.departs', { date: formatDay(localDate(dep.local), lang), city: zoneCity(dep.tz) })}</Body>
            <Body muted>{t('todos.kind.checkin.note')}</Body>
            <Body muted>{t('todos.offline')}</Body>
          </View>
        }
      />
    </>
  );
}

