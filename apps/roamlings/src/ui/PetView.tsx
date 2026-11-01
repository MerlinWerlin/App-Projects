// Draws any pet from its species parts + colourway + stage, as layered vector shapes.
// One renderer covers every variant, so new colourways and parts need no new art files.
import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import type { Mood } from '../core/growth';
import { type Pet, petPalette, petParts } from '../core/pet';
import { type BodyShape, type Branch, type Ears, type Marking, type Palette, type Tail, type Topper, getSpecies } from '../core/species';

interface Anchor {
  top: number; // top of head
  earL: number; // x of left ear
  earR: number;
  earY: number;
  eyeY: number;
  eyeDX: number;
  bellyY: number;
  tailX: number;
  tailY: number;
  halfW: number;
}

const ANCHORS: Record<BodyShape, Anchor> = {
  round: { top: 64, earL: 66, earR: 134, earY: 78, eyeY: 112, eyeDX: 22, bellyY: 145, tailX: 160, tailY: 150, halfW: 62 },
  bean: { top: 52, earL: 72, earR: 128, earY: 66, eyeY: 100, eyeDX: 20, bellyY: 140, tailX: 150, tailY: 152, halfW: 52 },
  drop: { top: 50, earL: 74, earR: 126, earY: 84, eyeY: 122, eyeDX: 22, bellyY: 155, tailX: 158, tailY: 158, halfW: 60 },
  pear: { top: 58, earL: 74, earR: 126, earY: 72, eyeY: 104, eyeDX: 19, bellyY: 150, tailX: 162, tailY: 158, halfW: 62 },
};

function BodyShapeView({ shape, fill, line }: { shape: BodyShape; fill: string; line: string }) {
  const stroke = { stroke: line, strokeWidth: 3, strokeOpacity: 0.85 };
  switch (shape) {
    case 'round':
      return <Ellipse cx={100} cy={124} rx={62} ry={60} fill={fill} {...stroke} />;
    case 'bean':
      return <Ellipse cx={100} cy={120} rx={52} ry={68} fill={fill} {...stroke} />;
    case 'drop':
      return (
        <Path
          d="M100 50 C 138 92, 162 118, 160 146 C 158 174, 132 186, 100 186 C 68 186, 42 174, 40 146 C 38 118, 62 92, 100 50 Z"
          fill={fill}
          {...stroke}
        />
      );
    case 'pear':
      return (
        <Path
          d="M100 58 C 128 58, 140 82, 143 102 C 164 116, 170 150, 156 170 C 142 188, 58 188, 44 170 C 30 150, 36 116, 57 102 C 60 82, 72 58, 100 58 Z"
          fill={fill}
          {...stroke}
        />
      );
  }
}

