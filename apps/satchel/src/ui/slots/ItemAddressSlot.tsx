// Slot on the booking detail screen, owned by T05: hotel address card button on the booking detail.
import { useRouter } from 'expo-router';
import type { Item, Trip } from '../../core/model.ts';
import { useApp } from '../../state/app.tsx';
import { Button } from '../kit.tsx';

const KINDS: readonly Item['kind'][] = ['hotel', 'activity', 'car'];

export function ItemAddressSlot({ item }: { trip: Trip; item: Item }) {
  const { t } = useApp();
  const router = useRouter();
  if (!KINDS.includes(item.kind) || !item.place) return null;
  return <Button label={t('address.show')} hint={t('address.showHint')} onPress={() => router.push({ pathname: '/address/[id]', params: { id: item.id } })} />;
}
