// Linework Plus (owner decision 22 Oct 2026: 14-day free trial, then A$2.99 one-time; docs/OWNER_1022D.md). Large
// title, trial status, "Free forever" as an inset group, the Plus offer as a pastel hero BubbleCard with the real
// App Store purchase (src/plus/iapStore.ts) in store builds. Expo Go has no store: the Buy button says so, and the
// __DEV__ links simulate a purchase or end the trial so the locks can be tried.
import { Alert, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useThemeV2 } from '../src/theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../src/theme/tokensV2';
import { pressScaleV2 } from '../src/theme/motion';
import { select, tap } from '../src/native/haptics';
import { PressableScale } from '../src/ui/PressableScale';
import { BubbleCard, IconBubble, InsetGroup, InsetRow, PillButton, ScreenV2 } from '../src/ui/v2';
import { squircle } from '../src/ui/v2/shared';
import {
  FREE_FOREVER_ITEMS,
  PLUS_FEATURE_ITEMS,
  PLUS_PRICE,
  STARTER_TEMPLATE_COUNT,
  TIP_OPTIONS,
  type FreeToolId,
  type PlusFeatureId,
  type TipAmountId,
} from '../src/plus/entitlement';
import { usePlus } from '../src/plus/usePlus';
import { useT } from '../src/i18n';
import type { MessageKey } from '../src/i18n/en';

// Typed catalogue keys per id, so a missing translation key fails the type check.
const FREE_KEYS: Record<FreeToolId, MessageKey> = {
  camera: 'plus.free.camera',
  opacity: 'plus.free.opacity',
  scaleRotate: 'plus.free.scaleRotate',
  lock: 'plus.free.lock',
  flashlight: 'plus.free.flashlight',
  grid: 'plus.free.grid',
  mirror: 'plus.free.mirror',
  touchLock: 'plus.free.touchLock',
  lightbox: 'plus.free.lightbox',
  ownPhotos: 'plus.free.ownPhotos',
  starters: 'plus.free.starters',
};
const FEATURE_KEYS: Record<PlusFeatureId, MessageKey> = {
  library: 'plus.feature.library',
  outline: 'plus.feature.outline',
};
const TIP_KEYS: Record<TipAmountId, MessageKey> = {
  small: 'plus.tip.small',
  medium: 'plus.tip.medium',
  large: 'plus.tip.large',
};