function EarsView({ kind, a, pal }: { kind: Ears; a: Anchor; pal: Palette }) {
  const s = { stroke: pal.line, strokeWidth: 3, strokeOpacity: 0.85 };
  const L = a.earL, R = a.earR, y = a.earY;
  switch (kind) {
    case 'none':
      return null;
    case 'pointy':
      return (
        <G>
          <Polygon points={`${L - 18},${y + 14} ${L - 6},${y - 34} ${L + 16},${y + 4}`} fill={pal.body} {...s} />
          <Polygon points={`${L - 10},${y + 8} ${L - 5},${y - 20} ${L + 7},${y + 4}`} fill={pal.accent} />
          <Polygon points={`${R + 18},${y + 14} ${R + 6},${y - 34} ${R - 16},${y + 4}`} fill={pal.body} {...s} />
          <Polygon points={`${R + 10},${y + 8} ${R + 5},${y - 20} ${R - 7},${y + 4}`} fill={pal.accent} />
        </G>
      );
    case 'round':
      return (
        <G>
          <Circle cx={L - 6} cy={y - 6} r={18} fill={pal.body} {...s} />
          <Circle cx={L - 6} cy={y - 6} r={9} fill={pal.accent} />
          <Circle cx={R + 6} cy={y - 6} r={18} fill={pal.body} {...s} />
          <Circle cx={R + 6} cy={y - 6} r={9} fill={pal.accent} />
        </G>
      );
    case 'long':
      return (
        <G>
          <Ellipse cx={L + 4} cy={y - 34} rx={11} ry={36} fill={pal.body} {...s} transform={`rotate(-12 ${L + 4} ${y - 34})`} />
          <Ellipse cx={L + 4} cy={y - 32} rx={5} ry={26} fill={pal.accent} transform={`rotate(-12 ${L + 4} ${y - 32})`} />
          <Ellipse cx={R - 4} cy={y - 34} rx={11} ry={36} fill={pal.body} {...s} transform={`rotate(12 ${R - 4} ${y - 34})`} />
          <Ellipse cx={R - 4} cy={y - 32} rx={5} ry={26} fill={pal.accent} transform={`rotate(12 ${R - 4} ${y - 32})`} />
        </G>
      );
    case 'droopy':
      return (
        <G>
          <Ellipse cx={L - 14} cy={y + 18} rx={12} ry={30} fill={pal.accent} {...s} transform={`rotate(28 ${L - 14} ${y + 18})`} />
          <Ellipse cx={R + 14} cy={y + 18} rx={12} ry={30} fill={pal.accent} {...s} transform={`rotate(-28 ${R + 14} ${y + 18})`} />
        </G>
      );
    case 'leaf':
      return (
        <G>
          <Path d={`M${L + 8} ${y + 6} C ${L - 30} ${y - 10}, ${L - 18} ${y - 44}, ${L - 4} ${y - 40} C ${L + 6} ${y - 30}, ${L + 14} ${y - 12}, ${L + 8} ${y + 6} Z`} fill={pal.accent} {...s} />
          <Path d={`M${R - 8} ${y + 6} C ${R + 30} ${y - 10}, ${R + 18} ${y - 44}, ${R + 4} ${y - 40} C ${R - 6} ${y - 30}, ${R - 14} ${y - 12}, ${R - 8} ${y + 6} Z`} fill={pal.accent} {...s} />
        </G>
      );
    case 'fin':
      return (
        <G>
          <Path d={`M${100 - a.halfW + 4} ${y + 30} L ${100 - a.halfW - 22} ${y + 10} L ${100 - a.halfW + 2} ${y + 6} Z`} fill={pal.accent} {...s} />
          <Path d={`M${100 + a.halfW - 4} ${y + 30} L ${100 + a.halfW + 22} ${y + 10} L ${100 + a.halfW - 2} ${y + 6} Z`} fill={pal.accent} {...s} />
        </G>
      );
  }
}

function TailView({ kind, a, pal }: { kind: Tail; a: Anchor; pal: Palette }) {
  const s = { stroke: pal.line, strokeWidth: 3, strokeOpacity: 0.85 };
  const x = a.tailX, y = a.tailY;
  switch (kind) {
    case 'none':
      return null;
    case 'fluffy':
      return (
        <G>
          <Circle cx={x + 6} cy={y - 6} r={16} fill={pal.belly} {...s} />
          <Circle cx={x + 18} cy={y - 18} r={10} fill={pal.belly} {...s} />
        </G>
      );
    case 'curl':
      return <Path d={`M${x - 8} ${y} C ${x + 30} ${y + 4}, ${x + 34} ${y - 34}, ${x + 12} ${y - 34} C ${x - 2} ${y - 34}, ${x + 2} ${y - 18}, ${x + 12} ${y - 20}`} fill="none" stroke={pal.accent} strokeWidth={9} strokeLinecap="round" />;
    case 'fin':
      return <Path d={`M${x - 10} ${y} L ${x + 26} ${y - 26} L ${x + 22} ${y + 18} Z`} fill={pal.accent} {...s} />;
    case 'flame':
      return (
        <G>
          <Path d={`M${x - 10} ${y + 4} C ${x + 12} ${y + 6}, ${x + 30} ${y - 16}, ${x + 22} ${y - 46} C ${x + 14} ${y - 30}, ${x + 6} ${y - 34}, ${x + 6} ${y - 50} C ${x - 6} ${y - 30}, ${x - 16} ${y - 14}, ${x - 10} ${y + 4} Z`} fill={pal.accent} {...s} />
          <Path d={`M${x} ${y} C ${x + 10} ${y}, ${x + 16} ${y - 14}, ${x + 12} ${y - 28} C ${x + 6} ${y - 18}, ${x} ${y - 22}, ${x} ${y - 30} C ${x - 6} ${y - 18}, ${x - 8} ${y - 8}, ${x} ${y} Z`} fill="#FFE08A" />
        </G>
      );
    case 'stub':
      return <Circle cx={x + 2} cy={y + 2} r={10} fill={pal.accent} {...s} />;
  }
}

