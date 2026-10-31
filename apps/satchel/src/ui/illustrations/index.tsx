// T91 (owner-1031 D "less bland"): original spot illustrations for empty states (simple geometric travel motifs,
// no brands or characters). Every colour is a theme token; every illustration is decorative and hidden from screen
// readers. Use through EmptyState's `art` prop (src/ui/kit.tsx) or <SpotArt kind=... /> directly.
// T92: magnifier ('not found'), notebook (journal, ideas), coins (money), clock (time, 'not yet'), lifebuoy (help).
// Every EmptyState must pass `art` (src/ui/illustrations/illustrations.test.ts).
import { Clock } from './Clock.tsx';
import { Coins } from './Coins.tsx';
import { Compass } from './Compass.tsx';
import { Lifebuoy } from './Lifebuoy.tsx';
import { Magnifier } from './Magnifier.tsx';
import { MapPin } from './MapPin.tsx';
import { Notebook } from './Notebook.tsx';
import { Suitcase } from './Suitcase.tsx';
import { Ticket } from './Ticket.tsx';

export type SpotKind = 'suitcase' | 'mapPin' | 'compass' | 'ticket' | 'magnifier' | 'notebook' | 'coins' | 'clock' | 'lifebuoy';
export const SPOT_KINDS: readonly SpotKind[] = ['suitcase', 'mapPin', 'compass', 'ticket', 'magnifier', 'notebook', 'coins', 'clock', 'lifebuoy'];

export function SpotArt({ kind, size = 120 }: { kind: SpotKind; size?: number }) {
  switch (kind) {
    case 'suitcase':
      return <Suitcase size={size} />;
    case 'mapPin':
      return <MapPin size={size} />;
    case 'compass':
      return <Compass size={size} />;
    case 'magnifier':
      return <Magnifier size={size} />;
    case 'notebook':
      return <Notebook size={size} />;
    case 'coins':
      return <Coins size={size} />;
    case 'clock':
      return <Clock size={size} />;
    case 'lifebuoy':
      return <Lifebuoy size={size} />;
    default:
      return <Ticket size={size} />;
  }
}

export { Clock, Coins, Compass, Lifebuoy, Magnifier, MapPin, Notebook, Suitcase, Ticket };
