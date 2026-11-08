// T125 Score keeper: a tiny scoreboard for any game on the go. Starts with You and the trip's companions (Travelling
// together), a point up or down each, add or remove players, reset. The board stays on this phone (src/state/games.ts).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { addPlayer, addPoints, leaders, MAX_PLAYERS, missingPlayers, playersFor, removePlayer, resetScores, type Player } from '../../src/core/games.ts';
import { newId } from '../../src/core/model.ts';
import { readCompanions } from '../../src/core/together.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveGames, useGames } from '../../src/state/games.ts';
import { elevated, fonts, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { useGameTrip } from '../../src/ui/games.tsx';
import { Body, Button, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';

export default function ScoresScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { t, theme } = useApp();
  const trip = useGameTrip(params.tripId);
  const [state, loaded] = useGames();
  const [name, setName] = useState('');
  const companions = trip ? readCompanions(trip) : [];
  const players = state.players;
  const missing = missingPlayers(players, companions);
  const top = leaders(players);
  const full = players.length >= MAX_PLAYERS;

  // First time: You plus the trip's companions.
  useEffect(() => {
    if (loaded && players.length === 0) saveGames((g) => (g.players.length ? g : { ...g, players: playersFor(companions, t('together.you')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, players.length]);

  const set = (change: (p: Player[]) => Player[]) => saveGames((g) => ({ ...g, players: change(g.players) }));
  const add = () => {
    const before = players.length;
    const after = addPlayer(players, name, newId('plyr'));
    if (after.length === before) {
      AccessibilityInfo.announceForAccessibility(full ? t('games.scores.full', { n: MAX_PLAYERS }) : t('games.scores.addRefused'));
      return;
    }
    set(() => after);
    setName('');
  };
  const reset = () =>
    Alert.alert(t('games.scores.resetTitle'), t('games.scores.resetBody'), [
      { text: t('games.cancel'), style: 'cancel' },
      { text: t('games.scores.resetConfirm'), onPress: () => set(resetScores) },
    ]);

  const leadLine = top.length === 0 ? t('games.scores.noLeader') : top.length === 1 ? t('games.scores.leader', { name: top[0].name }) : t('games.scores.tied', { names: top.map((p) => p.name).join(', ') });

  return (
    <Screen>
      <Body muted>{t('games.scores.howTo')}</Body>
      <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: top.length ? theme.accentInk : theme.ink }]}>
        {leadLine}
      </Text>
      <View style={{ gap: space.s }}>
        {players.map((p) => (
          <View key={p.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingLeft: space.l, paddingRight: space.s, borderRadius: radius.l }, elevated(theme, 'low')]}>
            <View accessible accessibilityLabel={t('games.scores.rowA11y', { name: p.name, n: p.score })} style={{ flex: 1, paddingVertical: space.s }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
                {p.name}
              </Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('games.scores.minus', { name: p.name })}
              accessibilityHint={t('games.scores.minusHint')}
              onPress={() => set((list) => addPoints(list, p.id, -1))}
              style={{ width: TOUCH, alignItems: 'center' }}
            >
              <Ionicons name="remove-circle-outline" size={28} color={theme.sea} />
            </PressableScale>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[typeScale.displayM, { color: theme.ink, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }]}
            >
              {p.score}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('games.scores.plus', { name: p.name })}
              accessibilityHint={t('games.scores.plusHint')}
              onPress={() => set((list) => addPoints(list, p.id, 1))}
              style={{ width: TOUCH, alignItems: 'center' }}
            >
              <Ionicons name="add-circle" size={32} color={theme.accent} />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('games.scores.remove', { name: p.name })}
              accessibilityHint={t('games.scores.removeHint')}
              onPress={() => set((list) => removePlayer(list, p.id))}
              style={{ width: TOUCH, alignItems: 'center' }}
            >
              <Ionicons name="close-outline" size={22} color={theme.muted} />
            </PressableScale>
          </View>
        ))}
      </View>

      {missing.length && !full ? (
        <Button
          kind="secondary"
          icon="people-outline"
          label={t('games.scores.addCompanions', { n: missing.length })}
          hint={t('games.scores.addCompanionsHint')}
          onPress={() => set((list) => [...list, ...missingPlayers(list, companions)].slice(0, MAX_PLAYERS))}
        />
      ) : null}
      {full ? (
        <Body muted>{t('games.scores.full', { n: MAX_PLAYERS })}</Body>
      ) : (
        <View style={{ gap: space.s }}>
          <TextField label={t('games.scores.addLabel')} placeholder={t('games.scores.addPlaceholder')} value={name} onChange={setName} autoCapitalize="words" />
          <Button label={t('games.scores.add')} hint={t('games.scores.addHint')} kind="quiet" icon="person-add-outline" onPress={add} />
        </View>
      )}
      <Button label={t('games.scores.reset')} hint={t('games.scores.resetHint')} kind="quiet" icon="refresh-outline" onPress={reset} />
    </Screen>
  );
}
