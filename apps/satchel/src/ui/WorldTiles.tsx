// T65 "Your world": an abstract tile grid of visited countries, original SVG art (no map imagery, no flags).
// Five soft region panels sit roughly where the continents are; each visited country is one coloured tile with a
// small geometric mark picked from its code, so it keeps the same look every time. Planned countries are dashed
// outlines. Every colour comes from theme tokens (light and dark). The legend underneath names each tile.
import { memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { REGIONS, tileSeed, type CountryTile, type Region } from '../core/travelstats.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { toneColours, type Tone } from './hero.tsx';
import { displayCountryName } from './useTravelStats.ts';

const W = 320;
const H = 200;
const TILE = 16;
const GAP = 4;
const PAD = 8;
/** Region panels in the 320 x 200 viewBox, placed loosely like a world map. */
const PANELS: Record<Region, { x: number; y: number; w: number; h: number }> = {
  americas: { x: 6, y: 22, w: 88, h: 156 },
  europe: { x: 102, y: 6, w: 96, h: 84 },
  africa: { x: 102, y: 98, w: 96, h: 96 },
  asia: { x: 206, y: 6, w: 108, h: 116 },
  oceania: { x: 226, y: 130, w: 88, h: 64 },
};
const TONES: readonly Tone[] = ['sea', 'teal', 'accent', 'ok', 'warn', 'danger'];

export const tileTone = (iso2: string): Tone => TONES[tileSeed(iso2) % TONES.length];

function Mark({ seed, x, y, colour }: { seed: number; x: number; y: number; colour: string }) {
  const m = Math.floor(seed / TONES.length) % 4;
  if (m === 0) return <Path d={`M${x + 3} ${y + TILE - 3} L${x + TILE - 3} ${y + 3}`} stroke={colour} strokeWidth={2} strokeLinecap="round" />;
  if (m === 1) return <Circle cx={x + TILE / 2} cy={y + TILE / 2} r={3} fill={colour} />;
  if (m === 2) return <Rect x={x + 3} y={y + TILE / 2} width={TILE - 6} height={TILE / 2 - 3} rx={1.5} fill={colour} />;
  return <Rect x={x + 5} y={y + 5} width={TILE - 10} height={TILE - 10} rx={1} fill="none" stroke={colour} strokeWidth={1.6} />;
}

export const WorldTiles = memo(function WorldTiles({ tiles, compact = false }: { tiles: CountryTile[]; compact?: boolean }) {
  const { theme, t, lang } = useApp();
  const countryName = (iso2: string) => displayCountryName(iso2, lang);
  const visited = tiles.filter((x) => !x.planned);
  const planned = tiles.filter((x) => x.planned);
  const label = [
    visited.length ? t('travels.world.a11y', { list: visited.map((x) => countryName(x.iso2)).join(', ') }) : t('travels.world.a11yNone'),
    planned.length ? t('travels.world.a11yPlanned', { list: planned.map((x) => countryName(x.iso2)).join(', ') }) : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cells: ReactNode[] = [];
  for (const region of REGIONS) {
    const p = PANELS[region];
    const cols = Math.max(1, Math.floor((p.w - 2 * PAD + GAP) / (TILE + GAP)));
    const rows = Math.max(1, Math.floor((p.h - 2 * PAD + GAP) / (TILE + GAP)));
    const cap = cols * rows;
    const mine = tiles.filter((x) => x.region === region);
    const shown = mine.length > cap ? mine.slice(0, cap - 1) : mine;
    const at = (i: number) => ({ x: p.x + PAD + (i % cols) * (TILE + GAP), y: p.y + PAD + Math.floor(i / cols) * (TILE + GAP) });
    cells.push(<Rect key={`p-${region}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={14} fill={theme.paper} stroke={theme.line} strokeWidth={1} />);
    if (!mine.length) {
      // faint ghost tiles keep an empty region from looking broken
      for (let i = 0; i < Math.min(3, cap); i++) {
        const { x, y } = at(i);
        cells.push(<Rect key={`g-${region}-${i}`} x={x} y={y} width={TILE} height={TILE} rx={4} fill="none" stroke={theme.line} strokeWidth={1} strokeDasharray={[2, 3]} />);
      }
    }
    shown.forEach((tile, i) => {
      const { x, y } = at(i);
      const seed = tileSeed(tile.iso2);
      const { fg, bg } = toneColours(theme, tileTone(tile.iso2));
      cells.push(
        tile.planned ? (
          <Rect key={tile.iso2} x={x} y={y} width={TILE} height={TILE} rx={4} fill={theme.card} stroke={theme.muted} strokeWidth={1.4} strokeDasharray={[3, 2]} />
        ) : (
          <G key={tile.iso2}>
            <Rect x={x} y={y} width={TILE} height={TILE} rx={4} fill={bg} stroke={fg} strokeWidth={1.4} />
            <Mark seed={seed} x={x} y={y} colour={fg} />
          </G>
        ),
      );
    });
    if (mine.length > cap) {
      const { x, y } = at(cap - 1);
      cells.push(
        <G key={`more-${region}`}>
          <Rect x={x} y={y} width={TILE} height={TILE} rx={4} fill={theme.line} />
          <Path d={`M${x + 4} ${y + TILE / 2} H${x + TILE - 4} M${x + TILE / 2} ${y + 4} V${y + TILE - 4}`} stroke={theme.ink} strokeWidth={1.8} strokeLinecap="round" />
        </G>,
      );
    }
  }

  return (
    <View style={{ gap: space.m }}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: '100%', aspectRatio: W / H }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {cells}
        </Svg>
      </View>
      {!compact && tiles.length ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {tiles.map((tile) => {
            const { fg, bg } = toneColours(theme, tileTone(tile.iso2));
            return (
              <View
                key={tile.iso2}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.xs,
                  paddingHorizontal: space.s,
                  paddingVertical: space.xs,
                  borderRadius: radius.pill,
                  backgroundColor: tile.planned ? theme.card : bg,
                  borderWidth: 1,
                  borderColor: tile.planned ? theme.muted : fg,
                  borderStyle: tile.planned ? 'dashed' : 'solid',
                }}
              >
                <Text style={[typeScale.small, { color: tile.planned ? theme.muted : theme.ink }]}>
                  {countryName(tile.iso2)}
                  {tile.planned ? ` · ${t('travels.world.planned')}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});
