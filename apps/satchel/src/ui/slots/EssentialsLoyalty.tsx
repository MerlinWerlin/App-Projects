// T88: membership cards in Low-battery essentials. One plain row per saved card (Wallet order, expired cards too:
// they still scan), each opening the existing full-brightness card view (app/loyalty/[id].tsx). Pure black, white
// text, no animation, like the rest of the essentials screen. Hidden when no card is saved (nothing is invented).
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { essentialsCards } from '../../core/followups91.ts';
import { useApp } from '../../state/app.tsx';
import { useLoyaltyCards } from '../../state/loyalty.ts';
import { essentials, fonts, radius, space, TOUCH } from '../../theme/tokens.ts';

export function EssentialsLoyalty() {
  const { t } = useApp();
  const router = useRouter();
  const [cards] = useLoyaltyCards();
  const rows = useMemo(() => essentialsCards(cards), [cards]);
  if (!rows.length) return null;
  return (
    <View style={{ gap: space.m, borderTopWidth: 1, borderTopColor: essentials.line, paddingTop: space.l }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, color: essentials.ink }}>
        {t('f91.ess.heading')}
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: essentials.muted }}>{t('f91.ess.body')}</Text>
      {rows.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={t('f91.ess.open', { programme: c.programme })}
          accessibilityHint={[c.tier, c.number, t('f91.ess.openHint')].filter(Boolean).join(', ')}
          onPress={() => router.push({ pathname: '/loyalty/[id]', params: { id: c.id } })}
          style={{ minHeight: TOUCH, borderWidth: 1, borderColor: essentials.ink, borderRadius: radius.m, padding: space.l, gap: space.xs }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: essentials.ink }}>{c.programme}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: essentials.ink, fontVariant: ['tabular-nums'] }}>{c.number}</Text>
          {c.tier ? <Text style={{ fontFamily: fonts.body, fontSize: 17, color: essentials.muted }}>{c.tier}</Text> : null}
          {c.hasPhoto ? <Text style={{ fontFamily: fonts.body, fontSize: 15, color: essentials.muted }}>{t('f91.ess.photo')}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
