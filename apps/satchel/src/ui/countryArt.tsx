// Destination themes (src/core/countrytheme.ts): the small header motif drawn into a hero banner for each themed
// country, and the particle glyphs the ambient layer drifts (src/ui/AmbientLayer.tsx). Simple hand-drawn shapes in
// the hero wash with the country's two soft paints at low opacity, so the banner text stays the thing you read.
// Decorative only: hidden from screen readers. Solid fills with fillOpacity (no gradients, no <Pattern>).
import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { MotifId, ParticleShape } from '../core/countrytheme.ts';
import { useApp } from '../state/app.tsx';

/** A five-pointed maple leaf, centred on 0,0, about 20 across. */
const MAPLE = 'M0 -10 L2 -5 L6 -7 L5 -2 L9 -1 L5 2 L6 5 L1 4 L0.8 9 L-0.8 9 L-1 4 L-6 5 L-5 2 L-9 -1 L-5 -2 L-6 -7 L-2 -5 Z';
/** A five-point star, centred, about 10 across. */
const STAR = 'M0 -5 L1.2 -1.6 L4.8 -1.5 L1.9 0.6 L2.9 4 L0 2 L-2.9 4 L-1.9 0.6 L-4.8 -1.5 L-1.2 -1.6 Z';
const LEAF = 'M0 -9 C6 -5 6 5 0 9 C-6 5 -6 -5 0 -9 Z';
const PETAL = 'M0 -8 C5 -6 6 2 0 8 C-6 2 -5 -6 -1.2 -7 L0 -5 Z';

/** Five round petals around a centre (frangipani, blossom, marigold, edelweiss). */
function Flower({ x, y, r, fill, centre, opacity = 1 }: { x: number; y: number; r: number; fill: string; centre: string; opacity?: number }) {
  return (
    <G transform={`translate(${x} ${y})`} opacity={opacity}>
      {[0, 72, 144, 216, 288].map((a) => (
        <Ellipse key={a} cx={0} cy={-r * 0.55} rx={r * 0.42} ry={r * 0.6} fill={fill} transform={`rotate(${a})`} />
      ))}
      <Circle r={r * 0.28} fill={centre} />
    </G>
  );
}

