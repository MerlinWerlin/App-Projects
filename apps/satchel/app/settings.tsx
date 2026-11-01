// Settings (FLOWS §12, ACCESSIBILITY "Settings"): appearance (System / Light / Dark, applied at once), haptics, the low-battery essentials switch and threshold, the
// "Data Not Collected" privacy summary, then app information. Essentials prefs share ESSENTIALS_KEY with the
// Trips banner and the essentials screen, so a change here shows there at once.
// T44 (ACCESSIBILITY "Settings": the threshold is one adjustable control): the threshold row is a single
// accessibilityRole="adjustable" element with increment / decrement actions and a spoken value; the visible - / +
// buttons stay for touch but are hidden from screen readers so VoiceOver and TalkBack meet one control, not three.
// T58: Home country, the same saved choice (HOME_COUNTRY_KEY) as "Bring an adapter?" on the essentials card.
// T68: Usual sleep (bedtime and wake-up, default 23:00 to 07:00), for the jet lag plan and the call finder. Each time
// is one adjustable row like the threshold, moving in 30-minute steps.
// T72: About carries the OpenStreetMap and MET Norway credits and opens Licences and credits (app/licences.tsx).
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View, type AccessibilityActionEvent } from 'react-native';
import table from '../src/content/emergency_numbers.json';
import { DEFAULT_ESSENTIALS, ESSENTIALS_KEY, MAX_THRESHOLD, MIN_THRESHOLD, normalisePrefs, type EssentialsPrefs } from '../src/core/battery.ts';
import { languageName, languageOptions } from '../src/core/languageHint.ts';
import { APPEARANCES, formatPercent, SLEEP_STEP_MIN, sleepLimits, stepSleep, stepThreshold, thresholdLimits } from '../src/core/settings.ts';
import { useApp } from '../src/state/app.tsx';
import { usePersisted } from '../src/state/persisted.ts';
import { fonts, radius, space, TOUCH } from '../src/theme/tokens.ts';
import { AirportSettings } from '../src/ui/AirportFields.tsx';
import { LayoverSettings } from '../src/ui/layovers.tsx';
import { HomeCountryPicker, useHomeCountry } from '../src/ui/HomeCountryPicker.tsx';
import { TEMP_UNITS } from '../src/core/weather.ts';
import { useTempUnit } from '../src/ui/WeatherCard.tsx';
import { FadeInView, HeroHeader, SectionHeader, type IconName, type Tone } from '../src/ui/hero.tsx';
import { Body, Button, Card, Chip, PressableScale, Screen, ToggleRow } from '../src/ui/kit.tsx';

const LIST_DATE = typeof (table as { imported?: unknown }).imported === 'string' ? (table as { imported: string }).imported : null;

function Section({ title, icon, tone, children }: { title: string; icon: IconName; tone: Tone; children: ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <SectionHeader title={title} icon={icon} tone={tone} />
      <Card>{children}</Card>
    </View>
  );
}

/** A visible - / + button. Screen readers skip it: the surrounding adjustable row carries the same actions. */
function StepButton({ icon, label, hint, enabled, onPress }: { icon: 'add' | 'remove'; label: string; hint: string; enabled: boolean; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !enabled }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      disabled={!enabled}
      onPress={onPress}
      style={{
        width: TOUCH,
        height: TOUCH,
        borderRadius: radius.m,
        borderWidth: 1,
        borderColor: theme.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enabled ? 1 : 0.4,
      }}
    >
      <Ionicons name={icon} size={24} color={theme.ink} />
    </PressableScale>
  );
}

