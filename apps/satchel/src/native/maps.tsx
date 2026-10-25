// Map adapter. TRIAL uses react-native-maps with the system map (online in Expo Go). The module is required lazily
// inside try/catch, and rendering sits behind an error boundary, so a build without the native map shows a plain
// list of the same pins instead of crashing. MapLibre (offline) replaces the inside of this file in NATIVE.
// Never turns on showsUserLocation: that would watch location continuously. "You are here" is a pin we place
// from a single check.
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { FlatList, Text, View } from 'react-native';
import type MapViewType from 'react-native-maps';
import { validLatLon, type LatLon, type Region } from '../core/poi.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { Body, PressableScale } from '../ui/kit.tsx';

type MapsModule = typeof import('react-native-maps');

let cached: MapsModule | null | undefined;
function loadMaps(): MapsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps') as MapsModule & { default?: unknown };
    cached = mod && mod.default && mod.Marker ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const mapAvailable = () => loadMaps() !== null;

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  title: string;
  subtitle?: string;
  /** A theme token colour. */
  color: string;
  /** Screen-reader label, already translated. */
  a11y: string;
};

/** Changing `key` moves the map to `region`. */
export type MapFocus = { region: Region; key: number };

type Props = {
  pins: MapPin[];
  initialRegion: Region;
  focus?: MapFocus | null;
  onPinPress: (id: string) => void;
  height: number;
  /** Translated strings for the map's label and the no-map fallback. */
  label: string;
  fallbackTitle: string;
  fallbackBody: string;
  /** Tap on the map itself (not a pin): selects that spot (FLOWS §11.1). Not offered by the no-map fallback list. */
  onMapPress?: (at: LatLon) => void;
};

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PinList({ pins, onPinPress, title, body, height }: { pins: MapPin[]; onPinPress: (id: string) => void; title: string; body: string; height: number }) {
  const { theme } = useApp();
  return (
    <View style={{ height, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, padding: space.m, gap: space.s }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
        {title}
      </Text>
      <Body muted>{body}</Body>
      <FlatList
        data={pins}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PressableScale accessibilityRole="button" accessibilityLabel={item.a11y} onPress={() => onPinPress(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: theme.ink }} numberOfLines={1}>
              {item.title}
            </Text>
          </PressableScale>
        )}
      />
    </View>
  );
}

export function SatchelMap({ pins, initialRegion, focus, onPinPress, height, label, fallbackTitle, fallbackBody, onMapPress }: Props) {
  const { theme } = useApp();
  const ref = useRef<MapViewType | null>(null);
  const maps = loadMaps();

  useEffect(() => {
    if (!focus) return;
    try {
      ref.current?.animateToRegion(focus.region, 320);
    } catch {
      // map not ready; the pins are still there
    }
  }, [focus]);

  const fallback = <PinList pins={pins} onPinPress={onPinPress} title={fallbackTitle} body={fallbackBody} height={height} />;
  if (!maps) return fallback;
  const MapView = maps.default;
  const { Marker } = maps;
  return (
    <Boundary fallback={fallback}>
      <View style={{ height, borderRadius: radius.m, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
        <MapView
          ref={ref}
          style={{ flex: 1 }}
          accessibilityLabel={label}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          userInterfaceStyle={theme.dark ? 'dark' : 'light'}
          onPress={
            onMapPress
              ? (e) => {
                  // iOS also reports marker taps here; those are handled by the marker's own onPress.
                  const ev = e?.nativeEvent;
                  if (!ev || ev.action === 'marker-press' || !ev.coordinate) return;
                  const { latitude, longitude } = ev.coordinate;
                  if (validLatLon(latitude, longitude)) onMapPress({ lat: latitude, lon: longitude });
                }
              : undefined
          }
        >
          {pins.map((p) => (
            <Marker
              key={p.id}
              identifier={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lon }}
              title={p.title}
              description={p.subtitle}
              pinColor={p.color}
              tracksViewChanges={false}
              accessibilityLabel={p.a11y}
              onPress={() => onPinPress(p.id)}
            />
          ))}
        </MapView>
      </View>
    </Boundary>
  );
}
