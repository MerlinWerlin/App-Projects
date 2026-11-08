// T147 postcards: the trip screen card, the Coming home row ("3 of 5 sent") and the shared text helpers. Logic in
// src/core/postcards.ts; the list lives on this phone only (src/state/postcards.ts). Motion is the timed FadeInView
// only (Reduce Motion respected there); colours from theme tokens.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { formatDay } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { sentCount, type Prompt, type Sent } from '../core/postcards.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { usePostcards } from '../state/postcards.ts';
import { elevated, radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, ProgressBar } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { StampMark } from './postcardArt.tsx';

/** One "what to write" prompt in words. */
export function promptText(t: T, p: Prompt): string {
  switch (p.kind) {
    case 'note':
      return t('postcards.prompt.note', { text: p.text });
    case 'place':
      return t('postcards.prompt.place', { name: p.name });
    case 'went':
      return t('postcards.prompt.went', { name: p.name });
    case 'plan':
      return t('postcards.prompt.plan', { name: p.name });
    case 'mood':
      return t(`postcards.prompt.mood.${p.mood}`);
    case 'weather':
      return t(`postcards.prompt.weather.${p.weather}`);
    case 'generic':
      return t(`postcards.prompt.generic.${p.id}`);
  }
}

/** "Sent Tue 3 Nov from Kyoto" (or without a place). */
export function sentLine(t: T, s: Sent, lang: string): string {
  const date = formatDay(s.date, lang);
  return s.place ? t('postcards.sent.from', { date, place: s.place }) : t('postcards.sent.on', { date });
}

/** "3 of 5 sent" / "No one on the list yet". */
export function countLine(t: T, c: { sent: number; total: number }): string {
  if (!c.total) return t('postcards.card.sub');
  return c.sent === c.total ? t('postcards.count.all', { n: c.total }) : t('postcards.count', { n: c.sent, total: c.total });
}

const openList = (router: ReturnType<typeof useRouter>, tripId: string) => router.push({ pathname: '/postcards/[tripId]', params: { tripId } });

/** Trip screen: the postcards card with how many are sent. */
export const PostcardsTripCard = memo(function PostcardsTripCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [book] = usePostcards(trip.id);
  const c = sentCount(book);
  const line = countLine(t, c);
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('postcards.card.title'), line].join('. ')}
        accessibilityHint={t('postcards.card.hint')}
        onPress={() => openList(router, trip.id)}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.s }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 44, height: 52, borderRadius: radius.m, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <StampMark sent={c.total > 0 && c.sent === c.total} size={34} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.title, { color: theme.ink }]}>{t('postcards.card.title')}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{line}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </View>
        </View>
        {c.total ? <ProgressBar progress={c.sent / c.total} tone="accent" label={line} /> : null}
      </PressableScale>
    </FadeInView>
  );
});

/** Coming home list: "Postcards · 3 of 5 sent" (only once someone is on the list). */
export function PostcardsComeHomeRow({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [book] = usePostcards(trip.id);
  const c = sentCount(book);
  if (!c.total) return null;
  const line = countLine(t, c);
  const left = c.total - c.sent;
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('postcards.come.a11y', { line })}
        accessibilityHint={t('postcards.come.hint')}
        onPress={() => openList(router, trip.id)}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, paddingHorizontal: space.l, paddingVertical: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m }]}
      >
        <StampMark sent={left === 0} size={30} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('postcards.come.title')}</Text>
          <Text style={[typeScale.small, { color: left ? theme.accentInk : theme.muted }]}>{left ? t('postcards.come.left', { line }) : line}</Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}
