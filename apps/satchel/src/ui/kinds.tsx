// Icon and label per booking kind.
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ItemKind } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const KIND_ICON: Record<ItemKind, IconName> = {
  flight: 'airplane-outline',
  train: 'train-outline',
  ferry: 'boat-outline',
  bus: 'bus-outline',
  hotel: 'bed-outline',
  car: 'car-outline',
  activity: 'ticket-outline',
  note: 'document-text-outline',
};

export const kindKey = (k: ItemKind): Key => `kind.${k}` as Key;

/** Form title naming the kind: "New flight", "Edit hotel" (FLOWS §4 shared form behaviour). */
export const formTitleKey = (k: ItemKind, editing: boolean): Key => `spec.itemEdit.${editing ? 'edit' : 'new'}.${k}` as Key;

/** Field labels that read better per kind (FLOWS §4.x): airline vs operator vs hire company, flight vs train number. */
export const carrierKey = (k: ItemKind): Key => (k === 'flight' ? 'spec.item.airline' : k === 'car' ? 'spec.item.company' : 'item.carrier');
export const numberKey = (k: ItemKind): Key => (k === 'flight' ? 'spec.item.flightNumber' : k === 'train' ? 'spec.item.trainNumber' : 'item.number');
export const titleKey = (k: ItemKind): Key =>
  k === 'hotel' ? 'spec.itemEdit.titleHotel' : k === 'activity' ? 'spec.itemEdit.titleActivity' : k === 'note' ? 'spec.itemEdit.titleNote' : 'itemEdit.name';

export function KindIcon({ kind, color, size = 22 }: { kind: ItemKind; color: string; size?: number }) {
  return <Ionicons name={KIND_ICON[kind]} size={size} color={color} />;
}

/** T50: colour family per booking kind (stripe and icon badge tint on tickets and agenda rows). */
export const KIND_TONE: Record<ItemKind, 'sea' | 'teal' | 'ok' | 'warn' | 'accent' | 'ink'> = {
  flight: 'sea',
  train: 'teal',
  ferry: 'sea',
  bus: 'ok',
  hotel: 'accent',
  car: 'warn',
  activity: 'accent',
  note: 'ink',
};
