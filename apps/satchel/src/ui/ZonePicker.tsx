// Time-zone field + searchable list (T24). The field shows the chosen zone as "Tokyo · UTC+9" with its IANA name,
// one-tap chips for zones already used on the trip, and opens a full-screen list searchable by city, country or
// offset ("UTC+9"); search is src/core/tzsearch.ts. The Cancel button sits at the bottom, within thumb reach.
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, Modal, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zoneCity } from '../core/format.ts';
import { isValidZone, offsetMinutes } from '../core/tz.ts';
import { formatOffset, searchZones, zoneInfo, type ZoneMatch } from '../core/tzsearch.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { Body, Button, Chip, PressableScale } from './kit.tsx';

function offsetNow(tz: string): string {
  return formatOffset(offsetMinutes(tz, Date.now()));
}

function ZoneRow({ z, selected, onPress }: { z: ZoneMatch; selected: boolean; onPress: () => void }) {
  const { theme, t } = useApp();
  const place = z.country || z.region;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('pickers.zone.row', { city: z.city, place: place || z.tz, offset: z.offsetLabel })}
      accessibilityHint={t('pickers.zone.rowHint')}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ paddingVertical: space.s, borderBottomWidth: 1, borderColor: theme.line }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.m }}>
        <Text style={{ flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{z.city}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: selected ? theme.accent : theme.muted }}>
          {selected ? `${t('pickers.zone.current')} · ${z.offsetLabel}` : z.offsetLabel}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{place ? `${place} · ${z.tz}` : z.tz}</Text>
    </PressableScale>
  );
}

function ZoneSheet({ value, suggestions, onPick, onClose }: { value: string; suggestions: string[]; onPick: (tz: string) => void; onClose: () => void }) {
  const { theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const now = Date.now();
    if (q.trim()) return searchZones(q, { now });
    // No search yet: the current zone and the trip's zones first, then every zone west to east.
    const top = [value, ...suggestions].filter((z, i, a) => isValidZone(z) && a.indexOf(z) === i);
    const head = top.map((tz) => {
      const offset = offsetMinutes(tz, now);
      return { ...zoneInfo(tz), offset, offsetLabel: formatOffset(offset) };
    });
    return [...head, ...searchZones('', { now }).filter((z) => !top.includes(z.tz))];
  }, [q, value, suggestions]);

  useEffect(() => {
    if (!q.trim()) return;
    const id = setTimeout(() => AccessibilityInfo.announceForAccessibility(t('pickers.zone.count', { n: results.length })), 700);
    return () => clearTimeout(id);
  }, [q, results.length, t]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.m, paddingHorizontal: space.l, gap: space.m }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: theme.ink }}>
        {t('pickers.zone.title')}
      </Text>
      <TextInput
        accessibilityLabel={t('pickers.zone.search')}
        accessibilityHint={t('pickers.zone.searchHint')}
        value={q}
        onChangeText={setQ}
        placeholder={t('pickers.zone.searchPlaceholder')}
        placeholderTextColor={theme.muted}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={{
          minHeight: TOUCH,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: radius.s,
          paddingHorizontal: space.m,
          backgroundColor: theme.card,
          color: theme.ink,
          fontFamily: fonts.body,
          fontSize: 16,
        }}
      />
      <FlatList
        style={{ flex: 1 }}
        data={results}
        keyExtractor={(z) => z.tz}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        renderItem={({ item }) => <ZoneRow z={item} selected={item.tz === value} onPress={() => onPick(item.tz)} />}
        ListEmptyComponent={<Body muted>{t('pickers.zone.none', { q: q.trim() })}</Body>}
      />
      <Button label={t('common.cancel')} hint={t('pickers.cancelHint')} kind="quiet" onPress={onClose} />
    </View>
  );
}

/** The time-zone field: current zone, one-tap `suggestions` (zones used on this trip) and a searchable list. */
export function ZoneField({
  label,
  value,
  onChange,
  hint,
  error,
  suggestions = [],
  chipLabel,
}: {
  label: string;
  value: string;
  onChange: (tz: string) => void;
  hint: string;
  error?: string;
  suggestions?: string[];
  /** Chip text for a suggested zone, e.g. city => "Use Tokyo". */
  chipLabel?: (city: string) => string;
}) {
  const { theme, t, reduceMotion } = useApp();
  const [open, setOpen] = useState(false);
  const valid = isValidZone(value);
  const info = valid ? zoneInfo(value) : null;
  const shown = info ? t('pickers.zone.value', { city: info.city, offset: offsetNow(value) }) : value ? `${value} · ${t('pickers.zone.invalid')}` : t('pickers.notSet');
  const detail = info ? (info.country ? `${info.country} · ${value}` : value) : '';
  const chips = suggestions.filter((z, i, a) => isValidZone(z) && a.indexOf(z) === i);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('pickers.fieldValue', { field: label, value: detail ? `${shown}, ${detail}` : shown })}
        accessibilityHint={error ? `${error} ${hint}` : hint}
        onPress={() => setOpen(true)}
        style={{
          minHeight: TOUCH,
          borderWidth: 1,
          borderColor: error ? theme.danger : theme.line,
          borderRadius: radius.s,
          paddingHorizontal: space.m,
          paddingVertical: space.s,
          backgroundColor: theme.card,
        }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 16, color: theme.ink }}>{shown}</Text>
        {detail ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{detail}</Text> : null}
      </PressableScale>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {error}
        </Text>
      ) : null}
      {chips.length && chipLabel ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingTop: space.xs }}>
          {chips.map((z) => (
            <Chip key={z} label={chipLabel(zoneCity(z))} selected={value === z} onPress={() => onChange(z)} />
          ))}
        </View>
      ) : null}
      <Modal visible={open} animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        {open ? (
          <ZoneSheet
            value={value}
            suggestions={chips}
            onClose={() => setOpen(false)}
            onPick={(tz) => {
              setOpen(false);
              onChange(tz);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}
