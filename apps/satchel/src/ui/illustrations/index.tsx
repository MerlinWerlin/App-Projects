// T91 (owner-1031 D "less bland"): original spot illustrations for empty states (simple geometric travel motifs,
// no brands or characters). Every colour is a theme token; every illustration is decorative and hidden from screen
// readers. Use through EmptyState's `art` prop (src/ui/kit.tsx) or <SpotArt kind=... /> directly.
import { Compass } from './Compass.tsx';
import { MapPin } from './MapPin.tsx';
import { Suitcase } from './Suitcase.tsx';
import { Ticket } from './Ticket.tsx';

export type SpotKind = 'suitcase' | 'mapPin' | 'compass' | 'ticket';
export const SPOT_KINDS: readonly SpotKind[] = ['suitcase', 'mapPin', 'compass', 'ticket'];

export function SpotArt({ kind, size = 120 }: { kind: SpotKind; size?: number }) {
  switch (kind) {
    case 'suitcase':
      return <Suitcase size={size} />;
    case 'mapPin':
      return <MapPin size={size} />;
    case 'compass':
      return <Compass size={size} />;
    default:
      return <Ticket size={size} />;
  }
}

export { Compass, MapPin, Suitcase, Ticket };
