// Tips library: every tip grouped by feature, with its status and Show again / Hide.
// Reached from Settings › Tips and the "?" button on the Themes tab.
// Design v2 (T83): an InsetGroup per feature, each tip a row with a small tinted Show again / Hide pill.
import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hiddenCount, isDismissed, tipGroups, type Tip } from '../src/core/tips';
import { tipsForInstallMode } from '../src/core/installMethods';
import { PROFILE_INSTALL_ENABLED } from '../src/config/install';
import { useT } from '../src/i18n';
import { useTips } from '../src/store/tips';
import { sizeV2, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import type { FeatherName } from '../src/ui/featherName';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup } from '../src/ui/InsetGroup';
import { PillButton } from '../src/ui/PillButton';
import { tipGroupKey, tipPlaceKey, tipText } from '../src/ui/tipText';
import { useToast } from '../src/ui/Toast';

// T60: profile-only tips are hidden while the profile install method is switched off.
const GROUPS = tipGroups()
  .map((g) => {
    const keep = new Set<string>(tipsForInstallMode(g.tips.map((tip) => tip.id), PROFILE_INSTALL_ENABLED));
    return { ...g, tips: g.tips.filter((tip) => keep.has(tip.id)) };
  })
  .filter((g) => g.tips.length > 0);

export default function TipsScreen() {
  const { c } = useColorsV2();
  const toast = useToast();
  const { t, script } = useT();
  const { dismissed, hide, show, showAll } = useTips();
  const hidden = hiddenCount(dismissed);

  const onShowAll = async () => {
    haptic('success');
    await showAll();
    toast.show(t('tips.showAllDone'), 'success');
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <Text style={[textV2.callout, textStyleFor(script, textV2.callout), styles.intro, { color: c.inkSecondary }]}>
          {t('tips.intro')}
        </Text>
        <PillButton
          label={t('tips.showAll')}
          icon="rotate-ccw"
          variant="tinted"
          haptic={false}
          style={styles.intro}
          disabled={dismissed === null || hidden === 0}
          onPress={onShowAll}
          accessibilityHint={hidden > 0 ? t('tips.hiddenHint', { count: hidden }) : t('tips.allShowing')}
        />

        {GROUPS.map((g) => (
          <InsetGroup key={g.key} header={t(tipGroupKey(g.key))}>
              {g.tips.map((tip) => (
                <TipRow
                  key={tip.id}
                  tip={tip}
                  hidden={isDismissed(dismissed, tip.id)}
                  loading={dismissed === null}
                  onToggle={(h) => {
                    haptic('select');
                    if (h) hide(tip.id);
                    else show(tip.id);
                  }}
                />
              ))}
          </InsetGroup>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TipRow({
  tip,
  hidden,
  loading,
  onToggle,
}: {
  tip: Tip;
  hidden: boolean;
  loading: boolean;
  onToggle: (hide: boolean) => void;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const { title, body } = tipText(t, tip.id);
  const place = t(tipPlaceKey(tip.placement));
  const status = hidden ? t('tips.hidden') : t('tips.showing');
  const action = hidden ? t('tips.showAgain') : t('tips.hide');
  return (
    <View style={styles.row}>
      <View
        style={styles.rowText}
        accessible
        accessibilityLabel={t('tips.rowA11y', { title, body, place, status })}
      >
        <View style={styles.titleLine}>
          <Feather name={tip.icon as FeatherName} size={18} color={c.tint} />
          <Text style={[textV2.headline, textStyleFor(script, textV2.headline), styles.flex, { color: c.ink }]}>{title}</Text>
        </View>
        <Text style={[textV2.subhead, textStyleFor(script, textV2.subhead), { color: c.ink }]}>{body}</Text>
        <Text style={[...small, { color: c.inkSecondary }]}>
          {t('tips.meta', { place, status })}
        </Text>
      </View>
      <PillButton
        label={action}
        variant="tinted"
        size="small"
        haptic={false}
        disabled={loading}
        onPress={() => onToggle(!hidden)}
        accessibilityLabel={t('tips.toggleA11y', { action, tip: title })}
        style={styles.toggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingVertical: spaceV2.lg, gap: spaceV2.xl, paddingBottom: spaceV2.xxl },
  intro: { marginHorizontal: spaceV2.lg },
  row: { minHeight: sizeV2.rowMin, paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md, gap: spaceV2.sm },
  rowText: { gap: spaceV2.xs },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1 },
  toggle: { alignSelf: 'flex-end' },
});