function MarkingView({ kind, a, pal }: { kind: Marking; a: Anchor; pal: Palette }) {
  switch (kind) {
    case 'none':
      return null;
    case 'belly':
      return <Ellipse cx={100} cy={a.bellyY} rx={a.halfW * 0.55} ry={26} fill={pal.belly} />;
    case 'spots':
      return (
        <G fill={pal.accent} opacity={0.55}>
          <Circle cx={100 - a.halfW * 0.55} cy={a.eyeY + 34} r={7} />
          <Circle cx={100 + a.halfW * 0.6} cy={a.eyeY + 22} r={5} />
          <Circle cx={100 + a.halfW * 0.35} cy={a.bellyY + 6} r={8} />
          <Circle cx={100 - a.halfW * 0.2} cy={a.top + 16} r={5} />
        </G>
      );
    case 'stripes':
      return (
        <G stroke={pal.accent} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.7}>
          <Path d={`M${100 - 14} ${a.top + 6} Q 100 ${a.top + 20} ${100 + 14} ${a.top + 6}`} />
          <Path d={`M${100 - a.halfW + 6} ${a.bellyY - 6} q 12 4 18 -6`} />
          <Path d={`M${100 + a.halfW - 6} ${a.bellyY - 6} q -12 4 -18 -6`} />
        </G>
      );
    case 'mask':
      return <Ellipse cx={100} cy={a.eyeY} rx={a.eyeDX + 20} ry={15} fill={pal.accent} opacity={0.45} />;
    case 'stars':
      return (
        <G fill={pal.belly}>
          {[
            [100 - a.halfW * 0.5, a.top + 22, 6],
            [100 + a.halfW * 0.55, a.eyeY + 30, 5],
            [100 - a.halfW * 0.3, a.bellyY + 4, 7],
          ].map(([cx, cy, r], i) => (
            <Path key={i} d={`M${cx} ${cy! - r!} L ${cx! + r! * 0.3} ${cy! - r! * 0.3} L ${cx! + r!} ${cy} L ${cx! + r! * 0.3} ${cy! + r! * 0.3} L ${cx} ${cy! + r!} L ${cx! - r! * 0.3} ${cy! + r! * 0.3} L ${cx! - r!} ${cy} L ${cx! - r! * 0.3} ${cy! - r! * 0.3} Z`} />
          ))}
        </G>
      );
  }
}

