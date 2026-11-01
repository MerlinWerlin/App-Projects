// ProfileGuideArt (T262, owner-1101i): ORIGINAL redrawn illustrations of the iOS 27 profile
// install screens, one per step: Safari's "Profile Downloaded" alert, the top of Settings with
// "More for Your iPhone", the "Profile Downloaded" card with View Profile, and the Install Profile
// sheet. Drawn with plain Views/Text in v2 tokens (no screenshots, no Apple logos or brand marks)
// with placeholder content only ("Your Name", a grey avatar circle). The owner's reference
// screenshots (owner-1101i, under docs/) are never bundled (src/core/profileGuide.test.ts).
// The tap target of each step sits inside a tint ring. Each illustration is one image to screen
// readers, with a label describing it.

import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { Illustration } from '../core/install';
import { useT } from '../i18n';
import {
  circleRadius,
  continuous,
  fontScaleCap,
  iconTileRadius,
  radiusV2,
  spaceV2,
  textV2,
  type PaletteV2,
  type TypeRoleV2,
} from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { Chevron, textStyleFor } from './i18nLayout';

const AVATAR = 28;
const BADGE = 16;
const TILE = 28;
const CLOSE = 22;

/** The profile name iOS shows on the sheet (src/core/mobileconfig.ts profileDisplayName). */
const PROFILE_NAME = 'Glaze icons'; // i18n-ignore

type Kind = 'profile-downloaded' | 'settings-more' | 'more-view-profile' | 'install-profile-sheet';

function isKind(k: Illustration): k is Kind {
  return k === 'profile-downloaded' || k === 'settings-more' || k === 'more-view-profile' || k === 'install-profile-sheet';
}

/** One step illustration; renders nothing for illustration kinds it does not draw. */
export function ProfileGuideArt({ kind }: { kind: Illustration }) {
  const { c } = useColorsV2();
  const { t } = useT();
  if (!isKind(kind)) return null;
  const label =
    kind === 'profile-downloaded'
      ? t('install.guideArt.downloadedA11y')
      : kind === 'settings-more'
        ? t('install.guideArt.settingsA11y')
        : kind === 'more-view-profile'
          ? t('install.guideArt.moreA11y')
          : t('install.guideArt.sheetA11y');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.screen, continuous, { backgroundColor: c.bg, borderColor: c.separator }]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {kind === 'profile-downloaded' ? <Downloaded c={c} /> : null}
        {kind === 'settings-more' ? <SettingsTop c={c} /> : null}
        {kind === 'more-view-profile' ? <MoreForIphone c={c} /> : null}
        {kind === 'install-profile-sheet' ? <InstallSheet c={c} /> : null}
      </View>
    </View>
  );
}

/** Small text in a v2 role, capped for Dynamic Type so the mock keeps its shape. */
function Label({
  role,
  color,
  lines = 1,
  style,
  children,
}: {
  role: TypeRoleV2;
  color: string;
  lines?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  const { script } = useT();
  return (
    <Text
      numberOfLines={lines}
      maxFontSizeMultiplier={Math.min(1.2, fontScaleCap(role))}
      style={[textV2[role], textStyleFor(script, textV2[role]), { color }, style]}
    >
      {children}
    </Text>
  );
}

/** The ring around the thing to tap. */
function Ring({ c, children, round }: { c: PaletteV2; children: ReactNode; round?: boolean }) {
  return (
    <View
      style={[
        styles.ring,
        continuous,
        round ? styles.ringFit : styles.ringStretch,
        { borderColor: c.tint, borderRadius: round ? radiusV2.pill : radiusV2.control },
      ]}
    >
      {children}
    </View>
  );
}

function Bar({ c, width }: { c: PaletteV2; width: number }) {
  return <View style={[styles.bar, { width, backgroundColor: c.separator }]} />;
}

/** Step 1: Safari's "Profile Downloaded" alert over a dimmed page; Close is ringed. */
function Downloaded({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={[styles.dim, continuous, { backgroundColor: c.fill }]}>
      <Bar c={c} width={120} />
      <View style={[styles.alert, continuous, { backgroundColor: c.surface }]}>
        <Label role="subhead" color={c.ink} style={styles.bold}>
          {t('install.guideArt.downloadedTitle')}
        </Label>
        <Label role="caption1" color={c.inkSecondary} lines={3} style={styles.center}>
          {t('install.guideArt.downloadedBody')}
        </Label>
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <Ring c={c} round>
          <Label role="subhead" color={c.tint} style={styles.bold}>
            {t('install.guideArt.close')}
          </Label>
        </Ring>
      </View>
      <Bar c={c} width={90} />
    </View>
  );
}

/** Step 2: the top of Settings; placeholder account card, then the ringed "More for Your iPhone" row. */
function SettingsTop({ c }: { c: PaletteV2 }) {
  const { t, isRTL, formatNumber } = useT();
  return (
    <View style={styles.stack}>
      <Label role="headline" color={c.ink} style={styles.bold}>
        {t('install.guideArt.settings')}
      </Label>
      <View style={[styles.search, { backgroundColor: c.fill }]}>
        <Feather name="search" size={12} color={c.inkTertiary} />
        <Bar c={c} width={60} />
      </View>
      <View style={[styles.group, continuous, { backgroundColor: c.surface }]}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: c.inkTertiary }]}>
            <Feather name="user" size={16} color={c.surface} />
          </View>
          <View style={styles.flex}>
            <Label role="footnote" color={c.ink} style={styles.bold}>
              {t('install.guideArt.yourName')}
            </Label>
            <Label role="caption2" color={c.inkSecondary}>
              {t('install.guideArt.account')}
            </Label>
          </View>
          <Feather name={Chevron.forward(isRTL)} size={14} color={c.inkTertiary} />
        </View>
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <Ring c={c}>
          <View style={styles.row}>
            <Label role="footnote" color={c.ink} style={styles.flexText}>
              {t('install.guideArt.moreRow')}
            </Label>
            <View style={[styles.badge, { backgroundColor: c.danger }]}>
              <Label role="caption2" color={c.onDanger} style={styles.bold}>
                {formatNumber(1)}
              </Label>
            </View>
            <Feather name={Chevron.forward(isRTL)} size={14} color={c.inkTertiary} />
          </View>
        </Ring>
      </View>
    </View>
  );
}