/** One sleep time (bedtime or wake-up) as a single adjustable control, with visible earlier / later buttons. */
function SleepRow({ which }: { which: 'bed' | 'wake' }) {
  const { t, prefs, setPrefs, theme } = useApp();
  const current = { sleepBed: prefs.sleepBed, sleepWake: prefs.sleepWake };
  const time = which === 'bed' ? prefs.sleepBed : prefs.sleepWake;
  const { canLower, canRaise } = sleepLimits(current, which);
  const vars = { min: SLEEP_STEP_MIN };
  const step = (dir: 1 | -1) => setPrefs(stepSleep(current, which, dir));
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment' && canRaise) step(1);
    else if (e.nativeEvent.actionName === 'decrement' && canLower) step(-1);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t(which === 'bed' ? 'settings.sleepBedLabel' : 'settings.sleepWakeLabel')}
      accessibilityHint={t('settings.sleepAdjustHint', vars)}
      accessibilityValue={{ text: time }}
      accessibilityActions={[
        { name: 'increment', label: t('settings.sleepLater') },
        { name: 'decrement', label: t('settings.sleepEarlier') },
      ]}
      onAccessibilityAction={onAction}
      accessibilityLiveRegion="polite"
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m }}
    >
      <StepButton icon="remove" label={t('settings.sleepEarlier')} hint={t('settings.sleepEarlierHint', vars)} enabled={canLower} onPress={() => step(-1)} />
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink, fontVariant: ['tabular-nums'] }}>
        {t(which === 'bed' ? 'settings.sleepBed' : 'settings.sleepWake', { time })}
      </Text>
      <StepButton icon="add" label={t('settings.sleepLater')} hint={t('settings.sleepLaterHint', vars)} enabled={canRaise} onPress={() => step(1)} />
    </View>
  );
}