function TopperView({ kind, a, pal }: { kind: Topper; a: Anchor; pal: Palette }) {
  const s = { stroke: pal.line, strokeWidth: 3, strokeOpacity: 0.85 };
  const t = a.top;
  switch (kind) {
    case 'none':
      return null;
    case 'sprout':
      return (
        <G>
          <Line x1={100} y1={t + 2} x2={100} y2={t - 18} stroke="#4F8F3E" strokeWidth={4} strokeLinecap="round" />
          <Path d={`M100 ${t - 14} C 86 ${t - 30}, 74 ${t - 20}, 78 ${t - 12} C 86 ${t - 8}, 96 ${t - 10}, 100 ${t - 14} Z`} fill="#7CC46A" {...s} />
          <Path d={`M100 ${t - 16} C 114 ${t - 34}, 128 ${t - 24}, 122 ${t - 14} C 114 ${t - 10}, 104 ${t - 12}, 100 ${t - 16} Z`} fill="#7CC46A" {...s} />
        </G>
      );
    case 'antenna':
      return (
        <G>
          <Path d={`M96 ${t + 2} Q 90 ${t - 18} 82 ${t - 26}`} stroke={pal.line} strokeWidth={3} fill="none" />
          <Path d={`M104 ${t + 2} Q 110 ${t - 18} 118 ${t - 26}`} stroke={pal.line} strokeWidth={3} fill="none" />
          <Circle cx={82} cy={t - 28} r={6} fill={pal.accent} {...s} />
          <Circle cx={118} cy={t - 28} r={6} fill={pal.accent} {...s} />
        </G>
      );
    case 'horn':
      return <Polygon points={`90,${t + 6} 100,${t - 26} 110,${t + 6}`} fill={pal.belly} {...s} />;
    case 'crest':
      return (
        <G>
          <Path d={`M86 ${t + 6} C 82 ${t - 10}, 92 ${t - 20}, 96 ${t - 22} C 94 ${t - 10}, 98 ${t - 2}, 100 ${t + 4} Z`} fill={pal.accent} {...s} />
          <Path d={`M98 ${t + 4} C 98 ${t - 14}, 106 ${t - 26}, 112 ${t - 28} C 108 ${t - 14}, 112 ${t - 4}, 114 ${t + 6} Z`} fill={pal.accent} {...s} />
        </G>
      );
    case 'tuft':
      return (
        <G stroke={pal.accent} strokeWidth={5} strokeLinecap="round" fill="none">
          <Path d={`M92 ${t + 4} q -6 -12 2 -18`} />
          <Path d={`M100 ${t + 2} q 0 -14 8 -20`} />
          <Path d={`M108 ${t + 4} q 8 -8 4 -16`} />
        </G>
      );
    case 'bubble':
      return (
        <G>
          <Circle cx={100} cy={t - 18} r={16} fill="#BFE8FF" fillOpacity={0.55} stroke="#7FC7EE" strokeWidth={2} />
          <Circle cx={94} cy={t - 24} r={4} fill="#FFFFFF" fillOpacity={0.9} />
        </G>
      );
  }
}

