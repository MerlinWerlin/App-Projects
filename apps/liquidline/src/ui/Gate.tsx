// Shows children when the trial or the unlock is active; otherwise a calm card that opens the paywall.
// PT lookup, the converter, refrigerant facts and saved jobs never sit behind this.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useAccess } from '../state/access.ts';
import { Body, Button, Card, Heading } from './kit.tsx';

export function Gate({ children, what }: { children: ReactNode; what: string }) {
  const a = useAccess();
  if (a.canCalc) return <>{children}</>;
  return (
    <Card>
      <Heading>{a.state === 'expired' ? 'Your free week has ended' : 'Free for 7 days'}</Heading>
      <Body>{a.state === 'expired' ? `Unlock Liquidline once to keep using ${what}. PT lookups, the converter, refrigerant facts and your saved jobs stay free.` : `Start the 7-day free trial to use ${what} and every other tool. Nothing is charged and nothing renews.`}</Body>
      <Button testID="gate-open-paywall" title={a.state === 'expired' ? 'See Full Unlock' : 'Start free trial'} onPress={() => router.push('/paywall')} />
    </Card>
  );
}
