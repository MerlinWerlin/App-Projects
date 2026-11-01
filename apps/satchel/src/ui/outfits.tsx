// T136 outfit planner: the trip screen card, the Your day "Today's outfit" row and the shared hooks / text helpers.
// Logic in src/core/outfits.ts; the clothes come from this trip's packing list (phone store) plus own pieces on the
// trip. Motion is the timed FadeInView only (Reduce Motion respected there); colours from theme tokens.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { LocalDate, Trip } from '../core/model.ts';
import { outfitDates, plannedCount, readOutfits, todayOutfit, wardrobe, type GarmentCat, type Piece } from '../core/outfits.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, type PackStore } from '../core/packing.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { elevated, radius, space, typeScale } from '../theme/tokens.ts';
import { GarmentGlyph } from './garments.tsx';
import { FadeInView, ProgressBar } from './hero.tsx';
import { PressableScale } from './kit.tsx';

/** The trip's wardrobe: its packing list's clothes plus own pieces (re-read when either changes). */
export function usePieces(trip: Trip | null): Piece[] {
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const list = trip ? listFor(store, trip.id) : null;
  return useMemo(() => (trip ? wardrobe(readOutfits(trip), list?.items) : []), [trip, list]);
}

export const catLabel = (t: T, c: GarmentCat) => t(`outfits.cat.${c}`);

/** "Linen shirt, Shorts, Sandals" (catalogue join, so a translation can change the separator). */
export function pieceList(t: T, pieces: readonly Pick<Piece, 'label'>[]): string {
  return pieces.map((p) => p.label).reduce((a, b) => (a ? t('outfits.join', { a, b }) : b), '');
}

/** A small row of garment glyphs (decorative). */
export function GlyphRow({ pieces, size = 26, max = 6 }: { pieces: readonly Piece[]; size?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.slice(0, max).map((p) => (
        <GarmentGlyph key={p.key} cat={p.cat} size={size} />
      ))}
    </View>
  );
}

/** Trip screen: the outfit planner card with how many days are planned. */
export const OutfitsTripCard = memo(function OutfitsTripCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const pieces = usePieces(trip);
  const dates = useMemo(() => outfitDates(trip), [trip]);
  const o = useMemo(() => readOutfits(trip), [trip]);
  const planned = plannedCount(o, dates, pieces);
  const progress = t('outfits.planned', { n: planned, total: dates.length });
  const sample: Piece[] = (['top', 'bottom', 'dress', 'layer', 'shoes', 'accessory'] as const).map((cat) => ({ key: cat, label: cat, cat, source: 'own' }));
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('outfits.card.title'), planned ? progress : t('outfits.card.sub')].join('. ')}
        accessibilityHint={t('outfits.card.hint')}
        onPress={() => router.push({ pathname: '/outfits/[tripId]', params: { tripId: trip.id } })}
        style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.s }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.m, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <GarmentGlyph cat="dress" size={34} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.title, { color: theme.ink }]}>{t('outfits.card.title')}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{planned ? progress : t('outfits.card.sub')}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </View>
        </View>
        {planned && dates.length ? <ProgressBar progress={planned / dates.length} tone="accent" label={progress} /> : <GlyphRow pieces={sample} size={24} />}
      </PressableScale>
    </FadeInView>
  );
});

/** Your day: "Today's outfit: Linen shirt, Shorts, Sandals" (+ evening, laundry day) when one is planned. */
export function OutfitBriefRow({ trip, today }: { trip: Trip; today: LocalDate }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const pieces = usePieces(trip);
  const plan = useMemo(() => todayOutfit(trip, today, pieces), [trip, today, pieces]);
  if (!plan) return null;
  const lines = [
    plan.day.length ? t('outfits.brief.line', { pieces: pieceList(t, plan.day) }) : '',
    plan.evening.length ? t('outfits.brief.evening', { pieces: pieceList(t, plan.evening) }) : '',
    plan.laundry ? t('outfits.brief.laundry') : '',
  ].filter(Boolean);
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={lines.join('. ')}
        accessibilityHint={t('outfits.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/outfits/[tripId]', params: { tripId: trip.id } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
          <GarmentGlyph cat={plan.day[0]?.cat ?? plan.evening[0]?.cat ?? 'top'} size={26} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {lines.map((l, i) => (
            <Text key={l} numberOfLines={2} style={[i === 0 ? typeScale.bodyStrong : typeScale.small, { color: i === 0 ? theme.heroInk : theme.heroMuted }]}>
              {l}
            </Text>
          ))}
        </View>
      </PressableScale>
    </>
  );
}
