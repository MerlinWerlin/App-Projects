// T125 Travel games: shared pieces for the game screens (app/games/*) and their entries: the Trips tab card, the
// Your day row and the In-flight button. Content from src/content/games.json; logic in src/core/games.ts.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import data from '../content/games.json';
import { deviceZone, todayIn } from '../core/format.ts';
import { GAME_MODES, isGameMode, modeForKind, type DeckId, type GameMode, type GamesContent } from '../core/games.ts';
import { focusTrip } from '../core/glance.ts';
import type { ItemKind, Trip } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { useTrips } from '../state/trips.tsx';
import { fonts, radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge, type IconName } from './hero.tsx';
import { Chip, PressableScale } from './kit.tsx';

export const GAMES = data as GamesContent;

export const MODE_KEY: Record<GameMode, Key> = { air: 'games.mode.air', train: 'games.mode.train', road: 'games.mode.road', city: 'games.mode.city' };
export const MODE_ICON: Record<GameMode, IconName> = { air: 'airplane-outline', train: 'train-outline', road: 'car-outline', city: 'walk-outline' };
export const DECK_KEY: Record<DeckId, Key> = { rather: 'games.deck.rather', tell: 'games.deck.tell', memory: 'games.deck.memory' };

/** The mode from a route param, else `fallback`. */
export const modeParam = (x: unknown, fallback: GameMode = 'city'): GameMode => (isGameMode(x) ? x : fallback);

/** The trip a game screen works with: the one named in the route, else the trip on now or next. */
export function useGameTrip(tripId: string | undefined): Trip | null {
  const { trips } = useTrips();
  if (tripId) {
    const named = trips.find((x) => x.id === tripId);
    if (named) return named;
  }
  return focusTrip(trips, todayIn(deviceZone()));
}

/** Plane / train / road / city chips (radio group). */
export function ModePicker({ mode, onChange }: { mode: GameMode; onChange: (m: GameMode) => void }) {
  const { t, theme } = useApp();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('games.mode.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      {GAME_MODES.map((m) => (
        <Chip
          key={m}
          label={t(MODE_KEY[m])}
          selected={m === mode}
          hint={t('games.mode.hint')}
          onPress={() => onChange(m)}
          icon={
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={MODE_ICON[m]} size={16} color={m === mode ? theme.accentInk : theme.ink} />
            </View>
          }
        />
      ))}
    </View>
  );
}

/** One tappable row: icon badge, title, body, chevron. */
export function GameRow({ icon, title, body, hint, onPress }: { icon: IconName; title: string; body: string; hint: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`${body} ${hint}`}
      onPress={onPress}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderRadius: radius.l,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.line,
        backgroundColor: theme.cardRaised,
        ...shadowOf(theme, 'low'),
      }}
    >
      <IconBadge name={icon} tone="accent" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{title}</Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {body}
        </Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </View>
    </PressableScale>
  );
}

/** Trips tab entry: opens the games for the trip on now or next (mode from its next booking). */
export function GamesEntryCard({ trips }: { trips: Trip[] }) {
  const { t } = useApp();
  const router = useRouter();
  const trip = focusTrip(trips, todayIn(deviceZone()));
  const params: Record<string, string> = trip ? { tripId: trip.id } : {};
  return (
    <GameRow
      icon="game-controller-outline"
      title={t('games.entry')}
      body={t('games.entryBody')}
      hint={t('games.entryHint')}
      onPress={() => router.push({ pathname: '/games', params })}
    />
  );
}

/** Your day row ("Games for the wait"), mode from the next booking's kind. */
export function GamesBriefRow({ trip, kind }: { trip: Trip; kind: ItemKind | undefined }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const mode = modeForKind(kind);
  const line = t('games.brief', { mode: t(MODE_KEY[mode]) });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={line}
        accessibilityHint={t('games.briefHint')}
        onPress={() => router.push({ pathname: '/games', params: { tripId: trip.id, mode } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="game-controller-outline" size={18} color={theme.heroAccent} />
        </View>
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
          {line}
        </Text>
      </PressableScale>
    </>
  );
}
