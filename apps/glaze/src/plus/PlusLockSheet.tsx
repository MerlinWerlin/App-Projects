import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useT } from '../i18n';
import {
  circleRadius,
  continuous,
  eyebrowCaseFor,
  fontScaleCap,
  radiusV2,
  shadowV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from '../ui/featherName';
import { announce } from '../ui/announce';
import { ART_PACK_ASSETS } from '../ui/artPackAssets';
import { haptic } from '../ui/haptics';
import { textStyleFor } from '../ui/i18nLayout';
import { PillButton } from '../ui/PillButton';
import { Sheet } from '../ui/Sheet';
import { PLUS_PURCHASABLE, plusStore, usePlus, usePlusPrice } from './entitlement';
import { RestorePurchases } from './RestorePurchases';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** What the person tried to open, already translated, e.g. "the Tenmoku theme". */
  subject?: string;
  /** Called after a successful unlock (App Store purchase, or the dev mock). */
  onUnlocked?: () => void;
};

const BRAND = 'Glaze Plus'; // i18n-ignore (product name)

// D211-1 (31 Oct): every gallery theme is free now and the old Plus packs left the gallery, so the themes row
// says more Plus themes are coming (no count) and the free card says every gallery theme is free. Owner decides
// what Plus adds (Workboard glaze-plus-content); do not mark packs plus:true or change price/paywall copy before then.
// Release standard §2: only what this build has. "Theme clips for Live Photos" (plus.lock.loops) is off the list
// until theme clips exist (the Live tab only makes Live Photos from the person's own video, which stays free).
// T173 §3.6: exactly three benefit rows, each a line icon in a soft tint circle.
type BenefitKey = 'plus.lock.themes' | 'plus.lock.widgets' | 'plus.lock.symbols';
const BENEFITS: readonly { icon: FeatherName; key: BenefitKey }[] = [
  { icon: 'clock', key: 'plus.lock.themes' },
  { icon: 'grid', key: 'plus.lock.widgets' },
  { icon: 'feather', key: 'plus.lock.symbols' },
];

/** Up to three bundled wallpapers for the hero collage (art already in the repo, no network). */
const HERO_ART: readonly number[] = Object.values(ART_PACK_ASSETS)
  .map((a) => a.wallpaper)
  .slice(0, 3);

const FREE = ['plus.lock.freeIcons', 'plus.lock.freeInstall', 'plus.lock.freeLive'] as const;

/**
 * Explains Glaze Plus: one-time price, no subscription, what's included and what stays free.
 * Honest paywall (T63): a large labelled close always in view, Restore purchases always shown,
 * opened only when the person taps something Plus (never at launch). T173 premium pass
 * (docs/PREMIUM_UI.md §3.6): the shared thick-glass Sheet, an art-collage hero, three benefit rows
 * with line icons, one price, one primary pill and Restore as a plain text link. No pressure
 * patterns: no timers, no crossed-out "was" prices, no countdowns; "always free" stays on a mint card.
 */
