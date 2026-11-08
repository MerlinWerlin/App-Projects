import { IDENTITY_ART } from './widgetIdentityArt.ts';
import { CALENDARS, GAUGES, HANDS, WIDGET_IDENTITY_RECIPES, type WidgetIdentityRecipe } from './widgetIdentityRecipes.ts';

export type WidgetIdentity = {
  outline: string;
  inner: string;
  hours: string;
  minutes: string;
  cardinals: [number, number, number, number];
  subject: string;
  detail: string;
  hands: WidgetIdentityRecipe[4];
  gauge: WidgetIdentityRecipe[5];
  calendar: WidgetIdentityRecipe[6];
  originalFace?: 'alpine';
};

const format = (n: number) => String(Math.round(n * 100) / 100);
const xy = (x: number, y: number) => `${format(x)} ${format(y)}`;
const TAU = Math.PI * 2;

// Radius to the edge of each authored bezel. Hour marks use the same contour as the rim.
function contour(face: WidgetIdentityRecipe[0], angle: number): number {
  const x = Math.cos(angle), y = Math.sin(angle);
  const superellipse = (power: number) => 1 / Math.pow(Math.pow(Math.abs(x), power) + Math.pow(Math.abs(y), power), 1 / power);
  const polygon = (sides: number) => Math.cos(Math.PI / sides) / Math.cos((angle + TAU * 2) % (TAU / sides) - Math.PI / sides);
  switch (face) {
    case 'square': return superellipse(6);
    case 'arch': return y > 0 ? superellipse(5) * .97 : superellipse(2.35);
    case 'facet': return polygon(8) * (1 + .028 * Math.sin(angle * 3 + .7));
    case 'petal': return .9 + .085 * Math.cos(angle * 6);
    case 'seal': return .95 + .045 * Math.cos(angle * 12);
    case 'lozenge': return superellipse(1.48) * (1 + .045 * Math.sin(angle * 2));
    case 'oval': return 1 / Math.hypot(x, y / .89);
    case 'octagon': return polygon(8);
    case 'pebble': return .93 + .05 * Math.sin(angle * 3 + 1) + .025 * Math.cos(angle * 5);
    case 'shield': return y > 0 ? superellipse(1.52) * (1 + .05 * y) : superellipse(3.6) * .97;
    case 'reel': return .98 + .018 * Math.cos(angle * 8);
    case 'hex': return polygon(6);
    case 'wave': return .94 + .047 * Math.sin(angle * 3) + .018 * Math.cos(angle * 5 + .2);
    default: return 1;
  }
}

function buildIdentity(recipe: WidgetIdentityRecipe, originalFace?: 'alpine'): WidgetIdentity {
  const [face, subject, detail, mark, hands, gauge, calendar] = recipe;
  const edge = (a: number) => 45.5 * contour(face, a);
  const point = (a: number, r: number, tangent = 0) => xy(50 + Math.cos(a) * r - Math.sin(a) * tangent, 50 + Math.sin(a) * r + Math.cos(a) * tangent);
  const rim = (inset: number) => {
    const steps = 96;
    return Array.from({ length: steps }, (_, i) => {
      const a = i * TAU / steps;
      return `${i === 0 ? 'M' : 'L'} ${point(a, edge(a) - inset)}`;
    }).join(' ') + ' Z';
  };
  const hours: string[] = [], minutes: string[] = [];
  for (let index = 0; index < 60; index++) {
    const a = index * TAU / 60 - Math.PI / 2;
    const outer = edge(a) - 2.8;
    if (index % 5 !== 0) {
      minutes.push(`M ${point(a, outer - 1.7)} L ${point(a, outer)}`);
      continue;
    }
    const major = index % 15 === 0;
    const inner = outer - (major ? 6 : 4.1);
    switch (mark) {
      case 'beads': hours.push(`M ${point(a, outer - 2.2, -.45)} L ${point(a, outer - 2.2, .45)}`); break;
      case 'pearls': hours.push(`M ${point(a, outer - 2)} L ${point(a, outer - 2.25)}`); break;
      case 'cut': hours.push(`M ${point(a, outer, -1.3)} L ${point(a, inner)} L ${point(a, outer, 1.3)}`); break;
      case 'pins': hours.push(`M ${point(a, inner)} L ${point(a, outer)} M ${point(a, outer - 1, -1.4)} L ${point(a, outer - 1, 1.4)}`); break;
      case 'dash': hours.push(`M ${point(a, outer - 2, -1.7)} L ${point(a, outer - 2, 1.7)}`); break;
      case 'rays': hours.push(`M ${point(a, inner)} L ${point(a, outer)} M ${point(a, inner + 2, -1.25)} L ${point(a, outer, -1.25)}`); break;
      case 'staples': hours.push(`M ${point(a, inner, -1.2)} L ${point(a, outer, -1.2)} L ${point(a, outer, 1.2)} L ${point(a, inner, 1.2)}`); break;
      default: hours.push(`M ${point(a, inner)} L ${point(a, outer)}`);
    }
  }
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  return {
    outline: rim(0), inner: rim(2), hours: hours.join(' '), minutes: minutes.join(' '),
    cardinals: angles.map(a => Number(format(edge(a) - 13))) as WidgetIdentity['cardinals'],
    subject: IDENTITY_ART[subject], detail: IDENTITY_ART[detail], hands, gauge, calendar,
    ...(originalFace ? { originalFace } : {}),
  };
}

const cache = new Map<string, WidgetIdentity>();
export function identityForTheme(id: string): WidgetIdentity | undefined {
  const recipe = Object.hasOwn(WIDGET_IDENTITY_RECIPES, id) ? WIDGET_IDENTITY_RECIPES[id] : undefined;
  if (!recipe) return undefined;
  const prior = cache.get(id);
  if (prior) return prior;
  const identity = buildIdentity(recipe, id === 'alpine-starlight' ? 'alpine' : undefined);
  cache.set(id, identity);
  return identity;
}

// Paths are authored or generated internally and persisted with the live spec. Only our
// bounded drawing vocabulary may make it from the App Group back into a preview.
export function parseWidgetIdentity(raw: unknown): WidgetIdentity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  for (const key of ['outline', 'inner', 'hours', 'minutes', 'subject', 'detail']) {
    const path = r[key];
    if (typeof path !== 'string' || path.length > 2400 || !/^M [MLQTCZ0-9 .-]+$/.test(path)) return null;
  }
  if (!Array.isArray(r.cardinals) || r.cardinals.length !== 4 || !r.cardinals.every(n => typeof n === 'number' && n >= 17 && n <= 38)) return null;
  if (!HANDS.includes(r.hands as WidgetIdentity['hands']) || !GAUGES.includes(r.gauge as WidgetIdentity['gauge']) || !CALENDARS.includes(r.calendar as WidgetIdentity['calendar'])) return null;
  if (r.originalFace !== undefined && r.originalFace !== 'alpine') return null;
  return {
    outline: r.outline as string, inner: r.inner as string, hours: r.hours as string, minutes: r.minutes as string,
    cardinals: r.cardinals as WidgetIdentity['cardinals'], subject: r.subject as string, detail: r.detail as string,
    hands: r.hands as WidgetIdentity['hands'], gauge: r.gauge as WidgetIdentity['gauge'], calendar: r.calendar as WidgetIdentity['calendar'],
    ...(r.originalFace === 'alpine' ? { originalFace: 'alpine' as const } : {}),
  };
}
