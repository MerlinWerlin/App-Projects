// T149 Travelling with kids, shared pieces: the original spot art (a small and a bigger figure under a sun, holding a
// kite string; drawn only from theme tokens, decorative), the trip screen card, the Your day "Kids" row and the
// kid-friendly filter chip for Places to go. Logic in src/core/kids.ts; data on this phone (src/state/kids.ts).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import { formatDuration, formatTime } from '../core/format.ts';
import { kidsBrief, type AgeBand } from '../core/kids.ts';
import type { Trip } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { useKids } from '../state/kids.ts';
import { elevated, fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { SpotFrame } from './illustrations/frame.tsx';

export const bandKey = (b: AgeBand): Key => `kids.band.${b}`;

/** Original spot art: two figures (one small) and a kite under a sun. Decorative, tokens only. */
export const KidsArt = memo(function KidsArt({ size = 120 }: { size?: number }) {
  const { theme } = useApp();
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={42} fill={theme.seaSoft} />
      <Circle cx={94} cy={20} r={8} fill={theme.accent} />
      <Rect x={18} y={84} width={84} height={4} rx={2} fill={theme.line} />
      {/* Kite and its string */}
      <Path d="M24 14 L34 24 L24 36 L14 24 Z" fill={theme.accentSoft} stroke={theme.accent} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M24 36 Q30 50 44 54" fill="none" stroke={theme.ink} strokeWidth={1.5} strokeDasharray={[3, 3]} strokeLinecap="round" />
      {/* Grown-up */}
      <Circle cx={70} cy={34} r={8} fill={theme.card} stroke={theme.ink} strokeWidth={2} />
      <Path d="M62 46 Q70 42 78 46 L80 70 L60 70 Z" fill={theme.sea} />
      <Path d="M63 70 L63 84 M77 70 L77 84" stroke={theme.ink} strokeWidth={3} strokeLinecap="round" />
      {/* Child, holding hands with the grown-up and the kite string */}
      <Circle cx={48} cy={52} r={6} fill={theme.card} stroke={theme.ink} strokeWidth={2} />
      <Path d="M42 62 Q48 59 54 62 L55 76 L41 76 Z" fill={theme.accent} />
      <Path d="M44 76 L44 84 M52 76 L52 84" stroke={theme.ink} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M54 64 Q58 62 62 54" fill="none" stroke={theme.ink} strokeWidth={2} strokeLinecap="round" />
      <Path d="M42 64 L44 54" fill="none" stroke={theme.ink} strokeWidth={2} strokeLinecap="round" />
    </SpotFrame>
  );
});

/** Trip screen: "Travelling with kids" with who is coming, opening the kids page. */
export const KidsTripCard = memo(function KidsTripCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [data, loaded] = useKids(trip.id);
  if (!loaded) return null;
  const n = data.children.length;
  const sub = n === 0 ? t('kids.card.sub') : n === 1 ? t('kids.card.one', { name: data.children[0].name }) : t('kids.card.many', { n });
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${t('kids.card.title')}. ${sub}`}
        accessibilityHint={t('kids.card.hint')}
        onPress={() => router.push({ pathname: '/kids/[tripId]', params: { tripId: trip.id } })}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }]}
      >
        <KidsArt size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.title, { color: theme.ink }]}>{t('kids.card.title')}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{sub}</Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      </PressableScale>
    </FadeInView>
  );
});

/** Your day: "Kids: Train to Kyoto at 11:00, 2h 15m" with the snack / sleep reminder. Nothing without children. */
export function KidsBriefRow({ trip, now }: { trip: Trip; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [data] = useKids(trip.id);
  const b = kidsBrief(trip, data, now);
  if (!b) return null;
  const head = t('kids.brief.line', { title: b.item.title, time: formatTime(b.item.start.local), d: formatDuration(b.minutes) });
  const tip = b.sleep ? t('kids.brief.snackSleep') : t('kids.brief.snack');
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${head}. ${tip}`}
        accessibilityHint={t('kids.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/kids/[tripId]', params: { tripId: trip.id } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="happy-outline" size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
            {head}
          </Text>
          <Text numberOfLines={2} style={[typeScale.small, { color: theme.heroMuted }]}>
            {tip}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}

/** Places to go: "Kid-friendly (n)" as a checkbox chip that narrows the list to the traveller's own marks. */
export function KidFriendlyChip({ on, count, onChange }: { on: boolean; count: number; onChange: (on: boolean) => void }) {
  const { t, theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={t('kids.ideas.filterA11y', { n: count })}
      accessibilityHint={t('kids.ideas.filterHint')}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.l,
        borderRadius: radius.pill,
        borderWidth: on ? 1.5 : 1,
        borderColor: on ? theme.accent : theme.line,
        backgroundColor: on ? theme.accentSoft : theme.cardRaised,
      }}
    >
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? theme.accentInk : theme.muted} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? theme.accentInk : theme.ink }}>{t('kids.ideas.filter', { n: count })}</Text>
    </PressableScale>
  );
}
