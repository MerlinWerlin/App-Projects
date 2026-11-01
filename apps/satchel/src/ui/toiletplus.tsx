// Toilet finder pieces (T79): the result card (direction arrow, distance, open/closed line, feature chips, Save
// star with a private note and thumbs up/down, Open in Apple Maps), the filter chips with counts, the List/Map
// switch, and the "My toilets" and "Recently used" sections. Used by app/(tabs)/toilets.tsx. Theme tokens only.
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { FILTERS, hoursLine, type FilterId, type RecentToilet, type SavedToilet, type Vote } from '../core/toiletplus.ts';
import type { HoursStatus } from '../core/openinghours.ts';
import { arrowDegrees, toiletChips, toiletDistance, type ToiletChip, type ToiletHit } from '../core/toilets.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { IconBadge, SectionCard, toneColours, type IconName, type Tone } from './hero.tsx';
import { Body, Button, Card, PressableScale, TextField } from './kit.tsx';

const chipKey = (c: ToiletChip): Key => `toilets.chip.${c.id}`;
/** T50: each feature chip is tinted by what it means (free / step-free = good, paid / limited = heads-up). */
const CHIP_TONE: Record<ToiletChip['id'], Tone> = {
  free: 'ok',
  paid: 'warn',
  feeUnknown: 'ink',
  wheelchair: 'sea',
  wheelchairLimited: 'warn',
  noWheelchair: 'danger',
  changingTable: 'teal',
  unisex: 'accent',
  customersOnly: 'warn',
  open247: 'ok',
  hours: 'ink',
};

const FILTER_ICON: Record<FilterId, IconName> = {
  free: 'pricetag-outline',
  wheelchair: 'accessibility-outline',
  changingTable: 'happy-outline',
  openNow: 'time-outline',
  unisex: 'male-female-outline',
};

/** The translated open/closed line for a status, or null when the hours are unknown. */
export function useHoursText(status: HoursStatus, weekday: number): string | null {
  const { t } = useApp();
  const line = hoursLine(status, weekday);
  if (!line) return null;
  if (line.key === 'toiletplus.hours.closedOpensDay') return t(line.key, { time: line.vars.time, day: t(line.vars.day) });
  return t(line.key, line.vars);
}

