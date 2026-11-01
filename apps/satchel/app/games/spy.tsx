// T125 Spot it (I spy): a short list of things to look out for on this kind of journey, ticked off as you see them.
// Ticks are kept per mode on this phone (src/state/games.ts).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { cleanTicks, toggleTick, type GameMode } from '../../src/core/games.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveGames, useGames } from '../../src/state/games.ts';
import { radius, space, typeScale } from '../../src/theme/tokens.ts';
import { GAMES, ModePicker, modeParam } from '../../src/ui/games.tsx';
import { ProgressBar } from '../../src/ui/hero.tsx';
import { Body, Button, PressableScale, Screen } from '../../src/ui/kit.tsx';

export default function SpyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t, theme } = useApp();
  const [state] = useGames();
  const [mode, setMode] = useState<GameMode>(() => modeParam(params.mode));
  const items = GAMES.spy[mode];
  const ticks = cleanTicks(state.spy[mode] ?? [], items);
  const set = (next: string[]) => saveGames((g) => ({ ...g, spy: { ...g.spy, [mode]: next } }));
  const done = ticks.length === items.length;

  return (
    <Screen>
      <ModePicker mode={mode} onChange={setMode} />
      <Body muted>{t('games.spy.howTo')}</Body>
      <ProgressBar progress={items.length ? ticks.length / items.length : 0} tone="ok" label={t('games.spy.progress', { n: ticks.length, total: items.length })} />
      <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: done ? theme.ok : theme.ink }]}>
        {done ? t('games.spy.allDone') : t('games.spy.progress', { n: ticks.length, total: items.length })}
      </Text>
      <View style={{ gap: space.s }}>
        {items.map((it) => {
          const on = ticks.includes(it.id);
          return (
            <PressableScale
              key={it.id}
              accessibilityRole="checkbox"
              accessibilityLabel={it.text}
              accessibilityHint={on ? t('games.spy.untickHint') : t('games.spy.tickHint')}
              accessibilityState={{ checked: on }}
              onPress={() => set(toggleTick(ticks, it.id))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.m,
                paddingHorizontal: space.l,
                paddingVertical: space.s,
                borderRadius: radius.m,
                borderWidth: 1,
                borderColor: on ? theme.ok : theme.line,
                backgroundColor: on ? theme.okSoft : theme.cardRaised,
              }}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? theme.ok : theme.muted} />
              </View>
              <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{it.text}</Text>
            </PressableScale>
          );
        })}
      </View>
      <Button label={t('games.spy.reset')} hint={t('games.spy.resetHint')} kind="quiet" icon="refresh-outline" onPress={() => set([])} />
    </Screen>
  );
}
