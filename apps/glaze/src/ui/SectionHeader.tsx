// Section header (DESIGN.md §5, White Cube): a title, an optional count set after it on the same
// line in tertiary tabular figures ("Space & Night  24"), and an optional line of body under it.
// No eyebrow label above the title (an AI tell, DESIGN.md §8). The title and count are read as one
// accessibility header.
import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { editorialV2, fontScaleCap, spaceV2, tabularV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

type Props = {
  /** A count or short fact set after the title in tertiary text (e.g. how many themes). Optional. */
  meta?: string;
  title: string;
  body?: string;
  /** `section` (title2) for a gallery section, `group` (title3) for a pack inside one. */
  level?: 'section' | 'group';
  /** Drop the space above (first section under other content that already spaces itself). */
  flushTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const SectionHeader = memo(function SectionHeader({ meta, title, body, level = 'section', flushTop = false, style }: Props) {
  const { c } = useColorsV2();
  const { script } = useT();
  const titleRole: TypeRoleV2 = level === 'section' ? 'title2' : 'title3';
  const bodyRole: TypeRoleV2 = level === 'section' ? 'subhead' : 'footnote';
  const label = meta ? `${title}, ${meta}` : title;
  return (
    <View style={[styles.wrap, flushTop ? styles.flushTop : level === 'group' ? styles.groupTop : styles.sectionTop, style]}>
      <View accessible accessibilityRole="header" accessibilityLabel={label} style={styles.heading}>
        <Text maxFontSizeMultiplier={fontScaleCap(titleRole)} style={[textV2[titleRole], textStyleFor(script, textV2[titleRole]), styles.title, { color: c.ink }]}>
          {title}
          {meta ? (
            <Text maxFontSizeMultiplier={fontScaleCap(titleRole)} style={[tabularV2, styles.meta, { color: c.inkTertiary }]}>
              {`  ${meta}`}
            </Text>
          ) : null}
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
  title: { flexShrink: 1 },
  meta: { fontWeight: '400' },
});
