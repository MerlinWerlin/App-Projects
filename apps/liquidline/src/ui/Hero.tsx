// Onboarding illustration: an original drawing of a two-gauge manifold (blue low side, red high side) on a coil of
// copper, drawn with react-native-svg so it is sharp at any size and follows light / dark mode.
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { usePalette } from '../theme/tokens.ts';

function Dial({ cx, color, face, ink, angle, label }: { cx: number; color: string; face: string; ink: string; angle: number; label: string }) {
  const cy = 74;
  const r = 52;
  const ticks = Array.from({ length: 11 }, (_, i) => -135 + i * 27);
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r + 8} fill={color} />
      <Circle cx={cx} cy={cy} r={r} fill={face} />
      {ticks.map((t, i) => (
        <Line key={i} x1={cx + Math.cos(rad(t)) * (r - 4)} y1={cy + Math.sin(rad(t)) * (r - 4)} x2={cx + Math.cos(rad(t)) * (r - (i % 5 === 0 ? 16 : 10))} y2={cy + Math.sin(rad(t)) * (r - (i % 5 === 0 ? 16 : 10))} stroke={ink} strokeWidth={i % 5 === 0 ? 3 : 2} strokeLinecap="round" />
      ))}
      <Path d={`M ${cx + Math.cos(rad(-135)) * (r - 22)} ${cy + Math.sin(rad(-135)) * (r - 22)} A ${r - 22} ${r - 22} 0 1 1 ${cx + Math.cos(rad(135)) * (r - 22)} ${cy + Math.sin(rad(135)) * (r - 22)}`} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.35} />
      <Line x1={cx} y1={cy} x2={cx + Math.cos(rad(angle)) * (r - 12)} y2={cy + Math.sin(rad(angle)) * (r - 12)} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={7} fill={ink} />
      <SvgText x={cx} y={cy + 32} fontSize={13} fontWeight="700" fill={ink} textAnchor="middle">{label}</SvgText>
    </G>
  );
}

export function Hero() {
  const p = usePalette();
  return (
    <Svg width="100%" height={190} viewBox="0 0 340 190" accessibilityLabel="Illustration of a gauge manifold with a blue low-side gauge and a red high-side gauge">
      <Path d="M 20 170 C 80 120, 120 200, 170 160 S 270 120, 320 170" stroke="#B8733A" strokeWidth={12} fill="none" strokeLinecap="round" />
      <Path d="M 20 182 C 80 132, 120 212, 170 172 S 270 132, 320 182" stroke="#D8935A" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
      <Rect x={70} y={116} width={200} height={34} rx={12} fill={p.text} />
      <Rect x={150} y={150} width={40} height={18} rx={4} fill={p.text2} />
      <Dial cx={110} color={p.low} face={p.surface} ink={p.text} angle={-40} label="LOW" />
      <Dial cx={230} color={p.high} face={p.surface} ink={p.text} angle={55} label="HIGH" />
    </Svg>
  );
}
