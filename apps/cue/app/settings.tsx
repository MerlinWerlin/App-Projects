import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_MAX, FONT_MIN, type PrompterColors } from '../src/core/prefs';
import { t } from '../src/i18n';
import { useApp } from '../src/state/AppState';
import { Row, Section, Segmented, Stepper, SwitchRow } from '../src/ui/kit';

export default function Settings() {
  const app = useApp();
  const { prefs, setPrefs, theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorsLocked = !app.can('colors');
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <Section title={t('settings.plus')}>
        <Row label={app.tier === 'plus' ? `${t('settings.plus')} ✓` : t('settings.plus')} onPress={() => router.push('/plus')} />
        <Row
          label={t('settings.restore')}
          last
          onPress={async () => {
            const r = await app.restorePlus();
            Alert.alert(r.ok ? t('plus.thanks') : r.message);
          }}
        />
      </Section>

      <Section title={t('settings.prompter')}>
        <Stepper label={t('settings.fontSize')} value={String(prefs.fontSize)} onMinus={() => setPrefs({ fontSize: Math.max(FONT_MIN, prefs.fontSize - 2) })} onPlus={() => setPrefs({ fontSize: Math.min(FONT_MAX, prefs.fontSize + 2) })} />
        <Stepper label={t('settings.lineHeight')} value={prefs.lineHeight.toFixed(2)} onMinus={() => setPrefs({ lineHeight: Math.max(1.1, +(prefs.lineHeight - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ lineHeight: Math.min(2, +(prefs.lineHeight + 0.05).toFixed(2)) })} />
        <Stepper label={t('settings.margin')} value={String(prefs.margin)} onMinus={() => setPrefs({ margin: Math.max(8, prefs.margin - 8) })} onPlus={() => setPrefs({ margin: Math.min(120, prefs.margin + 8) })} />
        <Stepper label={t('settings.readingLine')} value={`${Math.round(prefs.readingLine * 100)}%`} onMinus={() => setPrefs({ readingLine: Math.max(0.15, +(prefs.readingLine - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ readingLine: Math.min(0.6, +(prefs.readingLine + 0.05).toFixed(2)) })} />
        <Stepper label={t('settings.countdown')} value={prefs.countdown ? t('settings.seconds', { n: prefs.countdown }) : t('settings.countdownOff')} onMinus={() => setPrefs({ countdown: Math.max(0, prefs.countdown - 1) })} onPlus={() => setPrefs({ countdown: Math.min(10, prefs.countdown + 1) })} />
        <SwitchRow label={t('settings.align')} value={prefs.align === 'center'} onChange={(v) => setPrefs({ align: v ? 'center' : 'left' })} />
        <SwitchRow label={t('settings.bold')} value={prefs.bold} onChange={(bold) => setPrefs({ bold })} />
        <SwitchRow label={t('settings.highlightLine')} value={prefs.highlightLine} onChange={(highlightLine) => setPrefs({ highlightLine })} />
        <SwitchRow label={t('settings.showNotes')} value={prefs.showNotes} onChange={(showNotes) => setPrefs({ showNotes })} />
        <SwitchRow label={t('prompt.mirror')} value={prefs.mirrorH} onChange={(mirrorH) => setPrefs({ mirrorH })} />
        <SwitchRow label={t('settings.showTimer')} value={prefs.showTimer} onChange={(showTimer) => setPrefs({ showTimer })} last />
      </Section>

      <Section title={t('settings.colors')}>
        <Row
          label={t('settings.colors')}
          badge={colorsLocked ? t('common.plus') : undefined}
          last
          right={
            <Segmented<PrompterColors>
              label={t('settings.colors')}
              value={colorsLocked ? 'classic' : prefs.colors}
              onChange={(colors) => (colorsLocked && colors !== 'classic' ? router.push('/plus') : setPrefs({ colors }))}
              options={(['classic', 'paper', 'night', 'contrast'] as const).map((c) => ({ value: c, label: t(`settings.colors.${c}`).split(' ')[0]!, locked: colorsLocked && c !== 'classic' }))}
            />
          }
        />
      </Section>

      <Section title={t('settings.appearance')}>
        <Row
          label={t('settings.theme')}
          last
          right={
            <Segmented
              label={t('settings.theme')}
              value={prefs.theme}
              onChange={(v) => setPrefs({ theme: v })}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
              ]}
            />
          }
        />
      </Section>

      <Section title={t('settings.feel')}>
        <SwitchRow label={t('settings.haptics')} value={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
        <SwitchRow label={t('settings.reduceMotion')} value={app.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v ? 'on' : 'off' })} last />
      </Section>

      <Section title={t('settings.about')}>
        <Row label={t('settings.feedback')} onPress={() => Linking.openURL('mailto:jaredbradley272+cue@gmail.com?subject=Cue%20feedback').catch(() => Alert.alert(t('error.unknown')))} />
        <Row label={t('settings.version', { v: version })} last />
      </Section>
      <Text style={{ color: theme.sub, marginHorizontal: 20, marginTop: 14, lineHeight: 20 }}>{t('settings.privacy')}</Text>
    </ScrollView>
  );
}
