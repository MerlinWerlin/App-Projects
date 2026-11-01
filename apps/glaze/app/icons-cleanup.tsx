// T194 (owner brief 1 Nov, item 10): "Clean up old icons". Apps can't delete Home Screen icons,
// so this screen gives the exact iPhone steps: remove an old Glaze profile in Settings > General >
// VPN & Device Management (all its icons at once), remove hand-made / Shortcuts icons from the
// Home Screen, and hide the original app icons (they stay in the App Library).
// Reached from the Icons tab and from the end of the install flow (app/install.tsx).
// Free feature: nothing here reads Plus.
// T210 (premium pass): each way is an editorial group title (SectionHeader via InsetGroup `title`),
// not the small grey header, on the 32 pt section rhythm.
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT, type MessageKey } from '../src/i18n';
import { editorialV2, fontScaleCap, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup, InsetRow } from '../src/ui/v2';

type Section = { header: MessageKey; steps: readonly MessageKey[]; footer?: MessageKey };

const SECTIONS: readonly Section[] = [
  {
    header: 'install.cleanup.profileHeader',
    steps: ['install.cleanup.profile1', 'install.cleanup.profile2', 'install.cleanup.profile3'],
    footer: 'install.cleanup.profileNote',
  },
  {
    header: 'install.cleanup.handHeader',
    steps: ['install.cleanup.hand1', 'install.cleanup.hand2'],
    footer: 'install.cleanup.handNote',
  },
  {
    header: 'install.cleanup.hideHeader',
    steps: ['install.cleanup.hide1', 'install.cleanup.hide2'],
  },
];

export default function IconsCleanupScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <Text
          maxFontSizeMultiplier={fontScaleCap('callout')}
          style={[textV2.callout, textStyleFor(script, textV2.callout), styles.intro, { color: c.inkSecondary }]}
        >
          {t('install.cleanup.intro')}
        </Text>
        {SECTIONS.map((s) => (
          <InsetGroup key={s.header} title={t(s.header)} footer={s.footer ? t(s.footer) : undefined}>
            {s.steps.map((key) => (
              <InsetRow key={key} title={t(key)} />
            ))}
          </InsetGroup>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingVertical: spaceV2.lg, gap: editorialV2.sectionTop, paddingBottom: spaceV2.xxl },
  intro: { marginHorizontal: spaceV2.lg },
});