function FaceView({ a, pal, mood, stage }: { a: Anchor; pal: Palette; mood: Mood; stage: 0 | 1 | 2 }) {
  const eyeR = stage === 0 ? 10 : stage === 1 ? 9 : 8;
  const L = 100 - a.eyeDX, R = 100 + a.eyeDX, y = a.eyeY;
  const ink = pal.line;
  let eyes;
  if (mood === 'sleepy') {
    eyes = (
      <G stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d={`M${L - 8} ${y + 2} q 8 6 16 0`} />
        <Path d={`M${R - 8} ${y + 2} q 8 6 16 0`} />
      </G>
    );
  } else if (mood === 'joyful') {
    eyes = (
      <G stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d={`M${L - 8} ${y + 4} q 8 -12 16 0`} />
        <Path d={`M${R - 8} ${y + 4} q 8 -12 16 0`} />
      </G>
    );
  } else {
    const r = mood === 'okay' ? eyeR - 2 : eyeR;
    eyes = (
      <G>
        <Ellipse cx={L} cy={y} rx={r} ry={r + 2} fill={ink} />
        <Ellipse cx={R} cy={y} rx={r} ry={r + 2} fill={ink} />
        <Circle cx={L + 3} cy={y - 4} r={r * 0.35} fill="#FFFFFF" />
        <Circle cx={R + 3} cy={y - 4} r={r * 0.35} fill="#FFFFFF" />
      </G>
    );
  }
  const mouth =
    mood === 'sleepy' ? (
      <Circle cx={100} cy={y + 20} r={3} fill={ink} opacity={0.7} />
    ) : (
      <Path d={`M92 ${y + 16} q 8 ${mood === 'okay' ? 4 : 9} 16 0`} stroke={ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    );
  return (
    <G>
      {eyes}
      <Ellipse cx={L - 12} cy={y + 16} rx={8} ry={5} fill="#FF8FA3" opacity={0.45} />
      <Ellipse cx={R + 12} cy={y + 16} rx={8} ry={5} fill="#FF8FA3" opacity={0.45} />
      {mouth}
    </G>
  );
}

function BranchView({ branch, a, pal }: { branch: Branch; a: Anchor; pal: Palette }) {
  switch (branch) {
    case 'swift':
      return (
        <G stroke={pal.accent} strokeWidth={4} strokeLinecap="round" opacity={0.6}>
          <Line x1={18} y1={a.eyeY} x2={36} y2={a.eyeY} />
          <Line x1={10} y1={a.eyeY + 18} x2={32} y2={a.eyeY + 18} />
          <Line x1={20} y1={a.eyeY + 36} x2={34} y2={a.eyeY + 36} />
        </G>
      );
    case 'scholarly': {
      const L = 100 - a.eyeDX, R = 100 + a.eyeDX;
      return (
        <G stroke={pal.line} strokeWidth={3} fill="none">
          <Circle cx={L} cy={a.eyeY} r={14} />
          <Circle cx={R} cy={a.eyeY} r={14} />
          <Line x1={L + 14} y1={a.eyeY} x2={R - 14} y2={a.eyeY} />
        </G>
      );
    }
    case 'cozy':
      return (
        <G>
          <Path d={`M${100 - a.halfW * 0.8} ${a.eyeY + 34} Q 100 ${a.eyeY + 50} ${100 + a.halfW * 0.8} ${a.eyeY + 34} L ${100 + a.halfW * 0.8} ${a.eyeY + 46} Q 100 ${a.eyeY + 62} ${100 - a.halfW * 0.8} ${a.eyeY + 46} Z`} fill={pal.accent} stroke={pal.line} strokeWidth={2.5} />
          <Path d={`M${100 + a.halfW * 0.35} ${a.eyeY + 52} l 6 26 l 12 -2 l -6 -24 Z`} fill={pal.accent} stroke={pal.line} strokeWidth={2.5} />
        </G>
      );
  }
}

function Sparkles({ color }: { color: string }) {
  const star = (x: number, y: number, r: number, k: string) => (
    <Path key={k} d={`M${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`} fill={color} />
  );
  return <G>{[star(28, 52, 10, 'a'), star(172, 70, 8, 'b'), star(166, 176, 7, 'c'), star(34, 160, 6, 'd')]}</G>;
}

export interface PetViewProps {
  pet: Pet;
  size: number;
  mood?: Mood;
  animate?: boolean;
  /** Draw as a dark silhouette (unknown Dex entry). */
  silhouette?: boolean;
}

function PetViewInner({ pet, size, mood = 'happy', animate = false, silhouette = false }: PetViewProps) {
  const species = getSpecies(pet.speciesId);
  const parts = petParts(pet);
  const realPal = petPalette(pet);
  const pal: Palette = silhouette ? { id: 'sil', body: '#3A3442', belly: '#3A3442', accent: '#3A3442', line: '#2A2531' } : realPal;
  const a = ANCHORS[species.body];
  const scale = pet.stage === 0 ? 0.72 : pet.stage === 1 ? 0.86 : 1;
  const shiny = !silhouette && (pet.rarity === 'shimmer' || pet.rarity === 'mythic');

  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [animate, bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.03] });

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Ellipse cx={100} cy={190} rx={52 * scale} ry={7} fill="#000000" opacity={0.12} />
      </Svg>
      <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          {shiny ? <Sparkles color={realPal.accent} /> : null}
          <G transform={`translate(100 190) scale(${scale}) translate(-100 -190)`}>
            <TailView kind={parts.tail} a={a} pal={pal} />
            <EarsView kind={parts.ears} a={a} pal={pal} />
            <TopperView kind={parts.topper} a={a} pal={pal} />
            <BodyShapeView shape={species.body} fill={pal.body} line={pal.line} />
            <MarkingView kind={parts.marking} a={a} pal={pal} />
            {silhouette ? null : <FaceView a={a} pal={pal} mood={mood} stage={pet.stage} />}
            {!silhouette && pet.stage === 2 && pet.branch ? <BranchView branch={pet.branch} a={a} pal={pal} /> : null}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

export const PetView = memo(PetViewInner);
