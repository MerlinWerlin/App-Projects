import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_MAX, FONT_MIN, type PrompterColors } from '../src/core/prefs';
import { t } from '../src/i18n';
import { trialLabel } from '../src/plus/trial';
import { useApp } from '../src/state/AppState';
import { PROMPTER, FONT } from '../src/theme/theme';
import { Row, Section, Segmented, Stepper, SwitchRow } from '../src/ui/kit';

export default function Settings() {
  const app = useApp();
  const { prefs, setPrefs, theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorsLocked = !app.can('colors');
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const trial = app.tier === 'plus' ? null : trialLabel(app.trial);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 4 }}>
      <Section title={t('settings.plus')} footer={trial ? t(trial.key, { n: trial.n }) : undefined}>
        <Row icon="sparkles-outline" label={t('settings.plus')} value={app.tier === 'plus' ? '✓' : undefined} onPress={() => router.push('/plus')} />
        <Row
          label={t('settings.restore')}
          icon="refresh-outline"
          last
          onPress={async () => {
            const r = await app.restorePlus();
            Alert.alert(r.ok ? t('plus.thanks') : r.message);
          }}
        />
      </Section>

      <Section title={t('settings.prompter')}>
        <Stepper icon="text-outline" label={t('settings.fontSize')} value={String(prefs.fontSize)} onMinus={() => setPrefs({ fontSize: Math.max(FONT_MIN, prefs.fontSize - 2) })} onPlus={() => setPrefs({ fontSize: Math.min(FONT_MAX, prefs.fontSize + 2) })} />
        <Stepper icon="reorder-four-outline" label={t('settings.lineHeight')} value={prefs.lineHeight.toFixed(2)} onMinus={() => setPrefs({ lineHeight: Math.max(1.1, +(prefs.lineHeight - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ lineHeight: Math.min(2, +(prefs.lineHeight + 0.05).toFixed(2)) })} />
        <Stepper icon="resize-outline" label={t('settings.margin')} value={String(prefs.margin)} onMinus={() => setPrefs({ margin: Math.max(8, prefs.margin - 8) })} onPlus={() => setPrefs({ margin: Math.min(120, prefs.margin + 8) })} />
        <Stepper icon="remove-outline" label={t('settings.readingLine')} value={`${Math.round(prefs.readingLine * 100)}%`} onMinus={() => setPrefs({ readingLine: Math.max(0.15, +(prefs.readingLine - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ readingLine: Math.min(0.6, +(prefs.readingLine + 0.05).toFixed(2)) })} />
        <Stepper icon="timer-outline" label={t('settings.countdown')} value={prefs.countdown ? t('settings.seconds', { n: prefs.countdown }) : t('settings.countdownOff')} onMinus={() => setPrefs({ countdown: Math.max(0, prefs.countdown - 1) })} onPlus={() => setPrefs({ countdown: Math.min(10, prefs.countdown + 1) })} />
        <SwitchRow icon="reorder-three-outline" label={t('settings.align')} value={prefs.align === 'center'} onChange={(v) => setPrefs({ align: v ? 'center' : 'left' })} />
        <SwitchRow icon="text" label={t('settings.bold')} value={prefs.bold} onChange={(bold) => setPrefs({ bold })} />
        <SwitchRow icon="sunny-outline" label={t('settings.highlightLine')} value={prefs.highlightLine} onChange={(highlightLine) => setPrefs({ highlightLine })} />
        <SwitchRow icon="chatbubble-ellipses-outline" label={t('settings.showNotes')} value={prefs.showNotes} onChange={(showNotes) => setPrefs({ showNotes })} />
        <SwitchRow icon="swap-horizontal" label={t('prompt.mirror')} value={prefs.mirrorH} onChange={(mirrorH) => setPrefs({ mirrorH })} />
        <SwitchRow icon="stopwatch-outline" label={t('settings.showTimer')} value={prefs.showTimer} onChange={(showTimer) => setPrefs({ showTimer })} last />
      </Section>

      <Section title={t('settings.colors')} footer={colorsLocked ? t('plus.f.colors.body') : undefined}>
        <View style={st.swatches} accessibilityRole="radiogroup" accessibilityLabel={t('settings.colors')}>
          {(['classic', 'paper', 'night', 'contrast'] as const).map((c) => {
            const pal = PROMPTER[c];
            const locked = colorsLocked && c !== 'classic';
            const on = (colorsLocked ? 'classic' : prefs.colors) === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={locked ? `${t(`settings.colors.${c}`)}, ${t('common.plus')}` : t(`settings.colors.${c}`)}
                onPress={() => (locked ? router.push('/plus') : setPrefs({ colors: c as PrompterColors }))}
                style={st.swatchWrap}
              >
                <View style={[st.swatch, { backgroundColor: pal.bg, borderColor: on ? theme.accent : theme.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}>
                  <Text style={{ color: pal.ink, fontFamily: FONT.bodyBold, fontSize: 20 }}>Aa</Text>
                  <View style={[st.swatchLine, { backgroundColor: pal.cue }]} />
                  {locked ? <Ionicons name="sparkles" size={12} color={theme.accentText} style={st.swatchLock} /> : null}
                </View>
                <Text style={{ color: on ? theme.ink : theme.sub, fontFamily: on ? FONT.bodyBold : FONT.body, fontSize: 12.5 }} numberOfLines={1}>
                  {t(`settings.colors.${c}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={t('settings.appearance')}>
        <Row
          label={t('settings.theme')}
          last
          right={
            <Segmented
              compact
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
        <SwitchRow icon="pulse-outline" label={t('settings.haptics')} value={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
        <SwitchRow icon="accessibility-outline" label={t('settings.reduceMotion')} value={app.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v ? 'on' : 'off' })} last />
      </Section>

      <Section title={t('settings.about')} footer={t('settings.privacy')}>
        <Row icon="mail-outline" label={t('settings.feedback')} onPress={() => Linking.openURL('mailto:jaredbradley272+cue@gmail.com?subject=Cue%20feedback').catch(() => Alert.alert(t('error.unknown')))} />
        <Row icon="information-circle-outline" label={t('settings.version', { v: version })} last />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  swatches: { flexDirection: 'row', padding: 14, gap: 10 },
  swatchWrap: { flex: 1, alignItems: 'center', gap: 6 },
  swatch: { alignSelf: 'stretch', aspectRatio: 0.9, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  swatchLine: { width: '50%', height: 3, borderRadius: 2, opacity: 0.8 },
  swatchLock: { position: 'absolute', top: 6, right: 6 },
});
