/**
 * Phone level: lay the phone along the slope (flat on a sheet, or on its long edge against a rafter) and read the pitch.
 * The angle of the phone's long (y) axis above level is asin(|g_y| / |g|), from the accelerometer's gravity vector,
 * smoothed with an exponential moving average. "Zero here" stores an offset measured on a known-level surface.
 */
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { num, riseOver12, toDeg } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { RADIUS, SPACE, TYPE } from '../src/theme/theme';
import { Btn, Notice, Screen, tap, Txt } from '../src/ui/kit';
import { SaveToJob } from '../src/ui/parts';

export function tiltDeg(x: number, y: number, z: number): number | null {
  const g = Math.sqrt(x * x + y * y + z * z);
  if (!(g > 0.2)) return null;
  return toDeg(Math.asin(Math.min(1, Math.abs(y) / g)));
}

export default function Level() {
  useKeepAwake();
  const app = useApp();
  const { theme, ctx, prefs } = app;
  const router = useRouter();
  const [deg, setDeg] = useState<number | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const smooth = useRef<number | null>(null);

  useEffect(() => {
    let sub: { remove(): void } | null = null;
    let alive = true;
    (async () => {
      const ok = Platform.OS !== 'web' && (await Accelerometer.isAvailableAsync().catch(() => false));
      if (!alive) return;
      setAvailable(ok);
      if (!ok) return;
      Accelerometer.setUpdateInterval(60);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const a = tiltDeg(x, y, z);
        if (a == null) return;
        smooth.current = smooth.current == null ? a : smooth.current * 0.85 + a * 0.15;
        setDeg(smooth.current);
      });
    })();
    return () => { alive = false; sub?.remove(); };
  }, []);

  const live = deg == null ? null : Math.max(0, deg - offset);
  const shown = held ?? live;
  return (
    <Screen>
      <View style={[st.dial, { backgroundColor: theme.accent }]} accessible accessibilityLabel={shown == null ? 'Waiting for the tilt sensor' : `Pitch ${ctx.pitch(shown)}${held != null ? ', held' : ''}`}>
        <Svg width={220} height={120} viewBox="0 0 220 120">
          <Line x1={10} y1={110} x2={210} y2={110} stroke={theme.onAccent} strokeWidth={3} />
          {shown != null ? (
            <Path d={`M10,110 L210,${110 - Math.tan((Math.min(shown, 60) * Math.PI) / 180) * 200}`} stroke={theme.onAccent} strokeWidth={6} strokeLinecap="round" />
          ) : null}
        </Svg>
        <Text style={[TYPE.hero, { color: theme.onAccent, fontSize: 72, lineHeight: 78, fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={1.2}>
          {shown == null ? '––' : ctx.pitch(shown)}
        </Text>
        <Text style={[TYPE.headline, { color: theme.onAccent }]}>
          {shown == null ? ' ' : prefs.pitchStyle === 'x12' ? `${num(shown, 1)}°` : `${num(riseOver12(shown), 2)}:12`}{held != null ? ' · HELD' : ''}
        </Text>
      </View>
      {available === false ? <Notice text="This device has no tilt sensor Eaveline can read. Use Pitch with a rise and run instead." /> : null}
      <Txt v="body" tone="ink2">Lay the phone along the slope: flat on the sheet or tiles, or on its long edge against the rafter, top of the phone pointing up the roof.</Txt>
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Btn style={{ flex: 1 }} label={held == null ? 'Hold reading' : 'Release'} icon={held == null ? 'pause' : 'play'} kind="ink"
          onPress={() => { tap(prefs.haptics, 'success'); setHeld(held == null ? live : null); }} disabled={live == null && held == null} />
        <Btn style={{ flex: 1 }} label="Zero here" icon="locate-outline" kind="outline" onPress={() => { if (deg != null) { setOffset(deg); tap(prefs.haptics); } }} disabled={deg == null} accessibilityHint="Sets the current reading as level. Do this on a surface you know is level." />
      </View>
      {offset ? <Btn label={`Clear zero (${num(offset, 1)}°)`} kind="plain" onPress={() => setOffset(0)} /> : null}
      {shown != null ? (
        <>
          <Btn label="Use as the roof pitch" kind="outline" icon="home-outline" onPress={() => { app.setRoof({ ...app.roof, pitchDeg: Math.round(shown * 10) / 10 }); router.push('/roof'); }} />
          <SaveToJob tool="level" title="Measured pitch" lines={[`${ctx.pitch(shown)} measured with the phone level`]} />
        </>
      ) : null}
      <View style={[st.tip, { borderColor: theme.line }]}>
        <Ionicons name="information-circle-outline" size={20} color={theme.ink2} />
        <Txt v="footnote" tone="ink2" style={{ flex: 1 }}>Phone sensors read to about ±0.5°. Cases and bumps add error: check against a spirit level for anything close to a profile’s minimum pitch.</Txt>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  dial: { borderRadius: RADIUS.l, alignItems: 'center', paddingVertical: SPACE.lg, gap: SPACE.xs },
  tip: { flexDirection: 'row', gap: SPACE.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.m, padding: SPACE.sm },
});
