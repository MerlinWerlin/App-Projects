// T103 Passport stamps entry points: the Passport card on Your travels (latest stamps + Open passport) and the stamps
// section of a trip recap (the trip's places as their lifetime stamps, "First stamp" on the ones earned on this trip).
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { recapToday } from '../core/followups91.ts';
import type { Trip } from '../core/model.ts';
import { stampsForTrip } from '../core/stamps.ts';
import { useApp } from '../state/app.tsx';
import { SectionCard } from './hero.tsx';
import { Body } from './kit.tsx';
import { PaperPage, Stamp, usePassport } from './Stamp.tsx';
import { countryName } from './useTravelStats.ts';

const PREVIEW = 4;

export function PassportCard() {
  const { t } = useApp();
  const router = useRouter();
  const { collection } = usePassport();
  if (!collection.stamps.length) return null;
  return (
    <SectionCard
      icon="ribbon-outline"
      tone="accent"
      title={t('stamps.card.title')}
      subtitle={`${t('stamps.card.count', { n: collection.counts.stamps })} · ${t('stamps.card.subtitle')}`}
      action={{ label: t('stamps.card.open'), hint: t('stamps.card.openHint'), onPress: () => router.push('/passport') }}
    >
      <PaperPage>
        {collection.stamps.slice(0, PREVIEW).map((s, i) => (
          <Stamp key={s.key} stamp={s} size={116} delay={i * 60} onPress={() => router.push(`/recap/${s.tripId}`)} />
        ))}
      </PaperPage>
    </SectionCard>
  );
}

export function RecapStamps({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const router = useRouter();
  const { collection, today } = usePassport();
  const day = recapToday(trip, today);
  const r = useMemo(() => stampsForTrip(collection, trip, day, { countryName }), [collection, trip, day]);
  const action = { label: t('stamps.recap.open'), hint: t('stamps.recap.openHint'), onPress: () => router.push('/passport') };
  return (
    <SectionCard icon="ribbon-outline" tone="accent" title={t('stamps.recap.title')} subtitle={r.stamps.length ? t('stamps.recap.subtitle') : undefined} action={action}>
      {r.stamps.length ? (
        <PaperPage>
          {r.stamps.map((s, i) => (
            <Stamp key={s.key} stamp={s} size={116} first={r.firsts.has(s.key)} delay={i * 50} onPress={s.tripId !== trip.id ? () => router.push(`/recap/${s.tripId}`) : undefined} />
          ))}
        </PaperPage>
      ) : (
        <Body muted>{t('stamps.recap.none')}</Body>
      )}
    </SectionCard>
  );
}
