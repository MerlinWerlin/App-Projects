// T14: the safety net behind app/+native-intent.tsx. If a link Satchel can't match ever reaches the router, this
// screen shows instead of the default unmatched-route page. When the link that opened the app is a shared file, it
// goes on to the Open in screen; otherwise it offers the way back to Trips.
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { incomingRedirect } from '../src/core/openin.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, EmptyState, Screen } from '../src/ui/kit.tsx';

export default function NotFoundScreen() {
  const { t } = useApp();
  const router = useRouter();
  const url = Linking.useLinkingURL();

  useEffect(() => {
    const to = incomingRedirect(url);
    if (to) router.replace(to);
  }, [url, router]);

  return (
    <Screen>
      <EmptyState
        art="magnifier"
        title={t('openin.notFound.title')}
        body={t('openin.notFound.body')}
        action={<Button label={t('openin.back')} hint={t('openin.backHint')} kind="secondary" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
