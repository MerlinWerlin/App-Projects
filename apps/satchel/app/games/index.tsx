// T125 Travel games hub: pick the kind of journey (plane / train / road / city walk), then a game: travel bingo,
// spot it, the question deck or the score keeper. Opened from In-flight mode (plane), Your day (mode from the next
// booking) and the Trips tab. Everything works offline; game state stays on this phone (src/state/games.ts).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../src/state/app.tsx';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { GameRow, ModePicker, modeParam, useGameTrip } from '../../src/ui/games.tsx';
import { FadeInView, HeroHeader } from '../../src/ui/hero.tsx';
import { Label, Screen } from '../../src/ui/kit.tsx';

export default function GamesScreen() {
  const params = useLocalSearchParams<{ tripId?: string; mode?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const trip = useGameTrip(params.tripId);
  const [mode, setMode] = useState(() => modeParam(params.mode));
  const go = (pathname: '/games/bingo' | '/games/spy' | '/games/questions' | '/games/scores') =>
    router.push({ pathname, params: { mode, ...(trip ? { tripId: trip.id } : {}) } });

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="trips" illustration="route" compact title={t('games.title')} subtitle={t('games.intro')} />
      </FadeInView>
      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('games.mode.label')}</Label>
        </View>
        <ModePicker mode={mode} onChange={setMode} />
      </View>
      <View style={{ gap: space.m }}>
        <FadeInView delay={40}>
          <GameRow icon="grid-outline" title={t('games.bingo.title')} body={t('games.bingo.body')} hint={t('games.openHint')} onPress={() => go('/games/bingo')} />
        </FadeInView>
        <FadeInView delay={80}>
          <GameRow icon="eye-outline" title={t('games.spy.title')} body={t('games.spy.body')} hint={t('games.openHint')} onPress={() => go('/games/spy')} />
        </FadeInView>
        <FadeInView delay={120}>
          <GameRow icon="chatbubbles-outline" title={t('games.questions.title')} body={t('games.questions.body')} hint={t('games.openHint')} onPress={() => go('/games/questions')} />
        </FadeInView>
        <FadeInView delay={160}>
          <GameRow icon="trophy-outline" title={t('games.scores.title')} body={t('games.scores.body')} hint={t('games.openHint')} onPress={() => go('/games/scores')} />
        </FadeInView>
      </View>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('games.privacy')}</Text>
    </Screen>
  );
}
