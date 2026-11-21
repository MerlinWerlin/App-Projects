import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_MAX, FONT_MIN, type PrompterColors } from '../src/core/prefs';
import { t } from '../src/i18n';
import { trialLabel, trialState } from '../src/plus/trial';
import { useApp } from '../src/state/AppState';
import { FONT, PROMPTER, RADIUS, SPACE, TYPE } from '../src/theme/theme';
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
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl, paddingTop: SPACE.xxs }}>
      <Section title={t('settings.plus')} footer={trial ? t(trial.key, { n: trial.n }) : undefined}>
        <Row label={t('settings.plus')} value={app.tier === 'plus' ? t('plus.active') : undefined} onPress={() => router.push('/plus')} />
        <Row
          label={t('settings.restore')}
          last
          onPress={async () => {
            const r = await app.restorePlus();
            if (r.ok) Alert.alert(t(r.access.plus ? 'plus.thanks' : trialState(r.access.trialStart, Date.now()).active ? 'plus.trial.started' : 'plus.trial.expired'));
            else if (r.reason !== 'cancelled') Alert.alert(r.message);
          }}
        />
      </Section>

      {Platform.OS === 'android' ? <Section title={t('access.title')}>
        <Row label={t('access.title')} value={app.codeAccess ? t('common.on') : undefined} onPress={() => router.push('/access-code')} last />
      </Section> : null}

      <Section title={t('settings.prompterText')}>
        <Stepper label={t('settings.fontSize')} value={String(prefs.fontSize)} onMinus={() => setPrefs({ fontSize: Math.max(FONT_MIN, prefs.fontSize - 2) })} onPlus={() => setPrefs({ fontSize: Math.min(FONT_MAX, prefs.fontSize + 2) })} />
        <Stepper label={t('settings.lineHeight')} value={prefs.lineHeight.toFixed(2)} onMinus={() => setPrefs({ lineHeight: Math.max(1.1, +(prefs.lineHeight - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ lineHeight: Math.min(2, +(prefs.lineHeight + 0.05).toFixed(2)) })} />
        <Stepper label={t('settings.margin')} value={String(prefs.margin)} onMinus={() => setPrefs({ margin: Math.max(8, prefs.margin - 8) })} onPlus={() => setPrefs({ margin: Math.min(120, prefs.margin + 8) })} />
        <SwitchRow label={t('settings.align')} value={prefs.align === 'center'} onChange={(v) => setPrefs({ align: v ? 'center' : 'left' })} />
        <SwitchRow label={t('settings.bold')} value={prefs.bold} onChange={(bold) => setPrefs({ bold })} last />
      </Section>

      <Section title={t('settings.reading')}>
        <Stepper label={t('settings.readingLine')} value={`${Math.round(prefs.readingLine * 100)}%`} onMinus={() => setPrefs({ readingLine: Math.max(0.15, +(prefs.readingLine - 0.05).toFixed(2)) })} onPlus={() => setPrefs({ readingLine: Math.min(0.6, +(prefs.readingLine + 0.05).toFixed(2)) })} />
        <Stepper label={t('settings.countdown')} value={prefs.countdown ? t('settings.seconds', { n: prefs.countdown }) : t('settings.countdownOff')} onMinus={() => setPrefs({ countdown: Math.max(0, prefs.countdown - 1) })} onPlus={() => setPrefs({ countdown: Math.min(10, prefs.countdown + 1) })} />
        <SwitchRow label={t('settings.highlightLine')} value={prefs.highlightLine} onChange={(highlightLine) => setPrefs({ highlightLine })} />
        <SwitchRow label={t('settings.showNotes')} value={prefs.showNotes} onChange={(showNotes) => setPrefs({ showNotes })} />
        <SwitchRow label={t('prompt.mirror')} value={prefs.mirrorH} onChange={(mirrorH) => setPrefs({ mirrorH })} />
        <SwitchRow label={t('settings.showTimer')} value={prefs.showTimer} onChange={(showTimer) => setPrefs({ showTimer })} last />
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
                <View style={[st.swatch, { backgroundColor: pal.bg, borderColor: on ? theme.ink : theme.rule, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}>
                  <View style={[st.swatchBand, { backgroundColor: pal.band }]}>
                    <Text style={{ color: pal.ink, fontFamily: FONT.scriptBold, fontSize: 20 }}>Aa</Text>
                  </View>
                  {locked ? <Ionicons name="lock-closed" size={12} color={pal.dim} style={st.swatchLock} /> : null}
                </View>
                <Text style={[TYPE.footnote, { color: on ? theme.ink : theme.ink2, fontWeight: on ? '600' : '400' }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
        <SwitchRow label={t('settings.haptics')} value={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
        <SwitchRow label={t('settings.reduceMotion')} value={app.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v ? 'on' : 'off' })} last />
      </Section>

      <Section title={t('settings.about')} footer={t('settings.privacy')}>
        <Row label={t('settings.feedback')} onPress={() => Linking.openURL('mailto:jaredbradley272+cue@gmail.com?subject=Cue%20feedback').catch(() => Alert.alert(t('error.unknown')))} />
        <Row label={t('settings.privacyPolicy')} onPress={() => Linking.openURL('https://merlinwerlin.github.io/App-Projects/cue/privacy.html').catch(() => Alert.alert(t('error.unknown')))} />
        <Row label={t('settings.version', { v: version })} last />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  swatches: { flexDirection: 'row', padding: SPACE.md, gap: SPACE.sm },
  swatchWrap: { flex: 1, alignItems: 'center', gap: SPACE.xs, minHeight: SPACE.touch },
  swatch: { alignSelf: 'stretch', aspectRatio: 0.9, borderRadius: RADIUS.chip, justifyContent: 'center', overflow: 'hidden' },
  swatchBand: { alignItems: 'center', paddingVertical: SPACE.xs },
  swatchLock: { position: 'absolute', top: 6, right: 6 },
});
