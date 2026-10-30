// Editorial section header (T173, docs/PREMIUM_UI.md): a small eyebrow label, a title and an
// optional line of body, with generous space above. Used on browse screens instead of a bare title,
// so long galleries read like a magazine: "START HERE / Starter themes / ...".
// Type comes from tokensV2 (eyebrow / title2 / subhead), each with its Dynamic Type cap; the eyebrow
// is upper-case only in Latin scripts (eyebrowCaseFor). The title is the accessibility header; the
// eyebrow is read as part of it, so VoiceOver hears one heading, not three fragments.
import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { editorialV2, eyebrowCaseFor, fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

type Props = {
  /** Short label above the title (a few words). Optional. */
  eyebrow?: string;
  title: string;
  body?: string;
  /** `section` (title2) for a gallery section, `group` (title3) for a pack inside one. */
  level?: 'section' | 'group';
  /** Drop the space above (first section under other content that already spaces itself). */
  flushTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const SectionHeader = memo(function SectionHeader({ eyebrow, title, body, level = 'section', flushTop = false, style }: Props) {
  const { c } = useColorsV2();
  const { script } = useT();
  const titleRole: TypeRoleV2 = level === 'section' ? 'title2' : 'title3';
  const bodyRole: TypeRoleV2 = level === 'section' ? 'subhead' : 'footnote';
  const ey = eyebrowCaseFor(script);
  const label = eyebrow ? `${eyebrow}, ${title}` : title;
  return (
    <View style={[styles.wrap, flushTop ? styles.flushTop : level === 'group' ? styles.groupTop : styles.sectionTop, style]}>
      <View accessible accessibilityRole="header" accessibilityLabel={label} style={styles.heading}>
        {eyebrow ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap('eyebrow')}
            style={[
              textV2.eyebrow,
              textStyleFor(script, textV2.eyebrow),
              { letterSpacing: ey.letterSpacing, color: c.tint },
              ey.upper ? styles.upper : null,
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={fontScaleCap(titleRole)} style={[textV2[titleRole], textStyleFor(script, textV2[titleRole]), { color: c.ink }]}>
          {title}
        </Text>
      </View>
      {body ? (
        <Text maxFontSizeMultiplier={fontScaleCap(bodyRole)} style={[textV2[bodyRole], textStyleFor(script, textV2[bodyRole]), { color: c.inkSecondary }]}>
          {body}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.xs, paddingBottom: editorialV2.sectionBottom },
  heading: { gap: spaceV2.xxs },
  sectionTop: { paddingTop: editorialV2.sectionTop },
  groupTop: { paddingTop: spaceV2.lg },
  flushTop: { paddingTop: 0 },
  upper: { textTransform: 'uppercase' },
});
