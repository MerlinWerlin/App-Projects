// T87 slot on the booking detail screen: "Your <programme> card" when a saved membership card's programme name
// appears in the booking's title, provider, notes or place (src/core/loyalty.ts cardsForItem).
import { useMemo } from 'react';
import { cardsForItem } from '../../core/loyalty.ts';
import type { Item } from '../../core/model.ts';
import { useLoyaltyCards } from '../../state/loyalty.ts';
import { LoyaltyShortcuts } from '../loyaltyCards.tsx';

export function ItemLoyaltySlot({ item }: { item: Item }) {
  const [cards] = useLoyaltyCards();
  const matches = useMemo(() => cardsForItem(cards, item), [cards, item]);
  return <LoyaltyShortcuts cards={matches} />;
}
