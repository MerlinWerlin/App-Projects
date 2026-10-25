// Low-battery banner on the Trips home (T07). Offers essentials mode when the battery is at or below the threshold
// and not charging, with "Open essentials" / "Not now". "Not now" lasts for this low episode (until the battery
// recovers or the phone is plugged in) and this session. With the manual switch on it reminds and offers Turn off.
// Never navigates by itself; nothing shows when the battery level can't be read.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { bannerState, DEFAULT_ESSENTIALS, dismissEpisode, ESSENTIALS_KEY, NO_EPISODE, normalisePrefs, stepEpisode, type EssentialsPrefs, type Episode } from '../../core/battery.ts';
import { useBattery } from '../../native/battery.ts';
import { useApp } from '../../state/app.tsx';
import { usePersisted } from '../../state/persisted.ts';
import { fonts, space } from '../../theme/tokens.ts';
import { Body, Button, Card } from '../kit.tsx';

// Session memory: survives the banner unmounting (tab switches), reset when the app restarts.
let episode: Episode = NO_EPISODE;

export function BatteryBannerSlot() {
  const { t, theme } = useApp();
  const router = useRouter();
  const reading = useBattery();
  const [stored, setStored] = usePersisted<EssentialsPrefs>(ESSENTIALS_KEY, DEFAULT_ESSENTIALS);
  const prefs = normalisePrefs(stored);
  const [ep, setEp] = useState<Episode>(episode);

  useEffect(() => {
    episode = stepEpisode(episode, reading, prefs.threshold);
    setEp(episode);
  }, [reading, prefs.threshold]);

  const state = bannerState(prefs, ep, reading);
  if (state.kind === 'none') return null;

  const open = () => router.push('/essentials');
  const title = state.kind === 'offer' ? t('battery.lowTitle', { percent: state.percent }) : t('battery.manualTitle');
  const body = state.kind === 'offer' ? t('battery.lowBody') : t('battery.manualBody');

  return (
    <Card style={{ borderColor: theme.warn }}>
      <View accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${body}`} style={{ gap: space.xs }}>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>{title}</Text>
        <Body muted>{body}</Body>
      </View>
      <Button label={t('battery.open')} hint={t('battery.openHint')} onPress={open} />
      {state.kind === 'offer' ? (
        <Button
          kind="quiet"
          label={t('battery.notNow')}
          hint={t('battery.notNowHint')}
          onPress={() => {
            episode = dismissEpisode(episode);
            setEp(episode);
          }}
        />
      ) : (
        <Button kind="quiet" label={t('battery.turnOff')} hint={t('battery.turnOffHint')} onPress={() => setStored((old) => ({ ...normalisePrefs(old), manual: false }))} />
      )}
    </Card>
  );
}
