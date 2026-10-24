// First-launch how-to: three cards, then a plain-words microphone screen before iOS asks.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { micPermission, requestMic } from '../src/native/audio.ts';
import { openSettings } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, Disc, Screen, T } from '../src/ui/kit.tsx';
import { SP } from '../src/ui/theme.ts';

export default function Intro() {
  const { t, theme, setPref } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [denied, setDenied] = useState(false);
  const cards = [
    { k: 'intro.1', spin: 1 as const, e: '🗣' },
    { k: 'intro.2', spin: -1 as const, e: '🔄' },
    { k: 'intro.3', spin: 1 as const, e: '🎯' },
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
          <T style={{ fontSize: 64 }} center>
            🎙
          </T>
          <T kind="title" center style={{ marginTop: SP(4) }}>
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
        <T kind="small" color={theme.sub} center style={{ marginTop: SP(8) }}>
          {i + 1} / 3
        </T>
        <T kind="hero" center style={{ marginTop: SP(2) }}>
          {c.e} {t(`${c.k}.title` as 'intro.1.title')}
        </T>
        <T color={theme.sub} center style={{ marginTop: SP(3), fontSize: 18, lineHeight: 26 }}>
          {t(`${c.k}.body` as 'intro.1.body')}
        </T>
      </View>
      <Button title={i === 2 ? t('intro.start') : t('intro.next')} onPress={() => setI(i + 1)} />
      <Button kind="ghost" small title={t('intro.skip')} style={{ marginTop: SP(3) }} onPress={() => setI(cards.length)} />
    </Screen>
  );
}
