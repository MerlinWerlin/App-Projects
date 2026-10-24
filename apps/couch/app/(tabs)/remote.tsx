import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Key } from '../../src/core/keys';
import { oneHandedAlign } from '../../src/core/prefs';
import { minKeyHeight, remoteContentWidth, rowOrStack } from '../../src/core/textScale';
import { useT } from '../../src/i18n/react';
import { usePrefs } from '../../src/state/prefs';
import { useSession } from '../../src/state/session';
import { useCastRouting } from '../../src/state/cast';
import { RemoteCastPill } from '../../src/ui/cast/CastPill';
import { fonts, radius } from '../../src/theme/tokens';
import { useRemoteTheme } from '../../src/theme/useRemoteTheme';
import { DemoNote, FreePromise, Screen } from '../../src/ui/Screen';
import { NeverMirror } from '../../src/ui/NeverMirror';
import { Text } from '../../src/ui/Text';
import { emitFx } from '../../src/ui/fx/bus';
import { CinemaGlow } from '../../src/ui/fx/CinemaGlow';
import { glowColor, haloStyle, remoteStage } from '../../src/ui/fx/glow';
import { keyDir, volumeStep } from '../../src/ui/fx/keyDir';
import { Marquee } from '../../src/ui/fx/Marquee';
import { VolumeHud } from '../../src/ui/fx/VolumeHud';
import { RemoteIcon } from '../../src/ui/icons/RemoteIcon';
import { KeyboardSheet } from '../../src/ui/keyboard/KeyboardSheet';
import { NumpadSheet } from '../../src/ui/remote/NumpadSheet';
import { SleepTimerChip, SleepTimerSheet } from '../../src/ui/remote/SleepTimerSheet';
import { SourceSheet } from '../../src/ui/remote/SourceSheet';
import { VoiceButton } from '../../src/ui/remote/VoiceButton';
import {
  CHANNEL,
  MID,
  NAV_MODE_LABEL_KEY,
  NAV_MODES,
  NAV_ROW,
  opensSourceSheet,
  PLAYBACK_ROW,
  TOP_ROW_KEYS,
  VOLUME,
  type ActionId,
  type NavMode,
} from '../../src/ui/remote/controls';
import { ColorKeys } from '../../src/ui/remote/ColorKeys';
import { DPad } from '../../src/ui/remote/DPad';
import { RemoteTexture } from '../../src/ui/remote/RemoteTexture';
import { tap } from '../../src/ui/remote/haptics';
import { RemoteButton, RemoteKey, Rocker } from '../../src/ui/remote/RemoteKey';
import { SimpleRemote } from '../../src/ui/remote/SimpleRemote';
import { Touchpad } from '../../src/ui/remote/Touchpad';
import { TvHeader } from '../../src/ui/remote/TvHeader';
import { useAnnounce } from '../../src/ui/useAnnounce';

/** Splits a `...Rich` message around its {slot} so the slot can be a nested styled element. */
function splitRich(text: string, slot: string): [string, string] {
  const i = text.indexOf(slot);
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + slot.length)];
}

