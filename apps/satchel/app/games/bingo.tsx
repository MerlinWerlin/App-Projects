// T125 Travel bingo: a 5x5 card of original icon tiles for the journey (src/ui/gameIcons.tsx), the same card for the
// same seed (src/core/games.ts buildCard), a free middle square, tap to mark. A finished row, column or diagonal is
// announced and its squares glow once with a timed fade (no springs); with Reduce Motion they are outlined at once
// with no movement. Completed lines stay outlined. The card and its marks stay on this phone (src/state/games.ts).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Text, useWindowDimensions, View } from 'react-native';
import {
  BINGO_SIZE,
  bingoLines,
  buildCard,
  cellsOnLines,
  cleanMarks,
  FREE,
  FREE_INDEX,
  bingoFor,
  isFullCard,
  newLines,
  newSeed,
  putBingo,
  setBingoMarks,
  showBingo,
  toggleMark,
  type BingoLine,
  type BingoTile,
  type GameMode,
} from '../../src/core/games.ts';
import { haptic } from '../../src/native/device.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveGames, useGames } from '../../src/state/games.ts';
import { duration, timed } from '../../src/theme/motion.ts';
import { fonts, radius, space, typeScale } from '../../src/theme/tokens.ts';
import { GameGlyph } from '../../src/ui/gameIcons.tsx';
import { GAMES, MODE_KEY, ModePicker, modeParam } from '../../src/ui/games.tsx';
import { Body, Button, PressableScale, Screen } from '../../src/ui/kit.tsx';

const GAP = space.xs;
/** How long a finished line glows before fading back. */
const HOLD_MS = 900;

