// First-launch welcome on the Trips home (FLOWS §1.1). A card at the top of the list, never a blocking screen;
// shown until the traveller picks one of its two ways in, and remembered on this phone after that.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../../state/app.tsx';
import { usePersisted } from '../../state/persisted.ts';
import { useTrips } from '../../state/trips.tsx';
import { fonts, space } from '../../theme/tokens.ts';
import { Body, Button, Card } from '../kit.tsx';

export const WELCOME_KEY = 'satchel.welcome.done.v1';
const NOT_DONE = false;

export function WelcomeSlot() {
  const { t, theme } = useApp();
  const { trips, addDemo } = useTrips();
  const router = useRouter();
  const [done, setDone, loaded] = usePersisted<boolean>(WELCOME_KEY, NOT_DONE);
  if (!loaded || done) return null;

  const tryDemo = () => {
    setDone(true);
    if (!trips.some((x) => x.id === 'demo')) addDemo();
    router.push('/trip/demo');
  };
  const ownTrip = () => {
    setDone(true);
    router.push('/trip-edit');
  };

  return (
    <Card style={{ gap: space.m }}>
      <View accessible accessibilityRole="header">
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: theme.ink }}>{t('spec.welcome.title')}</Text>
      </View>
      <Body>{t('spec.welcome.body')}</Body>
      <Button label={t('spec.welcome.demo')} hint={t('spec.welcome.demoHint')} onPress={tryDemo} />
      <Button label={t('spec.welcome.own')} hint={t('spec.welcome.ownHint')} kind="quiet" onPress={ownTrip} />
      <Body muted>{t('spec.welcome.privacy')}</Body>
    </Card>
  );
}
