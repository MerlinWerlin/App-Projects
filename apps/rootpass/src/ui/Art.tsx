/**
 * Rootpass illustrations, original vector art drawn in code: a branch pipe saddled onto a header with a
 * glowing root pass running round the joint (home and welcome), and an empty bench for empty states.
 */
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { saddle } from '../core/saddle.ts';
import { C } from './theme.ts';

/** A saddle joint mid-weld: header pipe, branch pipe, the bead along the cope line and a spark of arc light. */
export function JointArt({ width = 340, height = 190 }: { width?: number; height?: number }) {
  // Bead: overlapping ripples along the saddle curve where the branch meets the header.
  const beads: { x: number; y: number }[] = [];
  for (let k = 0; k <= 34; k++) {
    const t = k / 34;
    const x = 118 + t * 104;
    const y = 118 + 20 * Math.sin(Math.PI * t) ** 1.4; // the saddle dips toward the crotch
    beads.push({ x, y });
  }
  return (
    <Svg width={width} height={height} viewBox="0 0 340 190" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="pipe" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3B414B" />
          <Stop offset="0.45" stopColor="#5A616D" />
          <Stop offset="1" stopColor="#1C1F25" />
        </LinearGradient>
        <LinearGradient id="branch" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#262A31" />
          <Stop offset="0.5" stopColor="#555C68" />
          <Stop offset="1" stopColor="#22262C" />
        </LinearGradient>
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFF3D6" stopOpacity="1" />
          <Stop offset="0.25" stopColor={C.accent} stopOpacity="0.9" />
          <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="bead" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7A4B2A" />
          <Stop offset="0.7" stopColor="#C9733A" />
          <Stop offset="1" stopColor="#FFD9A0" />
        </LinearGradient>
      </Defs>
      {/* Header pipe */}
      <Rect x={10} y={118} width={320} height={62} rx={6} fill="url(#pipe)" />
      <Ellipse cx={14} cy={149} rx={8} ry={31} fill="#2A2E35" stroke="#555C68" strokeWidth={1.5} />
      {/* Branch pipe, coped onto the header */}
      <Path d="M118 8 H222 V118 Q196 138 170 138 Q144 138 118 118 Z" fill="url(#branch)" />
      <Ellipse cx={170} cy={8} rx={52} ry={9} fill="#2A2E35" stroke="#6B7380" strokeWidth={1.5} />
      {/* Layout lines on the branch (arc blue, like the template) */}
      <G stroke={C.arc} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.85}>
        <Line x1={144} y1={22} x2={144} y2={128} />
        <Line x1={170} y1={18} x2={170} y2={134} />
        <Line x1={196} y1={22} x2={196} y2={128} />
      </G>
      {/* Bead ripples: done part warm, fresh part bright */}
      {beads.map((b, k) => (
        <Ellipse key={k} cx={b.x} cy={b.y} rx={6.5} ry={4.2} fill="url(#bead)" opacity={0.55 + 0.45 * (k / beads.length)} transform={`rotate(-18 ${b.x} ${b.y})`} />
      ))}
      {/* Arc light at the end of the bead */}
      <Ellipse cx={beads[beads.length - 1].x} cy={beads[beads.length - 1].y} rx={34} ry={34} fill="url(#glow)" />
      <G stroke="#FFD9A0" strokeWidth={1.4} strokeLinecap="round">
        <Line x1={226} y1={112} x2={252} y2={92} />
        <Line x1={228} y1={118} x2={262} y2={112} />
        <Line x1={224} y1={108} x2={236} y2={80} />
        <Line x1={230} y1={124} x2={258} y2={136} />
      </G>
    </Svg>
  );
}

/** Empty Jobs tab: a bench with a single offcut and a soapstone. */
export function EmptyBenchArt({ width = 260, height = 140 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 260 140" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={20} y={88} width={220} height={12} rx={3} fill={C.raised} />
      <Rect x={36} y={100} width={10} height={36} fill={C.line} />
      <Rect x={214} y={100} width={10} height={36} fill={C.line} />
      <Rect x={60} y={66} width={96} height={22} rx={3} fill="#4A505A" />
      <Rect x={60} y={66} width={96} height={6} rx={3} fill="#5E6572" />
      <Path d="M156 66 L168 88 L156 88 Z" fill="#3A3F48" />
      <Rect x={178} y={78} width={40} height={8} rx={4} fill={C.ink2} transform="rotate(-12 198 82)" />
      <Path d="M70 60 Q108 38 146 60" stroke={C.arc} strokeWidth={2} strokeDasharray="5 5" fill="none" />
      <Path d="M142 54 L148 61 L139 63" stroke={C.arc} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A real saddle cut line (76.1 branch on 114.3 header at 60°), drawn like the printed template: the feature art. */
export function SaddleCurve({ width, height = 132 }: { width: number; height?: number }) {
  const r = saddle({ headerOD: 114.3, branchOD: 76.1, branchWall: 0, angleDeg: 60, offset: 0, contact: 'outside' });
  if (!r.ok) return null;
  const { points, circumference: C0, maxDepth } = r.value;
  const padX = 18, top = 30, bottom = 22;
  const X = (x: number) => padX + (x / C0) * (width - 2 * padX);
  const Y = (h: number) => top + (h / maxDepth) * (height - top - bottom);
  const pts = points.map(p => `${X(p.x).toFixed(1)},${Y(p.h).toFixed(1)}`).join(' ');
  const low = points.reduce((a, b) => (b.h > a.h ? b : a));
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id="spark" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFF3D6" />
          <Stop offset="0.3" stopColor={C.accent} stopOpacity="0.8" />
          <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="#111418" />
      {Array.from({ length: 17 }, (_, k) => (
        <Line key={k} x1={X((C0 * k) / 16)} y1={top} x2={X((C0 * k) / 16)} y2={height - 8} stroke={k % 4 === 0 ? C.ink3 : C.arc} strokeOpacity={k % 4 === 0 ? 0.7 : 0.35} strokeWidth={k % 4 === 0 ? 1.5 : 1} strokeDasharray={k % 4 === 0 ? undefined : '3 4'} />
      ))}
      <Line x1={X(0)} y1={top} x2={X(C0)} y2={top} stroke={C.ink3} strokeDasharray="5 4" />
      <Polyline points={pts} fill="none" stroke={C.accent} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <Ellipse cx={X(low.x)} cy={Y(low.h)} rx={26} ry={26} fill="url(#spark)" />
    </Svg>
  );
}