export default function PlusScreen() {
  const { c, text } = useThemeV2();
  const { t } = useT();
  const router = useRouter();
  const plus = usePlus();
  const owned = plus.state.owned;
  const price = plus.price ?? PLUS_PRICE;
  const trialLine =
    plus.access.reason === 'owned'
      ? t('plus.trial.owned')
      : plus.access.reason === 'trial'
        ? t('plus.trial.left', { count: plus.access.daysLeft })
        : t('plus.trial.ended');

  const onBuy = async () => {
    select();
    const s = await plus.purchase();
    if (s.owned) tap();
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onRestore = async () => {
    select();
    const s = await plus.restore();
    Alert.alert(
      s.owned ? t('plus.restoredTitle') : t('plus.nothingTitle'),
      s.owned ? t('plus.restoredBody') : t('plus.nothingBody'),
    );
  };

  const onTip = async (id: TipAmountId) => {
    select();
    const r = await plus.tip(id);
    if (r.ok) {
      tap();
      Alert.alert(t('plus.thanksTitle'), t('plus.thanksBody'));
    }
  };

  const onSimulate = async () => {
    select();
    if (owned) await plus.resetMock();
    else await plus.purchase();
  };

  const simulateText = owned ? t('plus.clearSimulated') : t('plus.simulate');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenV2 title={t('common.nav.plus')} onBack={goBack}>
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('callout'), { color: c.muted, marginBottom: spaceV2.x6 }]}>
          {t('plus.intro')}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('headline'), { color: plus.access.reason === 'expired' ? c.graphite : c.ink, marginBottom: spaceV2.x6 }]}
        >
          {trialLine}
        </Text>

        {/* Every tracing tool stays free: listed first. */}
        <InsetGroup header={t('plus.freeTitle')}>
          {FREE_FOREVER_ITEMS.map((item) => (
            <InsetRow
              key={item.id}
              title={t(FREE_KEYS[item.id], { count: STARTER_TEMPLATE_COUNT })}
              icon="check"
              iconFill={c.pastels[3]}
              iconColor={c.ok}
            />
          ))}
        </InsetGroup>

        {/* The one-time extra: a pastel hero card */}
        <BubbleCard fill={c.pastels[4]} sparkle sparkleColor={c.lilac} padding={spaceV2.x5} style={{ marginBottom: spaceV2.section }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spaceV2.x3, paddingEnd: spaceV2.x6 }}>
            <IconBubble icon="gift" size={40} fill={c.card} color={c.ink} />
            <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[text('title2'), { color: c.graphite, flexShrink: 1 }]}>
              {t('plus.addsTitle')}
            </Text>
          </View>
          <View style={{ marginTop: spaceV2.x4, gap: spaceV2.x2 }}>
            {PLUS_FEATURE_ITEMS.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spaceV2.x2 }}>
                <Feather name="plus" size={18} color={c.ink} accessibilityElementsHidden importantForAccessibility="no" />
                <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.graphite, flex: 1 }]}>
                  {t(FEATURE_KEYS[item.id])}
                </Text>
              </View>
            ))}
          </View>
          <Text
            maxFontSizeMultiplier={maxFontScaleV2}
            style={[text('title3'), { color: c.graphite, fontVariant: ['tabular-nums'], marginTop: spaceV2.x5, marginBottom: spaceV2.x4 }]}
            accessibilityLabel={t('plus.priceLabel', { price })}
          >
            {t('plus.price', { price })}
          </Text>
          {owned ? (
            <View
              accessible
              accessibilityLabel={t('plus.unlockedLabel')}
              style={[
                squircle,
                {
                  minHeight: sizeV2.pill,
                  borderRadius: radiusV2.pill,
                  backgroundColor: c.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: spaceV2.x2,
                  paddingHorizontal: spaceV2.x6,
                  paddingVertical: spaceV2.x3,
                },
              ]}
            >
              <Feather name="check-circle" size={20} color={c.ink} />
              <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), { color: c.ink, flexShrink: 1, textAlign: 'center' }]}>
                {t('plus.unlocked')}
              </Text>
            </View>
          ) : (
            <PillButton
              title={plus.canBuy ? t('plus.buy', { price }) : t('plus.notInExpoGo')}
              onPress={() => {
                onBuy().catch(() => {});
              }}
              disabled={!plus.canBuy || plus.busy || plus.loading}
              haptic="none"
              accessibilityLabel={t('plus.buyLabel')}
              accessibilityHint={t('plus.buyHint')}
            />
          )}
          {/* onRestore plays the selection tick itself. */}
          <PillButton
            title={t('plus.restore')}
            variant="secondary"
            icon="rotate-ccw"
            block
            haptic="none"
            onPress={onRestore}
            disabled={plus.busy || plus.loading}
            accessibilityHint={t('plus.restoreHint')}
            style={{ marginTop: spaceV2.x3, backgroundColor: c.card }}
          />
          {__DEV__ ? (
            <Pressable
              onPress={onSimulate}
              disabled={plus.busy}
              accessibilityRole="button"
              accessibilityLabel={simulateText}
              style={{ minHeight: sizeV2.touch, alignItems: 'center', justifyContent: 'center', marginTop: spaceV2.x2 }}
            >
              <Text
                maxFontSizeMultiplier={maxFontScaleV2}
                style={[text('subhead'), { color: c.muted, textDecorationLine: 'underline', textAlign: 'center' }]}
              >
                {simulateText}
              </Text>
            </Pressable>
          ) : null}
          {__DEV__ ? (
            <Pressable
              onPress={() => {
                plus.setTrialEnded(plus.access.reason !== 'expired').catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityLabel={plus.access.reason === 'expired' ? t('plus.resetTrial') : t('plus.endTrial')}
              style={{ minHeight: sizeV2.touch, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                maxFontSizeMultiplier={maxFontScaleV2}
                style={[text('subhead'), { color: c.muted, textDecorationLine: 'underline', textAlign: 'center' }]}
              >
                {plus.access.reason === 'expired' ? t('plus.resetTrial') : t('plus.endTrial')}
              </Text>
            </Pressable>
          ) : null}
        </BubbleCard>

        {/* Tip jar: test builds only until tips are real store items. */}
        {__DEV__ && !plus.canBuy ? (
        <BubbleCard padding={spaceV2.x5} style={{ marginBottom: spaceV2.section }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[text('title3'), { color: c.graphite }]}>
            {t('plus.tipJarTitle')}
          </Text>
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.muted, marginTop: spaceV2.x2, marginBottom: spaceV2.x4 }]}>
            {t('plus.tipJarBody')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.x2 }}>
            {TIP_OPTIONS.map((tip) => {
              const label = t(TIP_KEYS[tip.id]);
              return (
                // onTip plays the selection tick itself.
                <PressableScale
                  key={tip.id}
                  onPress={() => {
                    onTip(tip.id).catch(() => {});
                  }}
                  haptic="none"
                  scaleTo={pressScaleV2}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={t('plus.tipHint')}
                  style={[
                    squircle,
                    {
                      flexGrow: 1,
                      flexBasis: 96,
                      minHeight: sizeV2.touch + 4,
                      borderRadius: radiusV2.pill,
                      backgroundColor: c.inkSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: spaceV2.x3,
                      paddingVertical: spaceV2.x1,
                    },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={maxFontScaleV2}
                    style={[text('subhead'), { color: c.ink, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] }]}
                  >
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </BubbleCard>

        ) : null}
      </ScreenV2>
    </>
  );
}
