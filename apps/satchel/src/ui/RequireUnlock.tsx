// 1.0.0: wraps every create / edit screen (trips, plans, itinerary import, paste a booking, adding a file to a
// trip). During the trial or once unlocked, or in a build without the store module, it renders the screen as is.
// Before the trial starts or after it ends it shows the paywall instead, with a way back; nothing saved is touched.
// Viewing trips and opening a received .satchel trip file are never wrapped (src/core/access.ts ALWAYS_ALLOWED).
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useAccess } from '../state/access.ts';
import { useApp } from '../state/app.tsx';
import { Button, Screen } from './kit.tsx';
import { Paywall } from './Paywall.tsx';

export function RequireUnlock({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const router = useRouter();
  const a = useAccess();
  if (!a.loaded || a.canEdit) return <>{children}</>;
  return (
    <Screen>
      <Paywall title={a.state === 'new' ? t('access.newTitle') : t('access.lockedTitle')} />
      <Button label={t('access.back')} hint={t('access.backHint')} kind="quiet" icon="arrow-back-outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

/** For share buttons: true when sharing may go ahead, otherwise opens the paywall and returns false. */
export function useShareGate(): () => boolean {
  const router = useRouter();
  const a = useAccess();
  return () => {
    if (!a.loaded || a.canShare) return true;
    router.push('/paywall');
    return false;
  };
}
