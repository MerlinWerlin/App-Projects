// T130: credit and licence for an art-pack theme on the theme detail. The credit line is data from
// the pack's meta.json and is shown exactly as written (never translated or shortened); the fixed
// text comes from the catalogue (ui.artCredit.*). Renders nothing for a theme that isn't an art pack.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AI_GENERATORS, artPackCreditParams } from '../core/artPack';
import { artPackOf } from '../core/artPackThemes';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { continuous, radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

type Props = {
  theme: Theme | string | null | undefined;
  style?: StyleProp<ViewStyle>;
};

type MadeKey = 'ui.artCredit.procedural' | 'ui.artCredit.ai' | 'ui.artCredit.photo' | 'ui.artCredit.handDrawn' | 'ui.artCredit.original';

function madeKey(generator: string): MadeKey {
  if (generator === 'procedural') return 'ui.artCredit.procedural';
  if (AI_GENERATORS.includes(generator)) return 'ui.artCredit.ai';
  if (generator === 'photo') return 'ui.artCredit.photo';
  if (generator === 'hand-drawn') return 'ui.artCredit.handDrawn';
  return 'ui.artCredit.original';
}

export function ArtPackCredit({ theme, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const pack = artPackOf(typeof theme === 'string' ? theme : (theme ?? null));
  if (!pack) return null;
  const ref = pack.artPack;
  const { credit, licence } = artPackCreditParams(ref);
  const body = [textV2.footnote, { color: c.inkSecondary }, textStyleFor(script, textV2.footnote)];
  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }, style]}>
      <Text style={[textV2.subhead, { color: c.ink, fontWeight: '600' }, textStyleFor(script, textV2.subhead)]} accessibilityRole="header">
        {t('ui.artCredit.title')}
      </Text>
      {credit ? (
        <Text style={[textV2.footnote, { color: c.ink }]} selectable>
          {credit}
        </Text>
      ) : null}
      <Text style={body}>{t(madeKey(ref.generator))}</Text>
      <Text style={body} selectable>
        {t('ui.artCredit.licence', { licence })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.xs },
});
