// The hotel address card body: place name, "Show this to your driver", the local-language address in the largest
// text, then the address in the reader's language, then the phone. Presentational and exported so the low-battery
// essentials screen (T07) can reuse it. Addresses are selectable text (press and hold to copy), never an image;
// with `onCopy` each address also gets a Copy button (the screen does the copying, via src/native/clipboard.ts).
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { LANG_NAMES } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { variantColours, type CardVariant } from './EmergencyCardView.tsx';
import { PressableScale } from './kit.tsx';

export type AddressCardViewProps = {
  variant: CardVariant;
  name: string;
  address?: string;
  localAddress?: string;
  phone?: string;
  /** Shown as a "Call {name}" button when a phone number is present. */
  onCall?: (phone: string) => void;
  /** Smaller type for the essentials screen, where the card shares the screen. */
  compact?: boolean;
  /** Shows a Copy button under each address; called with that address. */
  onCopy?: (text: string) => void;
};

export function AddressCardView({ variant, name, address, localAddress, phone, onCall, compact, onCopy }: AddressCardViewProps) {
  const { t, theme, lang } = useApp();
  const c = variantColours(variant, theme);
  const local = localAddress?.trim();
  const main = address?.trim();
  const tel = phone?.trim();
  const copyButton = (text: string, a11y: string) =>
    onCopy ? (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={t('address.copyHint')}
        onPress={() => onCopy(text)}
        style={{ flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: space.s, borderRadius: radius.m, borderWidth: 1, borderColor: c.muted, paddingHorizontal: space.l }}
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="copy-outline" size={18} color={c.ink} />
        </View>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink }}>{a11y}</Text>
      </PressableScale>
    ) : null;
  const label = (s: string) => <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: c.muted }}>{s}</Text>;
  return (
    <View style={{ gap: compact ? space.m : space.xl }}>
      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: compact ? 22 : 28, color: c.ink }}>
          {name}
        </Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: c.muted }}>{t('address.driverLine')}</Text>
      </View>
      {local ? (
        <View style={{ gap: space.xs }}>
          {label(t('address.localLabel'))}
          <Text selectable maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.bodyBold, fontSize: compact ? 30 : 44, lineHeight: compact ? 40 : 58, color: c.ink }}>
            {local}
          </Text>
          {copyButton(local, t('address.copyLocal'))}
        </View>
      ) : null}
      {main ? (
        <View style={{ gap: space.xs }}>
          {label(local ? t('address.inLanguage', { language: LANG_NAMES[lang] }) : t('address.addressLabel'))}
          <Text selectable maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.bodyBold, fontSize: local ? (compact ? 22 : 28) : compact ? 28 : 38, lineHeight: local ? (compact ? 30 : 38) : compact ? 36 : 50, color: c.ink }}>
            {main}
          </Text>
          {copyButton(main, local ? t('address.copyIn', { language: LANG_NAMES[lang] }) : t('address.copyMain'))}
        </View>
      ) : null}
      {tel ? (
        <View style={{ gap: space.xs }}>
          {label(t('address.phoneLabel'))}
          <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: c.ink, fontVariant: ['tabular-nums'] }}>
            {tel}
          </Text>
          {onCall ? (
            <PressableScale
              animate={variant !== 'essentials'}
              accessibilityRole="button"
              accessibilityLabel={t('address.callPlace', { name })}
              accessibilityHint={t('address.callPlaceHint')}
              onPress={() => onCall(tel)}
              style={{ borderRadius: radius.m, borderWidth: 1, borderColor: c.ink, paddingHorizontal: space.l, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink }}>{t('address.callPlace', { name })}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