/** The remote, ported from prototype/index.html viewRemote() (v2). Every button is free. */
export default function RemoteScreen() {
  // Remote theme (owner-1017): colours, texture, glow and press feel; never what a button does.
  const theme = useRemoteTheme();
  const t = useT();
  const router = useRouter();
  const { session, snap } = useSession();
  // A failed key (here or in the keyboard / numpad / source sheets) is spoken on iOS too (night 23 Oct).
  useAnnounce(snap.lastError);
  const { prefs } = usePrefs();
  const oneHanded = prefs.oneHanded !== 'off';
  // Larger Text (T74, src/core/textScale.ts): rows of labels turn into stacks when the scaled
  // labels no longer fit the card, instead of overlapping or truncating.
  const win = useWindowDimensions();
  const avail = remoteContentWidth(win.width, oneHanded);
  const topLayout = rowOrStack(
    avail,
    TOP_ROW_KEYS.map((c) => c.caption ?? ''),
    { fontSize: 11.5, fontScale: win.fontScale, role: 'caption', padH: 10, minItem: 64, gap: 10 },
  );
  // The segmented control's own 3 pt padding comes off the width.
  const segLayout = rowOrStack(
    avail - 6,
    NAV_MODES.map((m) => m.label),
    { fontSize: 12.5, fontScale: win.fontScale, role: 'label', padH: 12 },
  );
  const segBtnH = minKeyHeight(12.5, win.fontScale, 'label', { padV: 5, floor: 32 });
  const [mode, setMode] = useState<NavMode>('pad');
  const [kbOpen, setKbOpen] = useState(false);
  const [numOpen, setNumOpen] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const tv = session.activeTv();
  // cast-1024: while a cast is on the TV, Play/Pause controls the cast (src/state/cast.tsx).
  const { handlesKey: castHandles, togglePlay: castTogglePlay } = useCastRouting();
  // Cinema glow colour (null = none). 'theme' (default) uses the remote theme's glow; Match TV uses
  // the active saved TV; demo gets amber. The stage behind the remote comes from the theme.
  const glow = glowColor(prefs.glow, snap.demo ? null : (tv?.id ?? null), theme.glow);
  const stage = remoteStage(theme, glow);

  // session.sendKey never throws; failures surface as snap.lastError.
  const onKey = useCallback(
    (key: Key, label: string) => {
      // Decoration cues for the cinema glow and the volume HUD (never affect sending).
      if (key === 'POWER') emitFx({ type: 'power' });
      else emitFx({ type: 'press', dir: keyDir(key) });
      const step = volumeStep(key);
      if (step) emitFx({ type: 'volume', step });
      // cast-1024: Play/Pause goes to the cast while one is on.
      if (castHandles(key)) {
        setLast(label);
        castTogglePlay();
        return;
      }
      // Source opens the source picker (prototype v2); the sheet sends the input change itself.
      if (opensSourceSheet(key)) {
        setSrcOpen(true);
        return;
      }
      setLast(label);
      setNote(null);
      void session.sendKey(key);
    },
    [session, castHandles, castTogglePlay],
  );

  const onAction = (a: ActionId) => {
    if (a === 'KEYBOARD') setKbOpen(true);
    else if (a === 'NUMPAD') setNumOpen(true);
    else router.navigate('/apps');
  };

  const onNumSent = useCallback((label: string) => {
    setLast(label);
    setNote(null);
  }, []);

  // Colour row only for TVs whose driver says the colour keys reach the TV (hidden on Roku).
  const colours = session.can('colorKeys');
  const [sentBefore, sentAfter] = splitRich(t('app.remote.sentRich'), '{key}');

  return (
    <View style={styles.root}>
      {/* The theme's stage behind everything (near-black while a glow is on), incl. the status-bar strip. */}
      <Screen bg={stage.bg}>
        <TvHeader tv={tv} state={snap.state} lastMs={snap.lastMs} onPress={() => router.navigate('/tvs')} />
        <RemoteCastPill />

        {snap.lastError ? (
          <Pressable
            accessibilityRole="alert"
            accessibilityLabel={t('app.remote.errorLabel', { message: snap.lastError })}
            onPress={() => session.clearError()}
            style={[styles.error, { backgroundColor: theme.accentSoft }]}
          >
            <Text scaleRole="body" style={[styles.errorText, { color: theme.power }]}>
              {snap.lastError}
            </Text>
          </Pressable>
        ) : null}

        {/* One-handed: narrower column pushed toward the chosen thumb. The glow spills around it. */}
        <View style={[styles.column, { alignItems: oneHandedAlign(prefs.oneHanded) }]}>
          {glow ? <CinemaGlow color={glow} style={styles.glow} /> : null}
          <View style={oneHanded ? styles.oneHanded : styles.full}>
            {glow ? <Marquee color={glow} style={styles.marquee} /> : null}
            {prefs.simple ? (
              <SimpleRemote onKey={onKey} width={avail} />
            ) : (
              <View style={[styles.remote, { backgroundColor: theme.body }, haloStyle(glow)]}>
                {/* Generated texture (gradient / stripes / edge light), decoration only, behind the keys. */}
                <RemoteTexture texture={theme.texture} radius={radius.remote} />
                <View style={topLayout === 'row' ? styles.row : styles.stack}>
                  {TOP_ROW_KEYS.map((c) => (
                    <RemoteKey key={c.key} control={c} onKey={onKey} />
                  ))}
                </View>

                <View style={[styles.row, styles.center]}>
                  <View
                    accessibilityLabel={t(NAV_MODE_LABEL_KEY)}
                    style={[
                      styles.seg,
                      segLayout === 'stack' ? styles.segStack : null,
                      { backgroundColor: theme.key, shadowColor: theme.keyEdge },
                    ]}
                  >
                    {NAV_MODES.map((m) => {
                      const on = mode === m.mode;
                      return (
                        <Pressable
                          key={m.mode}
                          accessibilityRole="button"
                          accessibilityLabel={m.label}
                          accessibilityState={{ selected: on }}
                          hitSlop={8}
                          onPress={() => {
                            tap();
                            setMode(m.mode);
                          }}
                          style={[styles.segBtn, { minHeight: segBtnH }, on ? { backgroundColor: theme.accent } : null]}
                        >
                          <Text scaleRole="label" style={[styles.segText, { color: on ? theme.accentInk : theme.muted }]}>
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {mode === 'pad' ? <DPad onKey={onKey} /> : <Touchpad onKey={onKey} />}

                <VoiceButton onNote={setNote} onOpenKeyboard={() => setKbOpen(true)} />

                <View style={styles.row}>
                  {NAV_ROW.map((c) => (
                    <RemoteKey key={c.key} control={c} onKey={onKey} />
                  ))}
                </View>

                {/* Volume and channel rockers keep their physical sides in right-to-left languages. */}
                <NeverMirror style={styles.row}>
                  <Rocker data={VOLUME} onKey={onKey} />
                  <View style={styles.mid}>
                    {MID.map((c) =>
                      c.kind === 'key' ? (
                        <RemoteKey key={c.key} control={c} onKey={onKey} style={styles.midKey} />
                      ) : (
                        <RemoteButton key={c.action} label={c.label} onPress={() => onAction(c.action)} style={styles.midKey}>
                          <RemoteIcon name={c.icon} size={22} color={theme.ink} />
                        </RemoteButton>
                      ),
                    )}
                  </View>
                  <Rocker data={CHANNEL} onKey={onKey} />
                </NeverMirror>

                {/* Rewind stays on the left and fast-forward on the right in every language. */}
                <NeverMirror style={styles.row}>
                  {PLAYBACK_ROW.map((c) => (
                    <RemoteKey key={c.key} control={c} onKey={onKey} />
                  ))}
                </NeverMirror>

                {colours ? <ColorKeys onKey={onKey} /> : null}

                <View style={styles.log} accessibilityLiveRegion="polite">
                  {note ? (
                    <Text scaleRole="meta" style={[styles.logText, { color: theme.muted }]}>{note}</Text>
                  ) : last ? (
                    <>
                      <Text scaleRole="meta" style={[styles.logText, { color: theme.muted }]}>
                        {sentBefore}
                        <Text scaleRole="meta" style={{ color: theme.ink }}>
                          {last}
                        </Text>
                        {sentAfter}
                      </Text>
                      <Text scaleRole="meta" style={[styles.logText, { color: theme.muted }]}>
                        {snap.lastMs === null ? '' : t('app.remote.ms', { ms: Math.round(snap.lastMs) })}
                      </Text>
                    </>
                  ) : (
                    <Text scaleRole="meta" style={[styles.logText, { color: theme.muted }]}>{t('app.remote.ready')}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Sleep timer (T72): free, in both full and simple mode; opens its sheet like the numpad. */}
        <SleepTimerChip onOpen={() => setSleepOpen(true)} ink={stage.ink} />

        {/* Stage ink keeps AA over the theme's stage and glow (glow.test.ts). */}
        <FreePromise color={stage.ink} />
        {snap.demo ? <DemoNote color={stage.ink} /> : null}

        <KeyboardSheet visible={kbOpen} onClose={() => setKbOpen(false)} />
        <NumpadSheet visible={numOpen} onClose={() => setNumOpen(false)} onSent={onNumSent} />
        <SourceSheet visible={srcOpen} onClose={() => setSrcOpen(false)} />
        <SleepTimerSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      </Screen>
      {/* Floating volume HUD (T39): outside the ScrollView so it floats over the screen, not the content. */}
      <VolumeHud />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: { top: -36, bottom: -48, start: -16, end: -16 },
  marquee: { position: 'absolute', top: -10, start: 0, end: 0 },
  column: { width: '100%' },
  full: { width: '100%' },
  oneHanded: { width: '86%' },
  remote: { borderRadius: radius.remote, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, gap: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  /** Larger Text (T74): the labelled top keys one per line, full width, when they no longer fit a row. */
  stack: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  center: { justifyContent: 'center' },
  seg: {
    flexDirection: 'row',
    borderRadius: 99,
    padding: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2,
  },
  segBtn: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', alignItems: 'center' },
  segText: { fontFamily: fonts.textSemi, fontSize: 12.5, textAlign: 'center' },
  /** Larger Text (T74): D-pad / Touchpad one above the other, full width. */
  segStack: { flexDirection: 'column', width: '100%', borderRadius: 22 },
  mid: { flexDirection: 'row', flexWrap: 'wrap', width: 114, gap: 10 },
  midKey: { width: 52, height: 52 },
  // Wraps at larger text sizes so the sent-key note and the latency never overlap.
  log: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, minHeight: 18 },
  logText: { fontFamily: fonts.mono, fontSize: 11.5, flexShrink: 1 },
  error: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  errorText: { fontFamily: fonts.textSemi, fontSize: 13.5 },
});
