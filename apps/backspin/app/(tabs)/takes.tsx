// Saved takes: replay the four parts, share the clip, delete. Recordings live only on this phone.
import { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { buildShareClip, reverse } from '../../src/core/dsp.ts';
import { FREE_SAVES } from '../../src/core/game.ts';
import { play, stop } from '../../src/native/audio.ts';
import { shareFile } from '../../src/native/device.ts';
import { readPcm, writeScratch, writeShareFile } from '../../src/native/files.ts';
import { useApp, type Take } from '../../src/state/app.tsx';
import { Chip, Press, Screen, T, Toastish } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Takes() {
  const { t, theme, takes, owned: plus, removeTake } = useApp();
  const ins = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => () => stop(), []);

  if (!takes.length) {
    return (
      <Screen>
        <T kind="hero">{t('takes.title')}</T>
        <View style={{ alignItems: 'center', marginTop: SP(16) }}>
          <T style={{ fontSize: 56 }}>💿</T>
          <T kind="title" center style={{ marginTop: SP(4) }}>
            {t('takes.empty')}
          </T>
          <T color={theme.sub} center style={{ marginTop: SP(2), maxWidth: 300 }}>
            {t('takes.emptyBody')}
          </T>
        </View>
      </Screen>
    );
  }

  const playPart = async (tk: Take, part: 'orig' | 'rev' | 'copy' | 'flip') => {
    try {
      if (part === 'orig') return void (await play(tk.original));
      if (part === 'copy') return void (await play(tk.copy));
      const src = await readPcm(part === 'rev' ? tk.original : tk.copy);
      const r = await play(await writeScratch(reverse(src), part));
      if (!r.ok) setMsg(t('round.playError', { detail: r.detail }));
    } catch (e) {
      setMsg(t('round.playError', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };
  const share = async (tk: Take) => {
    try {
      const o = await readPcm(tk.original);
      const c = await readPcm(tk.copy);
      const uri = await writeShareFile(buildShareClip([o, reverse(o), c, reverse(c)]), `Backspin ${tk.score}`);
      const r = await shareFile(uri, 'Backspin');
      if (!r.ok) setMsg(t(r.reason === 'unavailable' ? 'share.unavailable' : 'share.error', { detail: r.detail ?? '' }));
    } catch (e) {
      setMsg(t('share.error', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };
  const del = (tk: Take) =>
    Alert.alert(t('takes.deleteConfirm'), tk.line, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('takes.delete'), style: 'destructive', onPress: () => removeTake(tk.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={takes}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: SP(5), paddingTop: ins.top + SP(3), paddingBottom: SP(12) }}
        ListHeaderComponent={
          <View style={{ marginBottom: SP(4) }}>
            <T kind="hero">{t('takes.title')}</T>
            <T kind="small" color={theme.sub}>
              {plus ? t('takes.count', { n: takes.length }) : t('takes.countFree', { n: takes.length, max: FREE_SAVES })}
            </T>
            <Toastish text={msg} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: theme.card, borderRadius: R.l, padding: SP(4), marginBottom: SP(3) }}>
            <Press label={item.line} onPress={() => setOpen(open === item.id ? null : item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(3) }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                <T kind="bodyB" color={theme.gold}>
                  {item.score}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T kind="bodyB" lines={2}>
                  {item.line}
                </T>
                <T kind="small" color={theme.faint}>
                  {new Date(item.at).toLocaleDateString()}
                </T>
              </View>
              <T color={theme.faint}>{open === item.id ? '▾' : '▸'}</T>
            </Press>
            {open === item.id ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2), marginTop: SP(3) }}>
                <Chip label={`▶︎ ${t('round.playOriginal')}`} onPress={() => playPart(item, 'orig')} />
                <Chip label={`▶︎ ${t('round.playReversed')}`} onPress={() => playPart(item, 'rev')} />
                <Chip label={`▶︎ ${t('round.playCopy')}`} onPress={() => playPart(item, 'copy')} />
                <Chip label={`▶︎ ${t('round.playFlipped')}`} onPress={() => playPart(item, 'flip')} />
                <Chip label={`⤴︎ ${t('round.share')}`} onPress={() => share(item)} />
                <Chip label={`🗑 ${t('takes.delete')}`} onPress={() => del(item)} />
              </View>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