/** Step 3: More for Your iPhone; a generic card, then "Profile Downloaded" with View Profile ringed. */
function MoreForIphone({ c }: { c: PaletteV2 }) {
  const { t, isRTL } = useT();
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <Feather name={Chevron.back(isRTL)} size={16} color={c.inkSecondary} />
        <Label role="footnote" color={c.ink} style={[styles.bold, styles.flexText]}>
          {t('install.guideArt.moreRow')}
        </Label>
      </View>
      <View style={[styles.group, styles.gapXs, continuous, { backgroundColor: c.surface }]}>
        <Bar c={c} width={110} />
        <Bar c={c} width={150} />
      </View>
      <View style={[styles.group, continuous, { backgroundColor: c.surface }]}>
        <Label role="subhead" color={c.ink} style={styles.bold}>
          {t('install.guideArt.downloadedTitle')}
        </Label>
        <View style={[styles.rule, { backgroundColor: c.separator }]} />
        <Ring c={c}>
          <Label role="footnote" color={c.tint}>
            {t('install.guideArt.viewProfile')}
          </Label>
        </Ring>
      </View>
    </View>
  );
}

/** Step 4: the Install Profile sheet; "Glaze icons", Web Clips, and Install (top end) ringed. */
function InstallSheet({ c }: { c: PaletteV2 }) {
  const { t } = useT();
  return (
    <View style={[styles.sheet, continuous, { backgroundColor: c.surfaceRaised }]}>
      <View style={styles.row}>
        <View style={[styles.closeDot, { backgroundColor: c.fill }]}>
          <Feather name="x" size={12} color={c.inkSecondary} />
        </View>
        <Label role="footnote" color={c.ink} style={[styles.bold, styles.flexText, styles.center]}>
          {t('install.guideArt.sheetTitle')}
        </Label>
        <Ring c={c} round>
          <View style={[styles.installPill, { backgroundColor: c.tint }]}>
            <Label role="caption1" color={c.onTint} style={styles.bold}>
              {t('install.guideArt.install')}
            </Label>
          </View>
        </Ring>
      </View>
      <View style={[styles.group, continuous, { backgroundColor: c.bg }]}>
        <View style={styles.row}>
          <View style={[styles.tile, { backgroundColor: c.fill, borderRadius: iconTileRadius(TILE) }]}>
            <Feather name="settings" size={16} color={c.inkSecondary} />
          </View>
          <View style={styles.flex}>
            <Label role="footnote" color={c.ink}>
              {`${PROFILE_NAME} – ${t('install.guideArt.custom')}`}
            </Label>
            <Label role="caption2" color={c.inkSecondary}>
              {`${t('install.guideArt.contains')} · ${t('install.guideArt.webClips')}`}
            </Label>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    borderRadius: radiusV2.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spaceV2.md,
    overflow: 'hidden',
  },
  stack: { gap: spaceV2.sm },
  dim: { borderRadius: radiusV2.control, padding: spaceV2.md, gap: spaceV2.md, alignItems: 'center' },
  alert: { width: '100%', borderRadius: radiusV2.control, padding: spaceV2.md, gap: spaceV2.xs, alignItems: 'center' },
  bar: { height: 6, borderRadius: circleRadius(6) },
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spaceV2.xs },
  ring: { borderWidth: 2, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  ringStretch: { alignSelf: 'stretch' },
  ringFit: { alignSelf: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xs,
  },
  group: { borderRadius: radiusV2.control, padding: spaceV2.sm, gap: spaceV2.xxs },
  gapXs: { gap: spaceV2.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: circleRadius(AVATAR),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: BADGE,
    height: BADGE,
    borderRadius: circleRadius(BADGE),
    paddingHorizontal: spaceV2.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { borderRadius: radiusV2.control, padding: spaceV2.sm, gap: spaceV2.sm },
  closeDot: {
    width: CLOSE,
    height: CLOSE,
    borderRadius: circleRadius(CLOSE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  installPill: { borderRadius: radiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  flexText: { flex: 1 },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
});