/** The country's header art, viewBox 160 x 120, drawn toward the top right of a hero banner. */
export const CountryMotif = memo(function CountryMotif({ motif, paints, width = 160, height = 120 }: { motif: MotifId; paints: readonly [string, string]; width?: number; height?: number }) {
  const { theme } = useApp();
  // Follow-up to design pass 3 (Jared: "couldn't tell it was a Japan theme"): the landmark is drawn solid enough to
  // read at a glance, a pale silhouette with full-strength paints, still behind the banner text.
  const wash = theme.heroMotif;
  const line = theme.heroMuted;
  const [p0, p1] = paints;
  const soft = { fill: p0, fillOpacity: 0.9 } as const;
  const soft1 = { fill: p1, fillOpacity: 0.85 } as const;
  const stroke = { stroke: line, strokeOpacity: 0.9, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {motif === 'fuji' ? (
        <G>
          <Circle cx={124} cy={30} r={17} {...soft} />
          <Path d="M24 118 L88 44 Q98 34 108 44 L166 112 V118 Z" fill={wash} />
          <Path d="M77 57 L88 44 Q98 34 108 44 L119 57 L111 53 L104 60 L97 53 L90 60 L84 54 Z" fill={p1} fillOpacity={0.7} />
          {/* a small torii at the foot */}
          <G {...stroke}>
            <Path d="M30 84 Q44 80 58 84 M33 90 H55 M37 86 V112 M51 86 V112" />
          </G>
          {/* a blossom branch over the corner */}
          <Path d="M160 4 Q136 10 118 6" {...stroke} />
          {[[146, 8], [132, 11], [122, 4], [138, 2]].map(([x, y]) => (
            <Circle key={`${x}`} cx={x} cy={y} r={3.2} fill={p0} fillOpacity={0.85} />
          ))}
        </G>
      ) : null}
      {motif === 'hanok' ? (
        <G>
          <Circle cx={126} cy={28} r={15} {...soft1} />
          <Path d="M28 70 Q86 56 144 70 Q152 66 158 56 Q154 76 142 78 H30 Q18 76 14 56 Q20 66 28 70 Z" fill={wash} />
          <Rect x={40} y={78} width={92} height={30} fill={wash} />
          <Path d="M56 80 V108 M86 80 V108 M116 80 V108 M40 108 H132" {...stroke} />
          {[[30, 40], [22, 50], [38, 52]].map(([x, y]) => (
            <Circle key={`${x}${y}`} cx={x} cy={y} r={3} fill={p0} fillOpacity={0.8} />
          ))}
        </G>
      ) : null}
      {motif === 'pines' ? (
        <G>
          <Path d="M10 112 L58 50 L84 80 L108 46 L160 112 Z" fill={wash} />
          {[[44, 70], [68, 60], [92, 74]].map(([x, y]) => (
            <Path key={x} d={`M${x} ${y} L${x + 12} ${y + 22} H${x + 5} L${x + 14} ${y + 38} H${x - 14} L${x - 5} ${y + 22} H${x - 12} Z`} fill={wash} />
          ))}
          <G transform="translate(128 34) scale(2.1) rotate(-12)">
            <Path d={MAPLE} {...soft} fillOpacity={0.7} />
          </G>
        </G>
      ) : null}
      {motif === 'eiffel' ? (
        <G>
          <Circle cx={66} cy={30} r={14} {...soft1} />
          <Path d="M103 4 H107 L110 42 H116 V48 H112 L130 116 H118 Q105 86 92 116 H80 L98 48 H94 V42 H100 Z" fill={wash} />
          <Path d="M94 48 H116 M88 80 H122" {...stroke} />
          {[[30, 100], [42, 94], [54, 102], [146, 98], [136, 92]].map(([x, y]) => (
            <G key={`${x}`}>
              <Path d={`M${x} ${y + 14} V${y}`} {...stroke} strokeWidth={1.5} />
              <Ellipse cx={x} cy={y} rx={2.6} ry={6} {...soft} fillOpacity={0.75} />
            </G>
          ))}
        </G>
      ) : null}
      {motif === 'arches' ? (
        <G>
          <Rect x={36} y={60} width={124} height={56} fill={wash} />
          {[44, 76, 108, 140].map((x) => (
            <Path key={x} d={`M${x} 116 V86 A12 12 0 0 1 ${x + 24} 86 V116`} {...stroke} />
          ))}
          <Path d="M36 72 H160" {...stroke} />
          <G transform="translate(126 28) rotate(-20)">
            <Ellipse rx={13} ry={10} fill={p0} fillOpacity={0.75} />
            <Path d="M10 -6 C18 -14 26 -10 28 -4 C20 -2 14 -2 10 -6 Z" fill={line} fillOpacity={0.45} />
          </G>
        </G>
      ) : null}
      {motif === 'clocktower' ? (
        <G>
          <Path d="M24 56 Q24 42 38 42 Q42 28 58 30 Q70 22 80 34 Q94 34 94 48 Q94 56 86 56 Z" fill={wash} />
          <Rect x={102} y={36} width={26} height={84} fill={wash} />
          <Path d="M100 36 L115 4 L130 36 Z" fill={wash} />
          <Circle cx={115} cy={52} r={9} fill={p1} fillOpacity={0.75} />
          <Path d="M115 52 V46 M115 52 L119 54" stroke={theme.hero.trips[0]} strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M102 70 H128 M102 90 H128" {...stroke} />
          {[[40, 66], [56, 74], [72, 64], [64, 86], [48, 90]].map(([x, y]) => (
            <Path key={`${x}${y}`} d={`M${x} ${y} q2.5 4 0 6 q-2.5 -2 0 -6 Z`} fill={p0} fillOpacity={0.8} />
          ))}
        </G>
      ) : null}
      {motif === 'skyline' ? (
        <G>
          {[[40, 78, 16], [58, 64, 14], [92, 70, 18], [112, 56, 14], [128, 84, 22], [144, 66, 16]].map(([x, y, w]) => (
            <Rect key={x} x={x} y={y} width={w} height={120 - y} fill={wash} />
          ))}
          <Path d="M74 120 V40 H80 V26 H84 V8 H86 V26 H90 V40 H96 V120 Z" fill={wash} />
          {[[30, 26, 1], [56, 14, 0.8], [118, 22, 1.2], [146, 36, 0.9], [138, 10, 0.7]].map(([x, y, s]) => (
            <Path key={x} d={STAR} transform={`translate(${x} ${y}) scale(${s})`} fill={p0} fillOpacity={0.85} />
          ))}
        </G>
      ) : null}
      {motif === 'sails' ? (
        <G>
          <Circle cx={130} cy={26} r={14} {...soft} />
          <Path d="M30 96 Q46 62 76 54 Q64 76 66 96 Z M60 96 Q78 58 112 48 Q96 74 100 96 Z M92 96 Q110 66 140 62 Q126 80 132 96 Z" fill={wash} stroke={p1} strokeOpacity={0.5} strokeWidth={1.5} />
          <Rect x={22} y={96} width={128} height={6} rx={2} fill={wash} />
          <Path d="M14 110 Q30 106 46 110 T78 110 T110 110 T142 110" {...stroke} />
        </G>
      ) : null}
      {motif === 'fern' ? (
        <G>
          <Path d="M60 118 C60 80 74 56 100 52 C120 50 128 66 116 74 C106 80 98 70 106 64" {...stroke} stroke={p0} strokeOpacity={0.75} strokeWidth={3} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Path key={i} d={`M${61 + i * 4} ${108 - i * 12} q-14 -4 -20 -12 M${62 + i * 4} ${106 - i * 12} q12 -8 14 -18`} {...stroke} stroke={p0} strokeOpacity={0.55} />
          ))}
          {/* the Southern Cross */}
          {[[132, 14, 1.1], [124, 40, 1], [146, 30, 0.9], [112, 26, 0.8], [136, 34, 0.5]].map(([x, y, s]) => (
            <Path key={`${x}${y}`} d={STAR} transform={`translate(${x} ${y}) scale(${s})`} fill={p1} fillOpacity={0.9} />
          ))}
        </G>
      ) : null}
      {motif === 'spire' ? (
        <G>
          <Circle cx={60} cy={34} r={14} {...soft} />
          <Path d="M110 2 L113 30 Q128 44 130 64 H90 Q92 44 107 30 Z" fill={wash} />
          <Rect x={84} y={64} width={52} height={10} fill={wash} />
          <Rect x={76} y={74} width={68} height={12} fill={wash} />
          <Rect x={66} y={86} width={88} height={34} fill={wash} />
          <Path d="M98 46 H122 M90 64 H130" {...stroke} />
          <Path d="M98 120 V102 Q110 92 122 102 V120" {...stroke} />
        </G>
      ) : null}
      {motif === 'splitgate' ? (
        <G>
          <Path d="M58 118 V60 H64 V44 H70 V28 H76 V12 H82 L84 118 Z" fill={wash} />
          <Path d="M152 118 V60 H146 V44 H140 V28 H134 V12 H128 L126 118 Z" fill={wash} />
          <Path d="M64 60 H84 M70 44 H84 M126 60 H146 M126 44 H140" {...stroke} />
          <Flower x={105} y={34} r={11} fill={p0} centre={theme.heroAccent} opacity={0.85} />
          <Flower x={28} y={22} r={8} fill={p1} centre={theme.heroAccent} opacity={0.6} />
        </G>
      ) : null}
      {motif === 'picado' ? (
        <G>
          <Path d="M50 8 Q104 26 160 10" {...stroke} />
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 56 + i * 21;
            const y = 14 + Math.sin((i / 4) * Math.PI) * 9;
            return (
              <Path
                key={i}
                d={`M${x} ${y} H${x + 16} V${y + 18} q-2 3 -4 0 q-2 3 -4 0 q-2 3 -4 0 q-2 3 -4 0 Z`}
                fill={i % 2 ? p1 : p0}
                fillOpacity={0.6}
              />
            );
          })}
          <Path d="M124 118 V72 Q124 64 131 64 Q138 64 138 72 V118 Z M138 92 H146 V80 Q146 74 151 76 V98 H138 M124 98 H116 V86 Q112 82 110 88 V104 H124" fill={wash} />
        </G>
      ) : null}
      {motif === 'fan' ? (
        <G>
          <Path d="M108 104 L58 78 A56 56 0 0 1 158 78 Z" fill={wash} />
          {[-62, -40, -18, 4, 26, 48].map((a) => (
            <Path key={a} d="M0 0 V-52" transform={`translate(108 104) rotate(${a})`} {...stroke} strokeWidth={1.5} />
          ))}
          <Circle cx={142} cy={28} r={11} fill={p0} fillOpacity={0.7} />
          <Path d="M142 17 C146 9 154 9 156 13 C150 15 146 17 142 17 Z" fill={line} fillOpacity={0.45} />
          <Flower x={120} y={18} r={7} fill={p1} centre={theme.heroAccent} opacity={0.8} />
        </G>
      ) : null}
      {motif === 'dome' ? (
        <G>
          <Rect x={70} y={64} width={72} height={56} fill={wash} />
          <Path d="M82 64 A24 24 0 0 1 130 64 Z" fill={p0} fillOpacity={0.75} />
          <Path d="M106 40 V30 M101 34 H111" {...stroke} />
          <Path d="M96 120 V96 Q106 86 116 96 V120" {...stroke} />
          <Path d="M10 30 Q40 22 66 36" {...stroke} />
          {[[22, 26, 30], [36, 24, -20], [50, 28, 40], [60, 34, -30]].map(([x, y, r]) => (
            <G key={x} transform={`translate(${x} ${y}) rotate(${r}) scale(0.6)`}>
              <Path d={LEAF} fill={line} fillOpacity={0.45} />
            </G>
          ))}
        </G>
      ) : null}
      {motif === 'conehat' ? (
        <G>
          <Path d="M54 84 L98 26 Q100 24 102 26 L146 84 Q100 96 54 84 Z" fill={p1} fillOpacity={0.45} />
          <Path d="M76 58 Q100 64 124 58 M64 72 Q100 80 136 72" {...stroke} />
          <Path d="M30 0 V16" {...stroke} strokeWidth={1.5} />
          <Ellipse cx={30} cy={28} rx={10} ry={12} fill={p0} fillOpacity={0.7} />
          <Path d="M24 40 H36 M30 40 V48" {...stroke} strokeWidth={1.5} />
        </G>
      ) : null}
      {motif === 'tram' ? (
        <G>
          <Path d="M66 54 H140 Q146 54 146 60 V104 H60 V60 Q60 54 66 54 Z" fill={p0} fillOpacity={0.6} />
          {[68, 88, 108, 128].map((x) => (
            <Rect key={x} x={x} y={62} width={12} height={14} rx={2} fill={wash} />
          ))}
          <Path d="M100 54 L112 34 L124 34 M104 30 H132" {...stroke} />
          <Circle cx={76} cy={106} r={5} fill={wash} />
          <Circle cx={130} cy={106} r={5} fill={wash} />
          <Path d="M40 113 H160" {...stroke} />
          {[[24, 16], [40, 16], [24, 32], [40, 32]].map(([x, y]) => (
            <Rect key={`${x}${y}`} x={x} y={y} width={14} height={14} rx={2} fill={p1} fillOpacity={0.45} />
          ))}
        </G>
      ) : null}
      {motif === 'gate' ? (
        <G>
          <Rect x={50} y={48} width={104} height={12} fill={wash} />
          <Path d="M58 48 L102 38 L146 48 Z" fill={wash} />
          {[56, 74, 92, 112, 130, 146].map((x) => (
            <Rect key={x} x={x} y={60} width={6} height={60} fill={wash} />
          ))}
          <Path d="M94 38 Q100 24 110 30 L106 38" fill={p0} fillOpacity={0.7} />
          {[[128, 14], [144, 24], [152, 8]].map(([x, y], i) => (
            <G key={x} transform={`translate(${x} ${y}) rotate(${i * 40}) scale(0.7)`}>
              <Path d={LEAF} fill={p0} fillOpacity={0.7} />
            </G>
          ))}
        </G>
      ) : null}
      {motif === 'castle' ? (
        <G>
          <Path d="M0 120 Q40 88 80 104 Q120 84 160 98 V120 Z" fill={wash} />
          <Path d="M104 96 V40 H108 V34 H114 V40 H118 V34 H124 V40 H128 V34 H134 V96 Z" fill={wash} />
          <Path d="M115 96 V84 Q119 78 123 84 V96 M115 54 V62" {...stroke} />
          <G transform="translate(52 34)" fill={p0} fillOpacity={0.75}>
            <Circle cx={0} cy={-6} r={6} />
            <Circle cx={-6} cy={2} r={6} />
            <Circle cx={6} cy={2} r={6} />
            <Path d="M0 2 Q2 12 -2 18" stroke={p0} strokeOpacity={0.75} strokeWidth={2} fill="none" />
          </G>
        </G>
      ) : null}
      {motif === 'windmill' ? (
        <G>
          <Path d="M96 120 L102 54 H122 L128 120 Z" fill={wash} />
          <Path d="M98 54 L112 42 L126 54 Z" fill={wash} />
          <G transform="translate(112 48) rotate(20)">
            {[0, 90, 180, 270].map((a) => (
              <Rect key={a} x={-3} y={-36} width={6} height={34} fill={wash} stroke={line} strokeOpacity={0.5} strokeWidth={1} transform={`rotate(${a})`} />
            ))}
            <Circle r={3} fill={line} fillOpacity={0.6} />
          </G>
          {[30, 44, 58].map((x, i) => (
            <G key={x}>
              <Path d={`M${x} 120 V104`} {...stroke} strokeWidth={1.5} />
              <Path d={`M${x - 5} 96 L${x - 5} 104 Q${x} 108 ${x + 5} 104 L${x + 5} 96 L${x + 2} 99 L${x} 95 L${x - 2} 99 Z`} fill={i === 1 ? p1 : p0} fillOpacity={0.75} />
            </G>
          ))}
        </G>
      ) : null}
      {motif === 'peak' ? (
        <G>
          <Path d="M40 120 L92 18 L100 24 L106 20 L160 112 V120 Z" fill={wash} />
          <Path d="M80 42 L92 18 L100 24 L106 20 L120 46 L110 40 L102 48 L94 40 Z" fill={p0} fillOpacity={0.8} />
          <Path d="M20 30 L152 6" {...stroke} strokeWidth={1.2} />
          <Rect x={52} y={20} width={14} height={10} rx={2} fill={wash} stroke={line} strokeOpacity={0.5} />
          <Flower x={28} y={96} r={8} fill={p1} centre={theme.heroAccent} opacity={0.8} />
        </G>
      ) : null}
      {motif === 'taj' ? (
        <G>
          <Path d="M100 4 V12 M100 12 Q100 18 92 26 Q80 38 84 54 H116 Q120 38 108 26 Q100 18 100 12" fill={wash} />
          <Rect x={72} y={54} width={56} height={66} fill={wash} />
          <Path d="M90 120 V90 Q100 74 110 90 V120" {...stroke} />
          <Rect x={56} y={44} width={6} height={76} fill={wash} />
          <Rect x={138} y={44} width={6} height={76} fill={wash} />
          <Circle cx={59} cy={42} r={4} fill={wash} />
          <Circle cx={141} cy={42} r={4} fill={wash} />
          <Flower x={138} y={16} r={9} fill={p0} centre={theme.heroAccent} opacity={0.8} />
        </G>
      ) : null}
      {motif === 'supertree' ? (
        <G>
          {[[80, 52, 1], [112, 34, 1.25], [140, 60, 0.9]].map(([x, y, s]) => (
            <G key={x}>
              <Path d={`M${x - 3 * s} 120 L${x - 2 * s} ${y + 20} L${x - 16 * s} ${y + 4} H${x + 16 * s} L${x + 2 * s} ${y + 20} L${x + 3 * s} 120 Z`} fill={wash} />
              <Ellipse cx={x} cy={y + 2} rx={18 * s} ry={5 * s} fill={p1} fillOpacity={0.5} />
            </G>
          ))}
          <Path d={PETAL} transform="translate(40 30) scale(1.4) rotate(-20)" fill={p0} fillOpacity={0.75} />
          <Path d={PETAL} transform="translate(30 40) scale(1.1) rotate(50)" fill={p0} fillOpacity={0.6} />
        </G>
      ) : null}
      {motif === 'palm' ? (
        <G>
          <Circle cx={134} cy={28} r={14} {...soft1} />
          <Ellipse cx={100} cy={118} rx={58} ry={14} fill={wash} />
          <Path d="M100 108 Q96 74 86 48" {...stroke} strokeWidth={4} />
          {[[-56, -30], [-20, -40], [20, -36], [50, -16], [-40, 6]].map(([dx, dy]) => (
            <Path key={`${dx}`} d={`M86 48 q${dx / 2} ${dy - 10} ${dx} ${dy + 14}`} {...stroke} strokeWidth={3} />
          ))}
          <Flower x={40} y={92} r={10} fill={p0} centre={theme.heroAccent} opacity={0.8} />
        </G>
      ) : null}
      {motif === 'aurora' ? (
        <G>
          <Path d="M0 40 Q40 10 80 30 T160 20 V36 Q120 46 80 44 T0 56 Z" fill={p0} fillOpacity={0.35} />
          <Path d="M10 62 Q50 36 96 52 T160 44 V54 Q120 64 96 62 T10 72 Z" fill={p1} fillOpacity={0.3} />
          <Path d="M20 120 L64 80 L84 96 L112 70 L160 112 V120 Z" fill={wash} />
          <Path d="M104 78 L112 70 L120 78 Z" fill={line} fillOpacity={0.5} />
        </G>
      ) : null}
      {motif === 'balloons' ? (
        <G>
          <Path d="M0 120 Q30 96 60 108 Q92 86 124 104 Q144 94 160 100 V120 Z" fill={wash} />
          {([[120, 30, 16, p0], [72, 22, 11, p1], [148, 64, 9, p0]] as const).map(([x, y, r, c]) => (
            <G key={x}>
              <Path d={`M${x} ${y + r * 1.4} C${x - r * 1.6} ${y + r * 0.4} ${x - r * 1.2} ${y - r * 1.2} ${x} ${y - r * 1.2} C${x + r * 1.2} ${y - r * 1.2} ${x + r * 1.6} ${y + r * 0.4} ${x} ${y + r * 1.4} Z`} fill={c} fillOpacity={0.65} />
              <Rect x={x - r * 0.25} y={y + r * 1.7} width={r * 0.5} height={r * 0.4} fill={line} fillOpacity={0.6} />
            </G>
          ))}
        </G>
      ) : null}
    </Svg>
  );
});