export function PlusLockSheet({ visible, onClose, subject, onUnlocked }: Props) {
  const { c } = useColorsV2();
  const { purchase } = usePlus();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const ey = eyebrowCaseFor(script);
  const benefitText = (key: BenefitKey): string => t(key);
  const mint = c.pastels.mint;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // T152: the App Store's localised price once loaded (fallback A$2.99).
  const price = usePlusPrice();

  const showFailed = (code: string) => {
    haptic('warning');
    setMessage(t('plus.lock.failed', { code }));
    announce(t('plus.lock.failed', { code }));
  };

  const close = () => {
    setMessage(null);
    onClose();
  };

  const onUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await purchase();
      if (res === 'purchased') {
        haptic('success');
        setMessage(null);
        onUnlocked?.();
        onClose();
      } else if (res === 'failed') {
        // Real store failure says nothing was charged and shows the store code.
        showFailed(plusStore.lastFailureCode?.() ?? 'unknown');
      } else if (res === 'pending') {
        // Ask to Buy / bank check: Plus unlocks by itself when StoreKit finishes it.
        setMessage(t('plus.lock.pending'));
        announce(t('plus.lock.pending'));
      } else if (res === 'unavailable') {
        // Never silent (night 23 Oct, from Linework fb-1023 "Unlock Plus did nothing"): felt, shown and spoken on every tap.
        haptic('warning');
        setMessage(t('plus.lock.unavailable'));
        announce(t('plus.lock.unavailable'));
      }
    } catch {
      haptic('warning');
      if (PLUS_PURCHASABLE) {
        // A native build with the store never shows the test-version line (T152).
        showFailed('unknown');
      } else {
        setMessage(t('plus.lock.unavailable'));
        announce(t('plus.lock.unavailable'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={BRAND} closeLabel={t('plus.lock.close')}>
      <PlusHero />

      <View style={styles.lede}>
        <Text
          maxFontSizeMultiplier={fontScaleCap('eyebrow')}
          style={[...ts('eyebrow'), { letterSpacing: ey.letterSpacing, color: c.tint }, ey.upper ? styles.upper : null]}
        >
          {t('plus.lock.eyebrow')}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('title3')} style={[...ts('title3'), { color: c.ink }]}>
          {subject ? `${t('plus.lock.subjectIntro', { subject })} ` : ''}
          {t('plus.lock.price', { price })}
        </Text>
      </View>

      <View style={styles.list}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.ink }]}>
          {t('plus.lock.included')}
        </Text>
        {BENEFITS.map((b) => (
          <View key={b.key} style={styles.row} accessible accessibilityLabel={benefitText(b.key)}>
            <View style={[styles.circle, { backgroundColor: c.tintSoft }]}>
              <Feather name={b.icon} size={18} color={c.onTintSoft} />
            </View>
            <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.ink }]}>
              {benefitText(b.key)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.free, continuous, { backgroundColor: mint.fill }]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: mint.ink }]}>
          {t('plus.lock.free')}
        </Text>
        {FREE.map((f) => (
          <View key={f} style={styles.freeRow}>
            <Feather name="check" size={16} color={mint.ink} />
            <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...ts('subhead'), styles.flex, { color: mint.ink }]}>
              {t(f)}
            </Text>
          </View>
        ))}
        <View style={styles.freeRow}>
          <Feather name="check" size={16} color={mint.ink} />
          <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...ts('subhead'), styles.flex, { color: mint.ink }]}>
            {t('plus.lock.freeThemes')}
          </Text>
        </View>
      </View>

      {message ? (
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.warn }]}>
          {message}
        </Text>
      ) : null}

      {/* One primary pill; the labelled Close in the sheet header is the way out (T63). */}
      <PillButton
        label={busy ? t('plus.lock.oneMoment') : PLUS_PURCHASABLE ? t('plus.lock.unlockBuy', { price }) : t('plus.lock.unlock')}
        icon="star"
        busy={busy}
        onPress={() => void onUnlock()}
        accessibilityHint={PLUS_PURCHASABLE ? t('plus.lock.buyHint') : t('plus.lock.unlockHint')}
      />

      <RestorePurchases
        variant="link"
        onRestored={() => {
          setMessage(null);
          onUnlocked?.();
          onClose();
        }}
      />
    </Sheet>
  );
}

/** Hero tile heights (pt): the middle wallpaper stands a little taller than its neighbours. */
const HERO_SIDE = 132;
const HERO_MIDDLE = 164;

/**
 * Art-collage hero (T173 §3.6): three bundled theme wallpapers (themes/<id>/wallpaper.png via the
 * generated ART_PACK_ASSETS map) side by side, the middle one lifted. Decorative: hidden from screen
 * readers, nothing moves. Renders nothing when no art is bundled.
 */
function PlusHero() {
  const { scheme } = useColorsV2();
  const art = HERO_ART;
  if (art.length === 0) return null;
  const mid = Math.floor(art.length / 2);
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {art.map((src, i) => {
        const h = i === mid ? HERO_MIDDLE : HERO_SIDE;
        return (
          <View key={i} style={[styles.heroTile, continuous, { height: h }, i === mid ? shadowV2('card', scheme) : null]}>
            <ExpoImage source={src} contentFit="cover" cachePolicy="memory-disk" transition={0} style={[styles.heroImage, continuous]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm, paddingTop: spaceV2.xs },
  heroTile: { flex: 1, maxWidth: 104, borderRadius: radiusV2.card },
  heroImage: { width: '100%', height: '100%', borderRadius: radiusV2.card },
  lede: { gap: spaceV2.xs },
  upper: { textTransform: 'uppercase' },
  list: { gap: spaceV2.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.rowIcon },
  circle: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: circleRadius(sizeV2.rowIcon),
    alignItems: 'center',
    justifyContent: 'center',
  },
  free: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.xs },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1, flexShrink: 1 },
});
