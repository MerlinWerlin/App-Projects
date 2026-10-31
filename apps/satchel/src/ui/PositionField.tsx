// T72: a booking's map position in the booking form, so its stop shows on the trip map and its weather can be
// fetched beyond the sample trip. Shows whether the place is on the map; "Set on map" opens a full-screen map where
// a tap drops the pin (or a tap on one of the trip's places takes that one); "Pick a saved place" lists the trip's
// saved places and the positions its other bookings have; "Remove position" clears it. The value is the draft's
// "lat,lon" text (src/core/position.ts). Sheets fade in (no slide or spring). Nothing is stored until the booking is
// saved, and no location is read: the user places the pin.
import { memo, useMemo, useState } from 'react';
import { FlatList, Modal, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip } from '../core/model.ts';
import { type LatLon, type Region } from '../core/poi.ts';
import { decodePos, encodePos, formatPos, pickerRegion, positionChoices, roundPos, type PositionChoice } from '../core/position.ts';
import { SatchelMap, type MapPin } from '../native/maps.tsx';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { Body, Button, PressableScale } from './kit.tsx';

/** A wide view when the trip has no positions yet: the user zooms in to the spot. */
const WORLD: Region = { latitude: 20, longitude: 0, latitudeDelta: 100, longitudeDelta: 160 };

type Chosen = { at: LatLon; name: string | null };

function MapSheet({ field, value, choices, onUse, onClose }: { field: string; value: LatLon | null; choices: PositionChoice[]; onUse: (c: Chosen) => void; onClose: () => void }) {
  const { theme, t } = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [chosen, setChosen] = useState<Chosen | null>(value ? { at: value, name: null } : null);
  const [initialRegion] = useState<Region>(() => pickerRegion(value, choices) ?? WORLD);
  const pins = useMemo<MapPin[]>(() => {
    const out: MapPin[] = choices.map((c) => ({
      id: `c:${c.id}`,
      lat: c.lat,
      lon: c.lon,
      title: c.name,
      subtitle: c.source === 'saved' ? t(c.sample ? 'position.sourceSample' : 'position.sourceSaved') : t('position.sourceBooking', { booking: c.booking ?? '' }),
      color: c.source === 'saved' ? theme.warn : theme.accent,
      a11y: t('position.choicePinA11y', { name: c.name }),
    }));
    if (chosen) out.push({ id: 'chosen', lat: chosen.at.lat, lon: chosen.at.lon, title: t('position.chosenPin'), color: theme.ok, a11y: t('position.chosenPin') });
    return out;
  }, [choices, chosen, theme, t]);
  const onPin = (id: string) => {
    const c = choices.find((x) => `c:${x.id}` === id);
    if (c) setChosen({ at: { lat: c.lat, lon: c.lon }, name: c.name });
  };
  const status = chosen
    ? chosen.name
      ? t('position.chosenNamed', { name: chosen.name, coords: formatPos(chosen.at) })
      : t('position.chosen', { coords: formatPos(chosen.at) })
    : t('position.notChosen');
  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.m, paddingHorizontal: space.l, gap: space.m }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: theme.ink }}>
        {t('position.mapTitle')}
      </Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{field}</Text>
      <Body muted>{t('position.mapBody')}</Body>
      <SatchelMap
        pins={pins}
        initialRegion={initialRegion}
        onPinPress={onPin}
        onMapPress={(at) => setChosen({ at: roundPos(at), name: null })}
        height={Math.max(240, Math.round(height * 0.45))}
        label={t('position.mapLabel')}
        fallbackTitle={t('position.mapFallbackTitle')}
        fallbackBody={t('position.mapFallbackBody')}
      />
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: chosen ? theme.ink : theme.muted, fontVariant: ['tabular-nums'] }}>
        {status}
      </Text>
      <View style={{ flex: 1 }} />
      {chosen ? <Button label={t('position.use')} hint={t('position.useHint')} icon="checkmark" onPress={() => onUse(chosen)} /> : null}
      <Button label={t('common.cancel')} hint={t('position.cancelHint')} kind="quiet" onPress={onClose} />
    </View>
  );
}

function ListSheet({ choices, onPick, onClose }: { choices: PositionChoice[]; onPick: (c: PositionChoice) => void; onClose: () => void }) {
  const { theme, t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.m, paddingHorizontal: space.l, gap: space.m }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: theme.ink }}>
        {t('position.listTitle')}
      </Text>
      <FlatList
        style={{ flex: 1 }}
        data={choices}
        keyExtractor={(c) => c.id}
        initialNumToRender={20}
        renderItem={({ item: c }) => {
          const source = c.source === 'saved' ? t(c.sample ? 'position.sourceSample' : 'position.sourceSaved') : t('position.sourceBooking', { booking: c.booking ?? '' });
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('position.rowA11y', { name: c.name, source })}
              accessibilityHint={t('position.rowHint')}
              onPress={() => onPick(c)}
              style={{ paddingVertical: space.s, borderBottomWidth: 1, borderColor: theme.line }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{c.name}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{source}</Text>
            </PressableScale>
          );
        }}
        ListEmptyComponent={<Body muted>{t('position.listEmpty')}</Body>}
      />
      <Button label={t('common.cancel')} hint={t('position.cancelHint')} kind="quiet" onPress={onClose} />
    </View>
  );
}

/**
 * The position field. `value` is the draft text ("lat,lon" or ''); `onChange` gets the new text and, when the user
 * took one of the trip's places, its name (the form fills an empty name field with it).
 */
export const PositionField = memo(function PositionField({
  label,
  value,
  onChange,
  trip,
  itemId,
}: {
  label: string;
  value: string;
  onChange: (pos: string, name?: string) => void;
  trip: Trip;
  /** The booking being edited: its own places aren't offered back to it. */
  itemId?: string;
}) {
  const { theme, t, reduceMotion } = useApp();
  const [open, setOpen] = useState<'map' | 'list' | null>(null);
  const at = decodePos(value);
  const choices = useMemo(() => positionChoices(trip, itemId), [trip, itemId]);
  const coords = at ? formatPos(at) : '';
  const close = () => setOpen(null);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{label}</Text>
      <View
        accessible
        accessibilityLabel={at ? t('position.setA11y', { field: label, coords }) : t('position.noneA11y', { field: label })}
        style={{ borderWidth: 1, borderColor: theme.line, borderRadius: radius.s, padding: space.m, backgroundColor: theme.card }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: at ? theme.ink : theme.muted, fontVariant: ['tabular-nums'] }}>
          {at ? t('position.set', { coords }) : t('position.none')}
        </Text>
      </View>
      <Button label={t(at ? 'position.change' : 'position.onMap')} hint={t('position.onMapHint')} kind="secondary" icon="map-outline" onPress={() => setOpen('map')} />
      {choices.length ? <Button label={t('position.pick')} hint={t('position.pickHint')} kind="quiet" icon="bookmark-outline" onPress={() => setOpen('list')} /> : null}
      {at ? <Button label={t('position.remove')} hint={t('position.removeHint')} kind="quiet" icon="close-circle-outline" onPress={() => onChange('')} /> : null}
      <Modal visible={open !== null} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={close}>
        {open === 'map' ? (
          <MapSheet
            field={label}
            value={at}
            choices={choices}
            onClose={close}
            onUse={(c) => {
              close();
              onChange(encodePos(c.at), c.name ?? undefined);
            }}
          />
        ) : null}
        {open === 'list' ? (
          <ListSheet
            choices={choices}
            onClose={close}
            onPick={(c) => {
              close();
              onChange(encodePos(c), c.name);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
});
