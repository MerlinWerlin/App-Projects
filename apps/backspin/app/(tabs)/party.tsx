import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { MAX_FREE_PLAYERS, MAX_PLAYERS, newParty, type PartyMode } from '../../src/core/game.ts';
import { useApp } from '../../src/state/app.tsx';
import { partyStore } from '../../src/state/party.ts';
import { Button, Card, Chip, Press, Screen, SectionTitle, T, Toastish } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

export default function PartySetup() {
  const { t, theme, plus } = useApp();
  const router = useRouter();
  const [names, setNames] = useState<string[]>(partyStore.names());
  const [mode, setMode] = useState<PartyMode>('copy');
  const [rounds, setRounds] = useState(3);
  const [msg, setMsg] = useState<string | null>(null);
  const max = plus ? MAX_PLAYERS : MAX_FREE_PLAYERS;

  const update = (i: number, v: string) => setNames((n) => n.map((x, k) => (k === i ? v : x)));
  const start = () => {
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
          <Card key={m} hi={mode === m} label={t(m === 'copy' ? 'party.copy' : 'party.guess')} onPress={() => setMode(m)} style={{ flex: 1, borderColor: mode === m ? theme.rec : theme.line, borderWidth: 2 }}>
            <T style={{ fontSize: 26 }}>{m === 'copy' ? '🎙' : '🕵️'}</T>
            <T kind="bodyB" style={{ marginTop: SP(2) }}>
              {t(m === 'copy' ? 'party.copy' : 'party.guess')}
            </T>
            <T kind="small" color={theme.sub}>
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
              placeholderTextColor={theme.faint}
              accessibilityLabel={t('party.playerN', { n: i + 1 })}
              maxLength={18}
              returnKeyType="done"
              style={{ flex: 1, minHeight: 50, borderRadius: R.m, backgroundColor: theme.card, color: theme.ink, paddingHorizontal: SP(4), fontSize: 17, fontWeight: '600' }}
            />
            {names.length > 2 ? (
              <Press label={`${t('takes.delete')} ${i + 1}`} onPress={() => setNames((x) => x.filter((_, k) => k !== i))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T color={theme.faint}>✕</T>
              </Press>
            ) : null}
          </View>
        ))}
      </View>
      {names.length < max ? (
        <Button kind="ghost" small icon="＋" title={t('party.addPlayer')} style={{ marginTop: SP(3), alignSelf: 'flex-start' }} onPress={() => setNames((x) => [...x, ''])} />
      ) : !plus ? (
        <Press label={t('party.morePlus')} onPress={() => router.push('/plus')}>
          <T kind="small" color={theme.gold} style={{ marginTop: SP(3), fontWeight: '700' }}>
            🔒 {t('party.morePlus')}
          </T>
        </Press>
      ) : null}

      <SectionTitle>{t('party.rounds')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: SP(2) }}>
        {[1, 2, 3, 5].map((r) => (
          <Chip key={r} label={String(r)} on={rounds === r} onPress={() => setRounds(r)} />
        ))}
      </View>

      <Button title={t('party.start')} icon="🎉" style={{ marginTop: SP(8) }} onPress={start} />
      <Toastish text={msg} />
    </Screen>
  );
}
