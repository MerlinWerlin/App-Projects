// One booking in a list: kind icon, time (as printed, with the zone's city), title, and from → to. Titles wrap in
// full (never cut off). `continuingOn` marks a journey that started on an earlier day: it shows when it arrives.
// `overlapsWith` (titles of clashing items, T41 / EDGE_CASES "Overlapping items") adds a worded marker under the
// row and to its spoken label, so the overlap is never shown by colour alone.
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { formatDay, formatTime, zoneCity } from '../core/format.ts';
import type { Item, LocalDate } from '../core/model.ts';
import { isTransport } from '../core/model.ts';
import { dayShift } from '../core/tz.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { KindIcon, kindKey } from './kinds.tsx';
import { PressableScale } from './kit.tsx';

export const ItemRow = memo(function ItemRow({
  item,
  onPress,
  continuingOn,
  overlapsWith,
}: {
  item: Item;
  onPress: () => void;
  continuingOn?: LocalDate;
  overlapsWith?: string;
}) {
  const { theme, t, lang } = useApp();
  const shift = item.end ? dayShift(item.start, item.end) : 0;
  const route = item.from || item.to ? `${item.from?.name ?? ''} → ${item.to?.name ?? ''}` : item.place?.name && item.place.name !== item.title ? item.place.name : '';
  let time: string;
  if (continuingOn && item.end) {
    const endTime = formatTime(item.end.local);
    const city = zoneCity(item.end.tz);
    const endDay = item.end.local.slice(0, 10);
    time =
      endDay !== continuingOn
        ? t('spec.row.underway', { day: formatDay(endDay, lang), time: endTime, city })
        : t(isTransport(item.kind) ? 'spec.row.arrives' : item.kind === 'car' ? 'spec.row.returns' : 'spec.row.ends', { time: endTime, city });
  } else {
    const range = `${formatTime(item.start.local)}${item.end && item.kind !== 'hotel' ? ` → ${formatTime(item.end.local)}${shift ? ` (${shift > 0 ? '+' : ''}${shift})` : ''}` : ''}`;
    time = `${range} · ${zoneCity(item.start.tz)}`;
  }
  const overlapText = overlapsWith ? t('spec41.row.overlaps', { titles: overlapsWith }) : '';
  const label = `${t(kindKey(item.kind))}, ${item.title}, ${time}${route ? `, ${route}` : ''}${overlapText ? `. ${overlapText}` : ''}`;
  const faded = !!continuingOn || item.kind === 'note';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('spec.row.hint')}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: space.m, alignItems: 'center', paddingVertical: space.s }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radius.l, backgroundColor: faded ? theme.paper : theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <KindIcon kind={item.kind} color={faded ? theme.muted : theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{item.title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>
          {time}
          {route ? ` · ${route}` : ''}
        </Text>
        {overlapText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Ionicons name="alert-circle-outline" size={16} color={theme.warn} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: theme.ink }}>{overlapText}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
});
