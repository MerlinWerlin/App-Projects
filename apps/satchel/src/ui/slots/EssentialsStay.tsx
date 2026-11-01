// T109: stay details in Low-battery essentials, for the stay you're in now (src/core/staydetails.ts currentStay):
// room and Wi-Fi name in plain text, every code and the Wi-Fi password masked (essentialsRows), and one button to
// the full stay screen, where a code can be shown. Pure black, white text, no animation. Hidden when nothing is saved.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { currentStay, essentialsRows, isEmptyStay } from '../../core/staydetails.ts';
import type { Key } from '../../i18n/en.ts';
import { useApp } from '../../state/app.tsx';
import { useStayDetails } from '../../state/stay.ts';
import { useTrips } from '../../state/trips.tsx';
import { essentials, fonts, radius, space, TOUCH } from '../../theme/tokens.ts';

const FIELD_KEY: Record<ReturnType<typeof essentialsRows>[number]['field'], Key> = {
  room: 'stay.room',
  doorCode: 'stay.code.doorCode',
  keyboxCode: 'stay.code.keyboxCode',
  gateCode: 'stay.code.gateCode',
  wifiName: 'stay.wifiName',
  wifiPassword: 'stay.wifiPassword',
};

export function EssentialsStay({ now }: { now: number }) {
  const { t } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const pick = useMemo(() => currentStay(trips, now), [trips, now]);
  const [details] = useStayDetails(pick?.item.id ?? '');
  if (!pick || isEmptyStay(details)) return null;
  const name = pick.item.place?.name?.trim() || pick.item.title;
  const rows = essentialsRows(details);
  return (
    <View style={{ gap: space.m, borderTopWidth: 1, borderTopColor: essentials.line, paddingTop: space.l }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, color: essentials.ink }}>
        {t('stay.ess.heading')}
      </Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: essentials.ink }}>{name}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: essentials.muted }}>{t('stay.ess.body')}</Text>
      {rows.map((r) => {
        const label = t(FIELD_KEY[r.field]);
        const masked = r.field !== 'room' && r.field !== 'wifiName';
        return (
          <View key={r.field} accessible accessibilityLabel={masked ? t('stay.code.hidden', { label }) : `${label}, ${r.value}`} style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: essentials.muted }}>{label}</Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: essentials.ink, fontVariant: ['tabular-nums'] }}>{r.value}</Text>
          </View>
        );
      })}
      {/* Same look as EssentialsButton (not imported: EssentialsSlot renders this section). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('stay.ess.open')}
        accessibilityHint={t('stay.ess.openHint', { name })}
        onPress={() => router.push({ pathname: '/stay/[itemId]', params: { itemId: pick.item.id } })}
        hitSlop={8}
        style={{ minHeight: TOUCH, justifyContent: 'center', borderWidth: 1, borderColor: essentials.ink, backgroundColor: essentials.bg, borderRadius: radius.m, paddingHorizontal: space.l, paddingVertical: space.s }}
      >
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: essentials.ink }}>{t('stay.ess.open')}</Text>
      </Pressable>
    </View>
  );
}
