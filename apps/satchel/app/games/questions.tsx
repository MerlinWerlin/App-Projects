// T125 Question deck: family-friendly "would you rather", "tell me about" and trip memory prompts, one card at a
// time, never repeating until the whole deck has been through (src/core/games.ts drawCard). A memory answer can be
// saved as a page in the trip journal (today's day on the trip). Cards change with a short timed fade (instant with
// Reduce Motion). Which cards were seen stays on this phone (src/state/games.ts).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';
import { DECKS, drawCard, isDeckId, memoryNote, type DeckId } from '../../src/core/games.ts';
import { defaultJournalDay, entryFromDraft, newJournalDraft, upsertEntry } from '../../src/core/journal.ts';
import { newId } from '../../src/core/model.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveGames, useGames } from '../../src/state/games.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fadeIn, fadeOut } from '../../src/theme/motion.ts';
import { elevated, radius, space, typeScale } from '../../src/theme/tokens.ts';
import { DECK_KEY, GAMES, useGameTrip } from '../../src/ui/games.tsx';
import { Body, Button, Chip, Screen, TextField } from '../../src/ui/kit.tsx';

export default function QuestionsScreen() {
  const params = useLocalSearchParams<{ tripId?: string; deck?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const { saveTrip } = useTrips();
  const trip = useGameTrip(params.tripId);
  const [state, loaded] = useGames();
  const [deck, setDeck] = useState<DeckId>(() => (isDeckId(params.deck) ? params.deck : 'rather'));
  const [answer, setAnswer] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const fade = useRef(new Animated.Value(1)).current;

  const cards = GAMES.decks[deck];
  const seen = state.seen[deck] ?? [];
  const currentId = seen[seen.length - 1];
  const current = cards.find((c) => c.id === currentId);

  const draw = () =>
    saveGames((g) => {
      const d = drawCard(GAMES.decks[deck], g.seen[deck] ?? [], g.deckSeed);
      return d ? { ...g, deckSeed: d.seed, seen: { ...g.seen, [deck]: d.seen } } : g;
    });

  // First visit to a deck: deal its first card.
  useEffect(() => {
    if (loaded && !current) draw();
  }, [loaded, deck, current]);

  useEffect(() => {
    setAnswer('');
    setSaved('idle');
  }, [currentId]);

  const next = () => {
    fadeOut(fade, reduceMotion).start(() => {
      draw();
      fadeIn(fade, reduceMotion).start();
    });
  };

  const save = async () => {
    if (!trip || !current) return;
    const note = memoryNote(current.text, answer);
    if (!note) return;
    setSaved('saving');
    const entry = entryFromDraft({ ...newJournalDraft(defaultJournalDay(trip)), note }, newId);
    const ok = await saveTrip(upsertEntry(trip, entry));
    setSaved(ok ? 'saved' : 'failed');
    AccessibilityInfo.announceForAccessibility(ok ? t('games.questions.saved', { trip: trip.name }) : t('games.questions.saveFailed'));
  };

  const memory = deck === 'memory';
  return (
    <Screen>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('games.questions.deckLabel')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {DECKS.map((d) => (
          <Chip key={d} label={t(DECK_KEY[d])} selected={d === deck} hint={t('games.questions.deckHint')} onPress={() => setDeck(d)} />
        ))}
      </View>

      <Animated.View style={{ opacity: fade }}>
        <View
          accessible
          accessibilityLabel={current ? current.text : t('games.questions.empty')}
          style={[{ borderRadius: radius.xl, padding: space.xl, minHeight: 180, justifyContent: 'center', gap: space.m }, elevated(theme, 'mid')]}
        >
          <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t(DECK_KEY[deck])}</Text>
          <Text style={[typeScale.displayM, { color: theme.ink }]}>{current ? current.text : t('games.questions.empty')}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('games.questions.count', { n: seen.length, total: cards.length })}</Text>
        </View>
      </Animated.View>

      <Button label={t('games.questions.next')} hint={t('games.questions.nextHint')} icon="arrow-forward-outline" onPress={next} />

      {memory && trip ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('games.questions.answer')} placeholder={t('games.questions.answerPlaceholder')} value={answer} onChange={setAnswer} multiline />
          {saved === 'saved' ? (
            <>
              <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: theme.ok }]}>
                {t('games.questions.saved', { trip: trip.name })}
              </Text>
              <Button
                label={t('games.questions.openJournal')}
                hint={t('games.questions.openJournalHint')}
                kind="quiet"
                icon="book-outline"
                onPress={() => router.push({ pathname: '/journal/[tripId]', params: { tripId: trip.id } })}
              />
            </>
          ) : (
            <Button
              label={t('games.questions.save')}
              hint={t('games.questions.saveHint', { trip: trip.name })}
              kind="secondary"
              icon="book-outline"
              onPress={() => {
                if (saved !== 'saving' && answer.trim()) save();
              }}
            />
          )}
          {saved === 'failed' ? <Body muted>{t('games.questions.saveFailed')}</Body> : null}
          {!answer.trim() && saved === 'idle' ? <Body muted>{t('games.questions.saveNeedsText')}</Body> : null}
        </View>
      ) : null}
      {memory && !trip ? <Body muted>{t('games.questions.noTrip')}</Body> : null}
      <Body muted>{t('games.questions.tip')}</Body>
    </Screen>
  );
}
