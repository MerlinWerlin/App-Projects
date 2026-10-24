import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { LANG_NAMES, SUPPORTED, type Lang } from '../src/i18n/core.ts';
import { openMail } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, Card, Chip, Divider, Screen, SectionTitle, T, Toastish, ToggleRow } from '../src/ui/kit.tsx';
import { SP } from '../src/ui/theme.ts';

export default function Settings() {
  const { t, theme, prefs, setPref, owned: plus, restorePlus, stats, lang } = useApp();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <Screen>
      <Card>
        <ToggleRow title={t('settings.haptics')} sub={t('settings.hapticsSub')} value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
        <Divider />
        <ToggleRow title={t('settings.holdToRecord')} sub={t('settings.holdToRecordSub')} value={prefs.holdToRecord} onChange={(v) => setPref('holdToRecord', v)} />
        <Divider />
        {!prefs.holdToRecord ? (
          <>
            <ToggleRow title={t('settings.countdown')} value={prefs.countdown} onChange={(v) => setPref('countdown', v)} />
            <Divider />
          </>
        ) : null}
        <ToggleRow title={t('settings.autoplay')} value={prefs.autoplay} onChange={(v) => setPref('autoplay', v)} />
        <Divider />
        <ToggleRow title={t('settings.motion')} sub={t('settings.motionSub')} value={prefs.calm} onChange={(v) => setPref('calm', v)} />
      </Card>

      <SectionTitle>{t('settings.theme')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: SP(2) }}>
        {(['system', 'light', 'dark'] as const).map((m) => (
          <Chip key={m} label={t(m === 'system' ? 'settings.themeSystem' : m === 'light' ? 'settings.themeLight' : 'settings.themeDark')} on={prefs.theme === m} onPress={() => setPref('theme', m)} />
        ))}
      </View>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: SP(2), flexWrap: 'wrap' }}>
        <Chip label={`${t('settings.languageSystem')} (${LANG_NAMES[lang]})`} on={prefs.lang === 'system'} onPress={() => setPref('lang', 'system')} />
        {SUPPORTED.map((l: Lang) => (
          <Chip key={l} label={LANG_NAMES[l]} on={prefs.lang === l} onPress={() => setPref('lang', l)} />
        ))}
      </View>

      <SectionTitle>{t('settings.plus')}</SectionTitle>
      <Card>
        <T kind="bodyB">{plus ? `✓ ${t('plus.owned')}` : t('plus.headline')}</T>
        {!plus ? <Button title={t('plus.buyNoPrice')} style={{ marginTop: SP(3) }} onPress={() => router.push('/plus')} /> : null}
        <Button
          kind="ghost"
          small
          title={t('settings.restore')}
          style={{ marginTop: SP(3) }}
          onPress={async () => setMsg((await restorePlus()) ? t('settings.restored') : t('settings.nothingToRestore'))}
        />
        <Toastish text={msg} />
      </Card>

      <View style={{ gap: SP(3), marginTop: SP(6) }}>
        <Button kind="quiet" icon="✉️" title={t('settings.feedback')} onPress={() => openMail(t('feedback.subject'), `\n\n—\nBackspin ${version} · ${Platform.OS} ${Platform.Version} · ${stats.rounds} rounds`)} />
        <Button kind="quiet" icon="❓" title={t('settings.replayIntro')} onPress={() => router.push('/intro')} />
      </View>
      <T kind="small" color={theme.sub} style={{ marginTop: SP(6) }}>
        {t('settings.privacy')}
      </T>
      <T kind="small" color={theme.faint} style={{ marginTop: SP(2) }}>
        {t('settings.version', { v: version })}
      </T>
    </Screen>
  );
}
