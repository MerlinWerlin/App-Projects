// T109 Stay details entry points: the summary text (never a code), the booking-detail card (ItemStaySlot) and the
// row under "Your day" for the stay you're in now (StayBriefRow). Each opens app/stay/[itemId].tsx.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import type { Item } from '../core/model.ts';
import { isEmptyStay, isStay, staySummary, type StayDetails } from '../core/staydetails.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useStayDetails } from '../state/stay.ts';
import { space, typeScale } from '../theme/tokens.ts';
import { SectionCard } from './hero.tsx';
import { PressableScale } from './kit.tsx';

/** "Room 412 · 2 codes · Wi-Fi · House notes", or '' when nothing is saved. Codes are counted, never shown. */
export function staySummaryText(t: T, s: StayDetails): string {
  const m = staySummary(s);
  return [
    m.room ? t('stay.slot.room', { room: m.room }) : '',
    m.codes === 1 ? t('stay.slot.codesOne') : m.codes > 1 ? t('stay.slot.codesMany', { n: m.codes }) : '',
    m.wifi ? t('stay.slot.wifi') : '',
    m.phone ? t('stay.slot.phone') : '',
    m.notes ? t('stay.slot.notes') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const stayName = (item: Item) => item.place?.name?.trim() || item.title;

/** Booking detail: a "Stay details" card on every stay booking. */
export function ItemStaySlot({ item }: { item: Item }) {
  const { t } = useApp();
  const router = useRouter();
  const [details] = useStayDetails(item.id);
  if (!isStay(item)) return null;
  const summary = isEmptyStay(details) ? t('stay.slot.empty') : staySummaryText(t, details);
  return (
    <SectionCard
      title={t('stay.slot.title')}
      subtitle={summary}
      icon="key-outline"
      tone="teal"
      action={{
        label: isEmptyStay(details) ? t('stay.add') : t('stay.slot.open'),
        hint: t('stay.slot.openHint'),
        onPress: () => router.push({ pathname: '/stay/[itemId]', params: { itemId: item.id } }),
      }}
    />
  );
}

/** "Your day": one row for the stay you're in now, on the hero card's colours. */
export function StayBriefRow({ item }: { item: Item }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [details] = useStayDetails(item.id);
  const name = stayName(item);
  const line = isEmptyStay(details) ? t('stay.brief.add', { name }) : t('stay.brief.line', { summary: staySummaryText(t, details) });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('stay.slot.openLabel', { name })}
      accessibilityHint={line}
      onPress={() => router.push({ pathname: '/stay/[itemId]', params: { itemId: item.id } })}
      style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="key-outline" size={18} color={theme.heroAccent} />
      </View>
      <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
        {line}
      </Text>
    </PressableScale>
  );
}
