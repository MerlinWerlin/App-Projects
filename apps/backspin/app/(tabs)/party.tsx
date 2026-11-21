import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { MAX_FREE_PLAYERS, MAX_PLAYERS, newParty, type PartyMode } from '../../src/core/game.ts';
import { useApp } from '../../src/state/app.tsx';
import { partyStore } from '../../src/state/party.ts';
import { Button, Card, Chip, Icon, Press, Screen, SectionTitle, T, Toastish } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

export default function PartySetup() {
  const { t, theme, plus, owned } = useApp();
  const router = useRouter();
  const [names, setNames] = useState<string[]>(partyStore.names());
  const [mode, setMode] = useState<PartyMode>('copy');
  const [rounds, setRounds] = useState(3);
  const [msg, setMsg] = useState<string | null>(null);
  const max = plus ? MAX_PLAYERS : MAX_FREE_PLAYERS; // full 8 during the free goes

  const update = (i: number, v: string) => setNames((n) => n.map((x, k) => (k === i ? v : x)));
  const start = () => {
    if (!plus) return router.push('/plus');
    const filled = names.map((n, i) => n.trim() || t('party.playerN', { n: i + 1 }));
    if (filled.length < 2) return setMsg(t('party.needTwo'));
    partyStore.setNames(names);
    partyStore.set(newParty(filled, rounds, mode, Date.now() & 0xffffff));
    router.push('/party-play');
  };

  return (
    <Screen>
      <T kind="hero">{t('party.title')}</T>
      <T color={theme.sub} style={{ marginTop: SP(1) }}>
        {t('party.sub')}
      </T>

      <View style={{ flexDirection: 'row', gap: SP(3), marginTop: SP(5) }}>
        {(['copy', 'guess'] as const).map((m) => (
          <Card key={m} selected={mode === m} label={t(m === 'copy' ? 'party.copy' : 'party.guess')} onPress={() => setMode(m)} style={{ flex: 1 }}>
            <Icon name={m === 'copy' ? 'mic' : 'help'} size={26} color={theme.ink} />
            <T kind="h" style={{ marginTop: SP(3) }}>
              {t(m === 'copy' ? 'party.copy' : 'party.guess')}
            </T>
            <T kind="small" color={theme.sub} style={{ marginTop: SP(1) }}>
              {t(m === 'copy' ? 'party.copySub' : 'party.guessSub')}
            </T>
          </Card>
        ))}
      </View>

      <SectionTitle>{t('party.players')}</SectionTitle>
      <View style={{ gap: SP(2) }}>
        {names.map((n, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: SP(2), alignItems: 'center' }}>
            <TextInput
              value={n}
              onChangeText={(v) => update(i, v)}
              placeholder={t('party.playerN', { n: i + 1 })}
              placeholderTextColor={theme.sub}
              accessibilityLabel={t('party.playerN', { n: i + 1 })}
              maxLength={18}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="nickname"
              returnKeyType="done"
              style={{ flex: 1, minHeight: 52, borderRadius: R.m, backgroundColor: theme.card, color: theme.ink, paddingHorizontal: SP(4), fontSize: 17 }}
            />
            {names.length > 2 ? (
              <Press label={`${t('takes.delete')} ${i + 1}`} onPress={() => setNames((x) => x.filter((_, k) => k !== i))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} color={theme.sub} />
              </Press>
            ) : null}
          </View>
        ))}
      </View>
      {names.length < max ? (
        <Button kind="ghost" small icon="plus" title={t('party.addPlayer')} style={{ marginTop: SP(3), alignSelf: 'flex-start' }} onPress={() => setNames((x) => [...x, ''])} />
      ) : !owned ? (
        <Press label={t('party.morePlus')} onPress={() => router.push('/plus')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(1.5), marginTop: SP(3), minHeight: 44 }}>
            <Icon name="lock" size={15} color={theme.sub} />
            <T kind="small" color={theme.sub} style={{ fontWeight: '600' }}>
              {t('party.morePlus')}
            </T>
          </View>
        </Press>
      ) : null}

      <SectionTitle>{t('party.rounds')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: SP(2) }}>
        {[1, 2, 3, 5].map((r) => (
          <Chip key={r} label={String(r)} on={rounds === r} onPress={() => setRounds(r)} />
        ))}
      </View>

      <Button title={t('party.start')} icon="party" style={{ marginTop: SP(8) }} onPress={start} />
      <Toastish text={msg} />
    </Screen>
  );
}