export default function SettingsScreen() {
  const { t, prefs, setPrefs, theme, lang, shipped } = useApp();
  const router = useRouter();
  const [stored, setStored] = usePersisted<EssentialsPrefs>(ESSENTIALS_KEY, DEFAULT_ESSENTIALS);
  const essentials = normalisePrefs(stored);
  const percent = formatPercent(essentials.threshold, lang);
  const { canLower, canRaise } = thresholdLimits(essentials.threshold);
  const { homeRow } = useHomeCountry();
  const [tempUnit, setTempUnit] = useTempUnit();

  const setManual = (manual: boolean) => {
    setStored((old) => ({ ...normalisePrefs(old), manual }));
    // FLOWS §12: turning manual essentials on opens Essentials.
    if (manual) router.push('/essentials');
  };
  const step = (dir: 1 | -1) =>
    setStored((old) => {
      const p = normalisePrefs(old);
      return { ...p, threshold: stepThreshold(p.threshold, dir) };
    });
  // VoiceOver swipe up / down (TalkBack volume keys) on the adjustable row.
  const onThresholdAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment' && canRaise) step(1);
    else if (e.nativeEvent.actionName === 'decrement' && canLower) step(-1);
  };

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="trips" illustration="dial" compact eyebrow={t('look.settings.heroEyebrow')} title={t('look.settings.heroTitle')} subtitle={t('look.settings.heroSubtitle')} />
      </FadeInView>
      <Section title={t('language.settingsTitle')} icon="language-outline" tone="sea">
        <View accessibilityRole="radiogroup" accessibilityLabel={t('language.settingsTitle')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {languageOptions(shipped).map((o) => (
            <Chip
              key={o}
              label={o === 'system' ? t('language.system', { name: languageName(lang) }) : languageName(o)}
              selected={prefs.language === o}
              onPress={() => setPrefs({ language: o })}
            />
          ))}
        </View>
        <Body muted>{t('language.body')}</Body>
      </Section>

      <Section title={t('settings.appearance')} icon="color-palette-outline" tone="accent">
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.appearance')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {APPEARANCES.map((a) => (
            <Chip key={a} label={t(`settings.appearance.${a}`)} selected={prefs.appearance === a} onPress={() => setPrefs({ appearance: a })} />
          ))}
        </View>
        <Body muted>{t('settings.appearanceBody')}</Body>
      </Section>

      <Section title={t('weather.unitSetting')} icon="thermometer-outline" tone="warn">
        <View accessibilityRole="radiogroup" accessibilityLabel={t('weather.unitSetting')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {TEMP_UNITS.map((u) => (
            <Chip key={u} label={t(`weather.unit.${u}`)} selected={tempUnit === u} onPress={() => setTempUnit(u)} />
          ))}
        </View>
        <Body muted>{t('weather.unitSettingBody')}</Body>
      </Section>

      <Section title={t('settings.sectionFeedback')} icon="phone-portrait-outline" tone="teal">
        <ToggleRow label={t('settings.haptics')} hint={t('settings.hapticsA11yHint')} value={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} />
        <Body muted>{t('settings.hapticsHint')}</Body>
      </Section>

      <Section title={t('settings.sectionEssentials')} icon="battery-half-outline" tone="ok">
        <ToggleRow label={t('settings.essentialsManual')} hint={t('settings.essentialsManualHint')} value={essentials.manual} onChange={setManual} />
        <Body muted>{t('settings.essentialsBody')}</Body>
        <View style={{ height: 1, backgroundColor: theme.line, marginVertical: space.s }} />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('settings.thresholdAdjustLabel')}
          accessibilityHint={t('settings.thresholdAdjustHint')}
          accessibilityValue={{ min: Math.round(MIN_THRESHOLD * 100), max: Math.round(MAX_THRESHOLD * 100), now: Math.round(essentials.threshold * 100), text: percent }}
          accessibilityActions={[
            { name: 'increment', label: t('settings.thresholdRaise') },
            { name: 'decrement', label: t('settings.thresholdLower') },
          ]}
          onAccessibilityAction={onThresholdAction}
          accessibilityLiveRegion="polite"
          style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m }}
        >
          <StepButton icon="remove" label={t('settings.thresholdLower')} hint={t('settings.thresholdLowerHint')} enabled={canLower} onPress={() => step(-1)} />
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
            {t('settings.threshold', { percent })}
          </Text>
          <StepButton icon="add" label={t('settings.thresholdRaise')} hint={t('settings.thresholdRaiseHint')} enabled={canRaise} onPress={() => step(1)} />
        </View>
        <Body muted>{t('settings.thresholdBody')}</Body>
      </Section>

      <Section title={t('settings.homeCountry')} icon="home-outline" tone="sea">
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
          {t('settings.homeCountryValue', { country: homeRow ? homeRow.country : t('settings.homeCountryNone') })}
        </Text>
        <Body muted>{t('settings.homeCountryBody')}</Body>
        <HomeCountryPicker />
      </Section>

      <Section title={t('settings.sleep')} icon="moon-outline" tone="teal">
        <SleepRow which="bed" />
        <SleepRow which="wake" />
        <Body muted>{t('settings.sleepBody')}</Body>
      </Section>

      <AirportSettings />
      {/* T131: tight / long limits for a change between journeys. */}
      <LayoverSettings />

      <Section title={t('settings.privacy')} icon="shield-checkmark-outline" tone="ok">
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {t('settings.privacyHeading')}
        </Text>
        <Body>{t('settings.privacyAccounts')}</Body>
        <Body>{t('settings.privacyOnDevice')}</Body>
        <Body>{t('settings.privacyLocation')}</Body>
        <Body muted>{t('settings.privacyMap')}</Body>
      </Section>

      <Section title={t('settings.sectionAbout')} icon="information-circle-outline" tone="accent">
        <Body>{t('settings.version', { v: Constants.expoConfig?.version ?? '0.1.0' })}</Body>
        {LIST_DATE ? <Body muted>{t('settings.emergencyRef', { date: LIST_DATE })}</Body> : null}
        <Body muted>{t('licences.osm.credit')}</Body>
        <Body muted>{t('licences.met.credit')}</Body>
        <Button label={t('licences.open')} hint={t('licences.openHint')} kind="secondary" icon="document-text-outline" onPress={() => router.push('/licences')} />
      </Section>
    </Screen>
  );
}