export default function BingoScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const [state, loaded] = useGames();
  const { width } = useWindowDimensions();
  const wanted = modeParam(params.mode, state.bingo?.mode ?? 'city');
  const [mode, setMode] = useState<GameMode>(wanted);
  const flash = useRef(new Animated.Value(0)).current;
  const [glow, setGlow] = useState<Set<number>>(new Set());

  // T126: each mode keeps its own card and marks: switching back brings that mode's card back; a mode with none yet
  // gets a fresh one. The mode shown becomes the current one, so the screen reopens on it.
  useEffect(() => {
    if (!loaded) return;
    if (!state.bingo || state.bingo.mode !== mode || !state.bingoCards?.[mode]) saveGames((g) => showBingo(g, mode, newSeed(Date.now())));
  }, [loaded, mode, state.bingo, state.bingoCards]);

  const bingo = bingoFor(state, mode);
  const tiles = GAMES.bingo[mode];
  const byId = useMemo(() => new Map<string, BingoTile>(tiles.map((x) => [x.id, x])), [tiles]);
  const card = useMemo(() => (bingo ? buildCard(tiles, mode, bingo.seed) : null), [tiles, mode, bingo?.seed]);
  const marks = bingo?.marks ?? [FREE_INDEX];
  const lines = bingoLines(marks);
  const onLine = cellsOnLines(lines);
  const tileSize = Math.floor((Math.min(width, 560) - space.l * 2 - GAP * (BINGO_SIZE - 1)) / BINGO_SIZE);

  const lineName = (l: BingoLine) => {
    const n = Number(l.id.slice(-1)) + 1;
    return l.kind === 'row' ? t('games.bingo.lineRow', { n }) : l.kind === 'col' ? t('games.bingo.lineCol', { n }) : t('games.bingo.lineDiag');
  };

  const celebrate = (fresh: BingoLine[], after: number[]) => {
    haptic.success();
    const names = fresh.map(lineName).join(', ');
    AccessibilityInfo.announceForAccessibility(isFullCard(after) ? t('games.bingo.fullCard') : t('games.bingo.bingoA11y', { lines: names }));
    if (reduceMotion) return;
    setGlow(cellsOnLines(fresh));
    flash.setValue(0);
    Animated.sequence([timed(flash, 1, duration.base), timed(flash, 0, duration.slow, false, HOLD_MS)]).start(({ finished }) => {
      if (finished) setGlow(new Set());
    });
  };

  const tap = (i: number) => {
    if (!bingo) return;
    const after = toggleMark(marks, i);
    saveGames((g) => setBingoMarks(g, mode, after));
    const fresh = newLines(marks, after);
    if (fresh.length) celebrate(fresh, after);
  };

  const deal = () => {
    const doIt = () => saveGames((g) => putBingo(g, { mode, seed: newSeed(Date.now()), marks: cleanMarks([]) }));
    if (marks.length <= 1) return doIt();
    Alert.alert(t('games.bingo.newTitle'), t('games.bingo.newBody'), [
      { text: t('games.cancel'), style: 'cancel' },
      { text: t('games.bingo.newConfirm'), onPress: doIt },
    ]);
  };
  const clear = () => saveGames((g) => setBingoMarks(g, mode, cleanMarks([])));

  const status = isFullCard(marks)
    ? t('games.bingo.fullCard')
    : lines.length === 0
      ? t('games.bingo.noLines', { n: marks.length - 1 })
      : lines.length === 1
        ? t('games.bingo.oneLine', { line: lineName(lines[0]) })
        : t('games.bingo.manyLines', { n: lines.length });

  return (
    <Screen>
      <ModePicker mode={mode} onChange={setMode} />
      <Body muted>{t('games.bingo.howTo', { mode: t(MODE_KEY[mode]) })}</Body>
      <Body muted>{t('f101.bingo.perMode')}</Body>

      <View accessibilityLabel={t('games.bingo.cardA11y')} style={{ gap: GAP, alignSelf: 'center' }}>
        {card
          ? Array.from({ length: BINGO_SIZE }, (_, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: GAP }}>
                {card.cells.slice(r * BINGO_SIZE, r * BINGO_SIZE + BINGO_SIZE).map((id, c) => {
                  const i = r * BINGO_SIZE + c;
                  const marked = marks.includes(i);
                  const lined = onLine.has(i);
                  const box = {
                    width: tileSize,
                    height: tileSize,
                    borderRadius: radius.s,
                    borderWidth: lined ? 2.5 : 1,
                    borderColor: lined ? theme.accent : marked ? theme.ok : theme.line,
                    backgroundColor: marked ? theme.okSoft : theme.cardRaised,
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                    padding: 2,
                    overflow: 'hidden' as const,
                  };
                  const overlay = glow.has(i) ? (
                    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.accentSoft, opacity: flash }} />
                  ) : null;
                  if (id === FREE) {
                    return (
                      <View key={i} accessible accessibilityLabel={t('games.bingo.free')} style={box}>
                        {overlay}
                        <Ionicons name="star" size={tileSize * 0.36} color={theme.accent} />
                        <Text numberOfLines={1} style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: theme.accentInk }}>
                          {t('games.bingo.freeShort')}
                        </Text>
                      </View>
                    );
                  }
                  const tile = byId.get(id);
                  if (!tile) return <View key={i} style={box} />;
                  return (
                    <PressableScale
                      key={i}
                      accessibilityRole="checkbox"
                      accessibilityLabel={tile.label}
                      accessibilityHint={marked ? t('games.bingo.unmarkHint') : t('games.bingo.markHint')}
                      accessibilityState={{ checked: marked }}
                      onPress={() => tap(i)}
                      style={box}
                    >
                      {overlay}
                      <GameGlyph icon={tile.icon} size={Math.round(tileSize * 0.5)} />
                      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, textAlign: 'center', color: theme.ink }}>
                        {tile.label}
                      </Text>
                      {marked ? (
                        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 2, right: 2 }}>
                          <Ionicons name="checkmark-circle" size={16} color={theme.ok} />
                        </View>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            ))
          : null}
      </View>

      <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: lines.length ? theme.accentInk : theme.ink, textAlign: 'center' }]}>
        {status}
      </Text>
      <View style={{ gap: space.s }}>
        <Button label={t('games.bingo.new')} hint={t('games.bingo.newHint')} icon="shuffle-outline" onPress={deal} />
        <Button label={t('games.bingo.clear')} hint={t('games.bingo.clearHint')} kind="quiet" icon="refresh-outline" onPress={clear} />
      </View>
      <Body muted>{t('games.bingo.safety')}</Body>
    </Screen>
  );
}
