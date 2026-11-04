// T87 loyalty card pieces shared by the Wallet section, the card view, the editor preview and the booking shortcut.
// The card face is an original look (token paint, two soft wash shapes, a kind glyph): never a brand logo, and the
// programme name is exactly what the user typed.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { deviceZone, todayIn } from '../core/format.ts';
import { cardExpiry, displayNumber, sortCards, type CardColour, type LoyaltyCard, type LoyaltyKind } from '../core/loyalty.ts';
import { formatExpiry, type Expiry } from '../core/vault.ts';
import type { T } from '../i18n/core.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { useLoyaltyCards } from '../state/loyalty.ts';
import { cardPaint, elevated, fonts, radius, shadowOf, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge } from './hero.tsx';
import { Button, PressableScale } from './kit.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const LOYALTY_ICON: Record<LoyaltyKind, IconName> = {
  air: 'airplane',
  hotel: 'bed',
  rail: 'train',
  car: 'car',
  other: 'card',
};
export const loyaltyKindKey = (k: LoyaltyKind): Key => `loyalty.kind.${k}` as Key;
export const colourKey = (c: CardColour): Key => `loyalty.colour.${c}` as Key;

/** Gentle expiry wording (null when the card has no expiry). Same text on screen and for screen readers. */
export function cardExpiryText(t: T, e: Expiry, expires: string | undefined, lang: string): string | null {
  const date = expires ? formatExpiry(expires, lang) : '';
  switch (e.status) {
    case 'expired':
      return t('loyalty.expiry.expired', { date });
    case 'soon':
      if (e.days === 0) return t('loyalty.expiry.today');
      if (e.days === 1) return t('loyalty.expiry.tomorrow');
      return t('loyalty.expiry.soon', { n: e.days ?? 0, date });
    case 'ok':
      return t('loyalty.expiry.ok', { date });
    default:
      return null;
  }
}

/** What a screen reader hears for a card row. */
export const cardA11y = (t: T, c: LoyaltyCard) => t('loyalty.open', { programme: c.programme, kind: t(loyaltyKindKey(c.kind)), number: displayNumber(c.number) });

/**
 * The card itself. `size="full"` for the card view and the editor preview, `"compact"` for Wallet rows.
 * Decorative only: the surrounding control names it to screen readers.
 */
export const LoyaltyCardFace = memo(function LoyaltyCardFace({ card, size = 'compact' }: { card: Pick<LoyaltyCard, 'kind' | 'programme' | 'memberName' | 'number' | 'tier' | 'expires' | 'colour'>; size?: 'compact' | 'full' }) {
  const { t, theme, lang } = useApp();
  const paint = cardPaint(theme, card.colour);
  const full = size === 'full';
  const expiry = cardExpiry(card, todayIn(deviceZone()));
  const note = cardExpiryText(t, expiry, card.expires, lang);
  const flagged = expiry.status === 'expired' || expiry.status === 'soon';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { backgroundColor: paint.fill, borderRadius: radius.l, overflow: 'hidden', padding: full ? space.xl : space.l, gap: full ? space.m : space.s, minHeight: full ? 200 : 112 },
        shadowOf(theme, full ? 'mid' : 'low'),
      ]}
    >
      <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: 'absolute', right: -70, top: -80 }}>
        <Circle cx={110} cy={110} r={110} fill={paint.wash} />
        <Circle cx={60} cy={170} r={56} fill={paint.wash} />
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Ionicons name={LOYALTY_ICON[card.kind]} size={full ? 22 : 18} color={paint.ink} />
        <Text style={[typeScale.caption, { color: paint.muted, flex: 1 }]} numberOfLines={1}>
          {t(loyaltyKindKey(card.kind))}
        </Text>
        {card.tier ? (
          <View style={{ borderWidth: 1, borderColor: paint.muted, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: paint.ink }} numberOfLines={1}>
              {card.tier}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[full ? typeScale.displayL : typeScale.displayM, { color: paint.ink }]} numberOfLines={2}>
        {card.programme}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={{ fontFamily: fonts.display, fontSize: full ? 24 : 18, letterSpacing: 1, color: paint.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
        {displayNumber(card.number)}
      </Text>
      {card.memberName || note ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          {card.memberName ? (
            <Text style={[typeScale.small, { color: paint.muted, flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {card.memberName}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {note ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              {flagged ? <Ionicons name="time-outline" size={14} color={paint.ink} /> : null}
              <Text style={[typeScale.small, { color: flagged ? paint.ink : paint.muted, fontFamily: flagged ? fonts.bodyBold : fonts.body }]} numberOfLines={1}>
                {note}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

/** Wallet tab section: header with count, each saved card as a tappable face, and Add a card. */
export function WalletCards() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [cards] = useLoyaltyCards();
  const sorted = useMemo(() => sortCards(cards), [cards]);
  const count = sorted.length === 1 ? t('loyalty.section.countOne') : t('loyalty.section.count', { n: sorted.length });
  return (
    <FadeInView delay={80} style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="card" tone="accent" />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('loyalty.section.title')}
          </Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{sorted.length ? count : t('loyalty.section.subtitle')}</Text>
        </View>
        {sorted.length ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('loyalty.add')}
            accessibilityHint={t('loyalty.addHint')}
            onPress={() => router.push('/loyalty-edit')}
            style={{ minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add-circle" size={30} color={theme.accentInk} />
          </PressableScale>
        ) : null}
      </View>
      {sorted.map((c) => (
        <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={cardA11y(t, c)} accessibilityHint={t('loyalty.openHint')} onPress={() => router.push(`/loyalty/${c.id}`)}>
          <LoyaltyCardFace card={c} />
        </PressableScale>
      ))}
      {!sorted.length ? (
        <View
          style={[
            elevated(theme, 'low'),
            { borderRadius: radius.l, padding: space.l, gap: space.m },
          ]}
        >
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('loyalty.section.emptyTitle')}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('loyalty.section.empty')}</Text>
          <Button icon="add" label={t('loyalty.add')} hint={t('loyalty.addHint')} kind="secondary" onPress={() => router.push('/loyalty-edit')} />
        </View>
      ) : null}
    </FadeInView>
  );
}

/** Booking screen shortcut: "Your <programme> card" for each saved card whose name is in the booking's text. */
export function LoyaltyShortcuts({ cards }: { cards: readonly LoyaltyCard[] }) {
  const { t, theme } = useApp();
  const router = useRouter();
  if (!cards.length) return null;
  return (
    <View style={{ gap: space.s }}>
      {cards.map((c) => {
        const paint = cardPaint(theme, c.colour);
        const label = t('loyalty.item.shortcut', { programme: c.programme });
        return (
          <PressableScale
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${displayNumber(c.number)}`}
            accessibilityHint={t('loyalty.item.shortcutHint')}
            onPress={() => router.push(`/loyalty/${c.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: theme.cardRaised, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, overflow: 'hidden', paddingRight: space.m }}
          >
            <View style={{ alignSelf: 'stretch', width: 44, backgroundColor: paint.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={LOYALTY_ICON[c.kind]} size={20} color={paint.ink} />
            </View>
            <View style={{ flex: 1, paddingVertical: space.s }}>
              <Text style={[typeScale.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
                {label}
              </Text>
              <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {displayNumber(c.number)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.muted} />
          </PressableScale>
        );
      })}
    </View>
  );
}
