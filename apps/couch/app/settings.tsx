import { Stack, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { GLOW_OPTIONS, ONE_HANDED_OPTIONS, SETTING_COPY, THEME_OPTIONS, type SettingCopy } from '../src/core/prefs';
import { useT } from '../src/i18n/react';
import { REMOTE_THEMES } from '../src/theme/remoteThemes';
import { usePrefs } from '../src/state/prefs';
import { list, space, textStyle } from '../src/theme/design';
import { useReducedMotion } from '../src/theme/useReducedMotion';
import { animateNextLayout } from '../src/ui/motion/FadeIn';
import { useLanguageChoice } from '../src/ui/settings/LanguagePicker';
import { Text } from '../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

type Picker = 'language' | 'theme' | 'oneHanded' | 'glow';

interface Choice<V extends string> {
  value: V;
  /** Spoken (and shown in the open list). */
  label: string;
  /** Shown in the closed row when space is short (glow). */
  short?: string;
  hint?: string;
  subtitle?: string;
}

/**
 * Settings, design v2 (market-1018 M3, docs/DESIGN_V2.md): "Settings" large title, a Couch Plus card,
 * then inset-grouped Remote / General / Help groups. Choice settings (language, appearance, one-handed,
 * glow) are value rows that open their options in place as check rows. Every setting is free; the
 * free promise is the last group's footer.
 */
export default function SettingsScreen() {
  const t = useT();
  const p = useDesign();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { prefs, set } = usePrefs();
  const language = useLanguageChoice();
  const [open, setOpen] = useState<Picker | null>(null);
  const themeName = t(REMOTE_THEMES[prefs.remoteTheme].nameKey);

  const toggle = (which: Picker) => {
    animateNextLayout(reduce);
    setOpen((o) => (o === which ? null : which));
  };

  /** The value row plus, when open, one check row per option (returned flat for InsetGroupedList). */
  function picker<V extends string>(
    which: Picker,
    copy: SettingCopy,
    value: V,
    onChange: (v: V) => void,
    options: ReadonlyArray<Choice<V>>,
  ): ReactElement[] {
    const chosen = options.find((o) => o.value === value);
    const rows: ReactElement[] = [
      <Row
        key={which}
        title={copy.title}
        subtitle={copy.hint}
        accessory={{ type: 'value', value: chosen ? (chosen.short ?? chosen.label) : '', chevron: true }}
        accessibilityLabel={t('app.settings.optionLabel', { setting: copy.title, option: chosen?.label ?? '' })}
        accessibilityHint={copy.hint}
        onPress={() => toggle(which)}
      />,
    ];
    if (open !== which) return rows;
    for (const o of options) {
      rows.push(
        <Row
          key={`${which}-${o.value}`}
          title={o.label}
          subtitle={o.subtitle}
          accessory={{ type: 'check', checked: o.value === value }}
          accessibilityLabel={t('app.settings.optionLabel', { setting: copy.title, option: o.label })}
          accessibilityHint={o.hint}
          onPress={() => {
            animateNextLayout(reduce);
            setOpen(null);
            onChange(o.value);
          }}
        />,
      );
    }
    return rows;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTitleHeader
        title={t('app.settings.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Card
          style={styles.plus}
          onPress={() => router.push('/plus')}
          accessibilityRole="link"
          accessibilityLabel={t('app.settings.plus')}
          accessibilityHint={t('app.settings.plusHint')}
        >
          <Text style={[textStyle('headline'), { color: p.label }]}>{t('app.settings.plus')}</Text>
          <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t('app.settings.plusHint')}</Text>
        </Card>

        <InsetGroupedList header={t('app.settings.groupRemote')}>
          <Row
            title={SETTING_COPY.remoteTheme.title}
            subtitle={SETTING_COPY.remoteTheme.hint}
            accessory={{ type: 'value', value: themeName, chevron: true }}
            accessibilityLabel={t('app.settings.remoteThemeLabel', { setting: SETTING_COPY.remoteTheme.title, theme: themeName })}
            accessibilityHint={SETTING_COPY.remoteTheme.hint}
            onPress={() => router.push('/themes')}
          />
          {picker('glow', SETTING_COPY.glow, prefs.glow, (v) => set({ glow: v }), GLOW_OPTIONS)}
          <Row
            title={SETTING_COPY.haptics.title}
            subtitle={SETTING_COPY.haptics.hint}
            accessory={{ type: 'switch', value: prefs.haptics, onValueChange: (v) => set({ haptics: v }) }}
            accessibilityLabel={SETTING_COPY.haptics.title}
            accessibilityHint={SETTING_COPY.haptics.hint}
          />
          <Row
            title={SETTING_COPY.simple.title}
            subtitle={SETTING_COPY.simple.hint}
            accessory={{ type: 'switch', value: prefs.simple, onValueChange: (v) => set({ simple: v }) }}
            accessibilityLabel={SETTING_COPY.simple.title}
            accessibilityHint={SETTING_COPY.simple.hint}
          />
          {picker('oneHanded', SETTING_COPY.oneHanded, prefs.oneHanded, (v) => set({ oneHanded: v }), ONE_HANDED_OPTIONS)}
        </InsetGroupedList>

        <InsetGroupedList header={t('app.settings.groupGeneral')}>
          {picker('language', SETTING_COPY.language, language.value, language.choose, language.options)}
          {picker('theme', SETTING_COPY.theme, prefs.theme, (v) => set({ theme: v }), THEME_OPTIONS)}
        </InsetGroupedList>

        <InsetGroupedList header={t('app.settings.groupHelp')} footer={t('ui.screen.freePromise')}>
          <Row
            title={t('app.settings.diagnostics')}
            subtitle={t('app.settings.diagnosticsHint')}
            accessory={{ type: 'chevron' }}
            accessibilityLabel={t('app.settings.diagnostics')}
            accessibilityHint={t('app.settings.diagnosticsHint')}
            onPress={() => router.push('/diagnostics')}
          />
        </InsetGroupedList>
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  plus: { marginHorizontal: list.inset, marginBottom: list.groupGap, marginTop: space.sm },
});
