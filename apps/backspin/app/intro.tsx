// First-launch how-to: three cards, then a plain-words microphone screen before iOS asks.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { micPermission, requestMic } from '../src/native/audio.ts';
import { openSettings } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, Disc, Icon, Screen, T } from '../src/ui/kit.tsx';
import { SP } from '../src/ui/theme.ts';

export default function Intro() {
  const { t, theme, setPref } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [denied, setDenied] = useState(false);
  const cards = [
    { k: 'intro.1', spin: 1 as const },
    { k: 'intro.2', spin: -1 as const },
    { k: 'intro.3', spin: 1 as const },
  ];
  const done = () => {
    setPref('introSeen', true);
    router.back();
  };
  const askMic = async () => {
    const now = await micPermission();
    if (now === 'granted') return done();
    const r = await requestMic();
    if (r === 'granted') done();
    else setDenied(true);
  };

  if (i >= cards.length) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* The app's own record button, so the permission screen shows the thing it is asking for. */}
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: theme.rec, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={44} color={theme.recInk} stroke={2.4} />
          </View>
          <T kind="hero" center style={{ marginTop: SP(8) }}>
            {t('mic.title')}
          </T>
          <T color={theme.sub} center style={{ marginTop: SP(3) }}>
            {denied ? t('mic.denied') : t('mic.body')}
          </T>
          <Button title={denied ? t('mic.openSettings') : t('mic.allow')} style={{ marginTop: SP(8) }} onPress={denied ? openSettings : askMic} />
          <Button kind="ghost" small title={t('intro.skip')} style={{ marginTop: SP(3) }} onPress={done} />
        </View>
      </Screen>
    );
  }
  const c = cards[i];
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Disc size={200} spin={c.spin} />
        <T kind="hero" center style={{ marginTop: SP(10) }}>
          {t(`${c.k}.title` as 'intro.1.title')}
        </T>
        <T color={theme.sub} center style={{ marginTop: SP(3), fontSize: 18, lineHeight: 26 }}>
          {t(`${c.k}.body` as 'intro.1.body')}
        </T>
        {/* Page dots under the copy, where iOS puts them (not a counter above the title). */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: SP(2), marginTop: SP(8) }} accessible accessibilityLabel={`${i + 1} / 3`}>
          {cards.map((_, k) => (
            <View key={k} style={{ width: k === i ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? theme.ink : theme.line }} />
          ))}
        </View>
      </View>
      <Button title={i === 2 ? t('intro.start') : t('intro.next')} onPress={() => setI(i + 1)} />
      <Button kind="ghost" small title={t('intro.skip')} style={{ marginTop: SP(3) }} onPress={() => setI(cards.length)} />
    </Screen>
  );
}