/** Filter chips, each with how many places it would leave. Checkbox semantics (several can be on). */
export const FilterBar = memo(function FilterBar({ active, counts, onToggle }: { active: readonly FilterId[]; counts: Record<FilterId, number>; onToggle: (f: FilterId) => void }) {
  const { t, theme } = useApp();
  return (
    <FlatList
      horizontal
      data={FILTERS as readonly FilterId[]}
      keyExtractor={(f) => f}
      extraData={`${active.join()}|${Object.values(counts).join()}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.s, paddingVertical: space.xs }}
      accessibilityLabel={t('toiletplus.filtersLabel')}
      renderItem={({ item: f }) => {
        const on = active.includes(f);
        const label = t(`toiletplus.filter.${f}`);
        const n = counts[f];
        return (
          <PressableScale
            accessibilityRole="checkbox"
            accessibilityLabel={t('toiletplus.filterA11y', { label, n, state: t(on ? 'toiletplus.filterOn' : 'toiletplus.filterOff') })}
            accessibilityHint={t('toiletplus.filterHint')}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(f)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              paddingHorizontal: space.m,
              borderRadius: radius.pill,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? theme.teal : theme.line,
              backgroundColor: on ? theme.tealSoft : theme.cardRaised,
            }}
          >
            <Ionicons name={on ? 'checkmark-circle' : FILTER_ICON[f]} size={17} color={on ? theme.teal : theme.muted} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? theme.teal : theme.ink }}>{label}</Text>
            <View style={{ minWidth: 24, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: on ? theme.card : theme.paper, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: n === 0 ? theme.muted : theme.ink, fontVariant: ['tabular-nums'] }}>{n}</Text>
            </View>
          </PressableScale>
        );
      }}
    />
  );
});

/** Two-way List / Map switch (tab semantics). */
export function ViewToggle({ value, onChange }: { value: 'list' | 'map'; onChange: (v: 'list' | 'map') => void }) {
  const { t, theme } = useApp();
  const opts: { id: 'list' | 'map'; icon: IconName }[] = [
    { id: 'list', icon: 'list-outline' },
    { id: 'map', icon: 'map-outline' },
  ];
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t('toiletplus.viewLabel')} style={{ flexDirection: 'row', padding: space.xs, gap: space.xs, borderRadius: radius.pill, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line }}>
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <PressableScale
            key={o.id}
            accessibilityRole="tab"
            accessibilityLabel={t(`toiletplus.view.${o.id}`)}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={{ flex: 1, flexDirection: 'row', gap: space.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? theme.cardRaised : theme.paper }}
          >
            <Ionicons name={o.icon} size={18} color={on ? theme.teal : theme.muted} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? theme.ink : theme.muted }}>{t(`toiletplus.view.${o.id}`)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function SmallToggle({ icon, label, a11y, hint, on, tone, onPress }: { icon: IconName; label: string; a11y: string; hint: string; on: boolean; tone: Tone; onPress: () => void }) {
  const { theme } = useApp();
  const c = toneColours(theme, tone);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.m,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? c.fg : theme.line,
        backgroundColor: on ? c.bg : theme.card,
      }}
    >
      <Ionicons name={icon} size={18} color={on ? c.fg : theme.muted} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: on ? (tone === 'ink' ? theme.ink : c.fg) : theme.ink }}>{label}</Text>
    </PressableScale>
  );
}

function NoteEditor({ initial, name, onSave }: { initial: string; name: string; onSave: (note: string) => void }) {
  const { t, theme } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  if (!open) {
    return (
      <View style={{ gap: space.xs }}>
        {initial ? (
          <View style={{ flexDirection: 'row', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.warnSoft }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="document-text-outline" size={18} color={theme.warn} />
            </View>
            <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{initial}</Text>
          </View>
        ) : null}
        <Button kind="quiet" icon="create-outline" label={t(initial ? 'toiletplus.noteEdit' : 'toiletplus.noteAdd')} hint={t('toiletplus.noteEditHint', { name })} onPress={() => setOpen(true)} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.s }}>
      <TextField label={t('toiletplus.noteLabel')} value={draft} onChange={setDraft} placeholder={t('toiletplus.notePlaceholder')} multiline />
      <Button
        kind="secondary"
        icon="checkmark"
        label={t('toiletplus.noteSave')}
        hint={t('toiletplus.noteSaveHint')}
        onPress={() => {
          onSave(draft);
          setOpen(false);
        }}
      />
    </View>
  );
}

export type CardProps = {
  hit: ToiletHit;
  status: HoursStatus;
  weekday: number;
  /** Open-now filter is on: say so for places whose hours we can't read. */
  labelUnknown: boolean;
  pinned: boolean;
  saved: SavedToilet | null;
  onToggleSave: () => void;
  onNote: (note: string) => void;
  onVote: (v: 'up' | 'down') => void;
  onOpenMaps: () => void;
};

/** One toilet: arrow + distance, open/closed line, feature chips, Save / note / votes, Open in Apple Maps. */
export const ToiletCard = memo(function ToiletCard({ hit: h, status, weekday, labelUnknown, pinned, saved, onToggleSave, onNote, onVote, onOpenMaps }: CardProps) {
  const { t, theme } = useApp();
  const name = h.name ?? t('toilets.unnamed');
  const d = toiletDistance(h.meters);
  const distance = t('toilets.distance', { n: d.n, unit: d.unit, min: h.minutes });
  const dir = t(h.dirKey);
  const chips = toiletChips(h).map((c) => ({ id: c.id, label: c.id === 'hours' ? t('toilets.chip.hours', { hours: c.text }) : t(chipKey(c)) }));
  const hoursText = useHoursText(status, weekday);
  const hours = hoursText ?? (labelUnknown ? t('toiletplus.hours.unknown') : null);
  // T80: hours tagged with public holiday rules ('PH off') still show, with a caveat line.
  const holidayNote = hoursText && status.holidays ? t('f89.hours.holidayCaveat') : null;
  const hoursColour = status.state === 'open' ? theme.ok : status.state === 'closed' ? theme.danger : theme.muted;
  const vote: Vote = saved?.vote ?? null;
  const features = [hours, holidayNote, ...chips.map((c) => c.label)].filter(Boolean).join(', ');
  return (
    <Card style={{ gap: space.m, borderWidth: pinned ? 1.5 : 0, borderColor: theme.warn }}>
      <View accessible accessibilityLabel={t('toilets.rowA11y', { name, distance, dir, features })} style={{ gap: space.m }}>
        {pinned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.warnSoft }}>
            <Ionicons name="star" size={13} color={theme.warn} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: theme.warn }}>{t('toiletplus.pinned')}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: `${arrowDegrees(h.bearing)}deg` }] }}>
              <Ionicons name="arrow-up" size={26} color={theme.teal} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { fontSize: 17, color: theme.ink }]}>{name}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink, fontVariant: ['tabular-nums'] }}>{distance}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('toilets.direction', { dir })}</Text>
          </View>
        </View>
        {hours ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hoursColour }} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: hoursColour, fontVariant: ['tabular-nums'] }}>{hours}</Text>
          </View>
        ) : null}
        {holidayNote ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Ionicons name="calendar-outline" size={14} color={theme.muted} />
            <Text style={[typeScale.small, { color: theme.muted }]}>{holidayNote}</Text>
          </View>
        ) : null}
        {chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {chips.map((c) => {
              const tone = toneColours(theme, CHIP_TONE[c.id]);
              return (
                <View key={c.label} style={{ backgroundColor: tone.bg, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: CHIP_TONE[c.id] === 'ink' ? theme.ink : tone.fg }}>{c.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <SmallToggle
          icon={saved ? 'star' : 'star-outline'}
          label={t(saved ? 'toiletplus.saved' : 'toiletplus.save')}
          a11y={t(saved ? 'toiletplus.saved' : 'toiletplus.save')}
          hint={t(saved ? 'toiletplus.unsaveHint' : 'toiletplus.saveHint', { name })}
          on={!!saved}
          tone="warn"
          onPress={onToggleSave}
        />
        {saved ? (
          <>
            <SmallToggle icon={vote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} label={t('toiletplus.voteUp')} a11y={t('toiletplus.voteUpA11y', { name })} hint={t('toiletplus.voteHint')} on={vote === 'up'} tone="ok" onPress={() => onVote('up')} />
            <SmallToggle icon={vote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'} label={t('toiletplus.voteDown')} a11y={t('toiletplus.voteDownA11y', { name })} hint={t('toiletplus.voteHint')} on={vote === 'down'} tone="danger" onPress={() => onVote('down')} />
          </>
        ) : null}
      </View>
      {saved ? <NoteEditor initial={saved.note} name={name} onSave={onNote} /> : null}
      <Button kind="secondary" icon="walk-outline" label={t('toilets.openMaps')} hint={t('toilets.openMapsHint', { name })} onPress={onOpenMaps} />
    </Card>
  );
});

function PlainRow({ icon, tone, title, sub, a11y, hint, onPress }: { icon: IconName; tone: Tone; title: string; sub?: string; a11y: string; hint: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: theme.line }}
    >
      <IconBadge name={icon} tone={tone} size="s" />
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={[typeScale.small, { color: theme.muted }]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Ionicons name="walk-outline" size={20} color={theme.sea} />
    </PressableScale>
  );
}

/** Saved toilets (all of them), each opening walking directions. */
export function MineSection({
  saved,
  onOpen,
  focusId = null,
  onLocated,
}: {
  saved: readonly SavedToilet[];
  onOpen: (s: SavedToilet) => void;
  /** T120: the toilet opened from its Map-tab pin: highlighted, and its window position reported once laid out. */
  focusId?: string | null;
  onLocated?: (windowY: number) => void;
}) {
  const { t, theme } = useApp();
  const box = useRef<View>(null);
  const located = useRef(onLocated);
  located.current = onLocated;
  const focusShown = !!focusId && saved.some((s) => s.toilet.id === focusId);
  useEffect(() => {
    if (!focusShown) return;
    // After layout; measured in the window so nesting inside the card and the list footer doesn't matter.
    const id = setTimeout(() => box.current?.measureInWindow((_x, y) => located.current?.(y)), 250);
    return () => clearTimeout(id);
  }, [focusShown, focusId]);
  return (
    <SectionCard title={t('toiletplus.mineTitle')} subtitle={t('toiletplus.mineSubtitle')} icon="star" tone="warn">
      {saved.length === 0 ? <Body muted>{t('toiletplus.mineNone')}</Body> : null}
      {saved.map((s) => {
        const name = s.toilet.name ?? t('toilets.unnamed');
        const base = s.note ? t('toiletplus.mineRowA11y', { name, note: s.note }) : name;
        const row = (
          <PlainRow
            key={s.toilet.id}
            icon={s.vote === 'up' ? 'thumbs-up' : s.vote === 'down' ? 'thumbs-down' : 'star'}
            tone={s.vote === 'down' ? 'danger' : s.vote === 'up' ? 'ok' : 'warn'}
            title={name}
            sub={s.note || undefined}
            a11y={s.toilet.id === focusId ? t('f99.toilet.fromMapA11y', { name: base }) : base}
            hint={t('toiletplus.mineOpenHint')}
            onPress={() => onOpen(s)}
          />
        );
        if (s.toilet.id !== focusId) return row;
        return (
          <View
            key={s.toilet.id}
            ref={box}
            style={{ gap: space.xs, padding: space.s, marginHorizontal: -space.s, borderRadius: radius.m, borderWidth: 1.5, borderColor: theme.accent }}
          >
            <Text importantForAccessibility="no" accessibilityElementsHidden style={[typeScale.caption, { color: theme.accentInk }]}>
              {t('f99.toilet.fromMap')}
            </Text>
            {row}
          </View>
        );
      })}
    </SectionCard>
  );
}

/** The last toilets opened in Apple Maps, newest first. */
export function RecentSection({ recent, onOpen, onClear }: { recent: readonly RecentToilet[]; onOpen: (r: RecentToilet) => void; onClear: () => void }) {
  const { t } = useApp();
  return (
    <SectionCard
      title={t('toiletplus.recentTitle')}
      subtitle={t('toiletplus.recentSubtitle')}
      icon="time-outline"
      tone="sea"
      action={recent.length ? { label: t('toiletplus.recentClear'), hint: t('toiletplus.recentClearHint'), onPress: onClear } : undefined}
    >
      {recent.length === 0 ? <Body muted>{t('toiletplus.recentNone')}</Body> : null}
      {recent.map((r) => {
        const name = r.toilet.name ?? t('toilets.unnamed');
        return <PlainRow key={r.toilet.id} icon="navigate-outline" tone="sea" title={name} a11y={t('toiletplus.recentRowA11y', { name })} hint={t('toiletplus.mineOpenHint')} onPress={() => onOpen(r)} />;
      })}
    </SectionCard>
  );
}