/** One ambient particle, drawn in a size x size box. Decorative. */
export const ParticleGlyph = memo(function ParticleGlyph({ shape, paint, size, accent }: { shape: ParticleShape; paint: string; size: number; accent: string }) {
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shape === 'petal' ? <Path d={PETAL} fill={paint} /> : null}
      {shape === 'maple' ? <Path d={MAPLE} fill={paint} /> : null}
      {shape === 'leaf' ? (
        <G>
          <Path d={LEAF} fill={paint} />
          <Path d="M0 -7 V7" stroke={accent} strokeOpacity={0.35} strokeWidth={0.8} />
        </G>
      ) : null}
      {shape === 'snow' ? (
        <G>
          <Circle r={4} fill={paint} />
          <Circle r={7} fill={paint} fillOpacity={0.25} />
        </G>
      ) : null}
      {shape === 'star' ? <Path d={STAR} transform="scale(1.6)" fill={paint} /> : null}
      {shape === 'glow' ? (
        <G>
          <Circle r={8} fill={paint} fillOpacity={0.25} />
          <Circle r={3.2} fill={paint} />
        </G>
      ) : null}
      {shape === 'sprig' ? (
        <G>
          <Path d="M0 9 V-6" stroke={paint} strokeWidth={1.2} />
          {[-6, -2, 2, 6].map((y) => (
            <Ellipse key={y} cx={y % 4 === 0 ? 1.6 : -1.6} cy={y - 1} rx={1.8} ry={2.6} fill={paint} />
          ))}
        </G>
      ) : null}
      {shape === 'lemon' ? <Ellipse rx={8} ry={6} fill={paint} /> : null}
      {shape === 'drop' ? <Path d="M0 -9 C4 -2 6 2 6 4 A6 6 0 0 1 -6 4 C-6 2 -4 -2 0 -9 Z" fill={paint} /> : null}
      {shape === 'puff' ? (
        <G>
          <Circle r={6} fill={paint} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <Circle key={a} cx={0} cy={-6.5} r={1.6} fill={paint} transform={`rotate(${a})`} />
          ))}
        </G>
      ) : null}
      {shape === 'lantern' ? (
        <G>
          <Circle r={9} fill={paint} fillOpacity={0.25} />
          <Path d="M-5 -6 H5 Q8 0 5 6 H-5 Q-8 0 -5 -6 Z" fill={paint} />
          <Rect x={-3} y={-8} width={6} height={2} fill={accent} fillOpacity={0.6} />
        </G>
      ) : null}
      {shape === 'flower' ? (
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={0} cy={-4.5} rx={3.4} ry={4.8} fill={paint} transform={`rotate(${a})`} />
          ))}
          <Circle r={2.2} fill={accent} />
        </G>
      ) : null}
      {shape === 'confetti' ? <Rect x={-5} y={-3} width={10} height={6} rx={1} fill={paint} /> : null}
      {shape === 'tile' ? (
        <G>
          <Rect x={-7} y={-7} width={14} height={14} rx={1.5} fill={paint} />
          <Circle r={3} fill={accent} fillOpacity={0.5} />
        </G>
      ) : null}
      {shape === 'balloon' ? (
        <G>
          <Path d="M0 5 C-8 1 -7 -9 0 -9 C7 -9 8 1 0 5 Z" fill={paint} />
          <Rect x={-1.6} y={6.5} width={3.2} height={2.4} fill={accent} fillOpacity={0.7} />
        </G>
      ) : null}
      {shape === 'clover' ? (
        <G fill={paint}>
          <Circle cx={0} cy={-3.5} r={3.6} />
          <Circle cx={-3.4} cy={1.6} r={3.6} />
          <Circle cx={3.4} cy={1.6} r={3.6} />
        </G>
      ) : null}
    </Svg>
  );
});
