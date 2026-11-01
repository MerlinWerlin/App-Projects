// T93 trip to-dos: words for a to-do (suggestions are worded here, own to-dos keep the traveller's words), its due
// line in the departure zone, and one list row (tick, the to-do, Hide / Show again for suggestions). Logic lives in
// src/core/todos.ts. Motion is the timed FadeInView only.
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { formatDay, zoneCity } from '../core/format.ts';
import { daysLeft, isOpenNow, type TodoState, type TodoView } from '../core/todos.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { elevated, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge, toneColours, type IconName, type Tone } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { countryName } from './useTravelStats.ts';

export const TODO_ICONS: Record<TodoView['kind'], IconName> = {
  insurance: 'shield-checkmark-outline',
  entry: 'document-text-outline',
  bank: 'card-outline',
  roaming: 'cellular-outline',
  map: 'map-outline',
  transfer: 'car-outline',
  checkin: 'airplane-outline',
  tickets: 'ticket-outline',
  own: 'create-outline',
};

export const STATE_TONES: Record<TodoState, Tone> = { overdue: 'danger', soon: 'warn', later: 'sea', undated: 'ink', done: 'ok' };

/** The to-do's title: the traveller's words, or the suggestion worded with its country, city or flight. */
export function todoTitle(t: T, v: TodoView): string {
  const flight = v.flight || t('todos.flightFallback');
  switch (v.kind) {
    case 'own':
      return v.title;
    case 'entry':
      return t('todos.kind.entry', { country: v.country ? countryName(v.country) : '' });
    case 'map':
      return t('todos.kind.map', { city: v.city ?? '' });
    case 'transfer':
      return t('todos.kind.transfer', { city: v.city ?? '' });
    case 'checkin':
      return t('todos.kind.checkin', { flight });
    default:
      return t(`todos.kind.${v.kind}`);
  }
}

/** The line under a suggestion (check-in carries the "general guidance" label). Empty for own to-dos. */
export function todoNote(t: T, v: TodoView): string {
  if (v.kind === 'own') return '';
  if (v.auto) return t('todos.kind.map.auto');
  if (v.kind === 'transfer') return t('todos.kind.transfer.note', { flight: v.flight || t('todos.flightFallback') });
  return t(`todos.kind.${v.kind}.note`);
}

/** "Due tomorrow", "Was due Tue 3 Nov", "Opens about 09:30 Sydney time, Mon 2 Nov"; every date in the to-do's own zone. */
export function dueText(t: T, v: TodoView, lang: string, now: number): string {
  const d = v.due;
  if (!d) return t('todos.due.none');
  const date = formatDay(d.date, lang);
  if (d.time) {
    if (!v.done && isOpenNow(d, now)) return t('todos.due.checkinOpen');
    return t('todos.due.checkin', { time: d.time, city: zoneCity(d.tz), date });
  }
  if (v.done) return t('todos.due.date', { date });
  const left = daysLeft(d, now);
  if (left < 0) return t('todos.due.past', { date });
  if (left === 0) return t('todos.due.today');
  if (left === 1) return t('todos.due.tomorrow');
  return t('todos.due.date', { date });
}

/** One to-do: the tick (a checkbox), the to-do (opens an own to-do to edit), and Hide / Show again on suggestions. */
export const TodoRow = memo(function TodoRow({
  view,
  now,
  onToggle,
  onEdit,
  onHide,
  onRestore,
}: {
  view: TodoView;
  now: number;
  onToggle: (v: TodoView) => void;
  onEdit: (v: TodoView) => void;
  onHide: (v: TodoView) => void;
  onRestore: (v: TodoView) => void;
}) {
  const { t, theme, lang } = useApp();
  const title = todoTitle(t, view);
  const note = todoNote(t, view);
  const due = dueText(t, view, lang, now);
  const stateLabel = t(`todos.state.${view.state}`);
  const look = toneColours(theme, STATE_TONES[view.state]);
  const meta = [view.kind === 'own' ? null : t('todos.suggested'), stateLabel, due].filter(Boolean).join(' · ');
  const body = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs }}>
      <IconBadge name={TODO_ICONS[view.kind]} tone={view.done ? 'ok' : STATE_TONES[view.state]} size="s" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: view.done || view.dismissed ? theme.muted : theme.ink }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
          {view.dismissed ? null : (
            <View style={{ borderRadius: radius.pill, backgroundColor: look.bg, paddingHorizontal: space.s, paddingVertical: 2 }}>
              <Text style={[typeScale.caption, { color: look.fg }]}>{stateLabel}</Text>
            </View>
          )}
          <Text style={[typeScale.small, { color: theme.muted }]}>{due}</Text>
        </View>
        {note ? <Text style={[typeScale.small, { color: theme.muted }]}>{note}</Text> : null}
      </View>
    </View>
  );
  const spoken = t('todos.row.a11y', { title, meta, note });
  return (
    <View
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.s, gap: space.xs },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {view.dismissed ? null : view.auto ? (
          <View accessible accessibilityLabel={t('todos.row.autoA11y', { title })} style={{ width: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={28} color={theme.ok} />
          </View>
        ) : (
          <PressableScale
            accessibilityRole="checkbox"
            accessibilityLabel={t('todos.row.tickA11y', { title })}
            accessibilityHint={t(view.done ? 'todos.row.untickHint' : 'todos.row.tickHint')}
            accessibilityState={{ checked: view.done }}
            onPress={() => onToggle(view)}
            style={{ width: TOUCH, alignItems: 'center' }}
          >
            <Ionicons name={view.done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={view.done ? theme.ok : theme.muted} />
          </PressableScale>
        )}
        {view.kind === 'own' ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint={t('todos.row.editHint')} onPress={() => onEdit(view)} style={{ flex: 1 }}>
            {body}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={spoken} style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center' }}>
            {body}
          </View>
        )}
      </View>
      {view.kind !== 'own' && !view.done ? (
        <View style={{ flexDirection: 'row', paddingLeft: TOUCH + space.xs }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t(view.dismissed ? 'todos.row.restoreA11y' : 'todos.row.hideA11y', { title })}
            accessibilityHint={t(view.dismissed ? 'todos.row.restoreHint' : 'todos.row.hideHint')}
            onPress={() => (view.dismissed ? onRestore(view) : onHide(view))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
          >
            <Ionicons name={view.dismissed ? 'eye-outline' : 'eye-off-outline'} size={16} color={theme.sea} />
            <Text style={[typeScale.bodyStrong, { fontSize: 14, color: theme.sea }]}>{t(view.dismissed ? 'todos.row.restore' : 'todos.row.hide')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
});

/** "Due soon: Check in online for DA 21 (+2 more)" for the Your day card, or '' when nothing is close. */
export function briefLine(t: T, b: { overdue: number; soon: number; first: TodoView } | null): string {
  if (!b) return '';
  const line = t(b.first.state === 'overdue' ? 'todos.brief.overdue' : 'todos.brief.soon', { title: todoTitle(t, b.first) });
  const more = b.overdue + b.soon - 1;
  return more > 0 ? t('todos.brief.more', { line, n: more }) : line;
}
