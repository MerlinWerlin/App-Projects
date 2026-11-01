// T118: "Plan this trip again" on the trip screen (a quiet button by Edit trip) and on the trip recap (a card with a
// line saying what comes along). Opens app/trip-again/[tripId].tsx.
import { useRouter } from 'expo-router';
import type { Trip } from '../core/model.ts';
import { canPlanAgain } from '../core/sampletravels.ts';
import { useApp } from '../state/app.tsx';
import { SectionCard } from './hero.tsx';
import { Button } from './kit.tsx';

export function PlanAgainButton({ trip, card }: { trip: Trip; card?: boolean }) {
  const { t } = useApp();
  const router = useRouter();
  // T165: never on a sample trip (its invented bookings would lose the Sample mark in the copy).
  if (!canPlanAgain(trip)) return null;
  const open = () => router.push({ pathname: '/trip-again/[tripId]', params: { tripId: trip.id } });
  const button = <Button label={t('tripcopy.open')} hint={t('tripcopy.openHint')} kind={card ? 'primary' : 'quiet'} icon="copy-outline" onPress={open} />;
  if (!card) return button;
  return (
    <SectionCard icon="copy-outline" tone="accent" title={t('tripcopy.recap.title')} subtitle={t('tripcopy.recap.body')}>
      {button}
    </SectionCard>
  );
}
