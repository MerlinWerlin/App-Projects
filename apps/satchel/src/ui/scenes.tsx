// T119 design pass 2: original hero scenes for the four tool tabs, drawn with react-native-svg from theme tokens only
// (hero gradient stops, heroPaper, heroWash, heroChip, heroMuted, heroAccent), so they follow light and dark mode.
//   wallet     an open wallet with two tickets tucked in and a luggage tag
//   emergency  a calm compass on soft rings with a small help cross
//   toilets    a signpost by a path, one board with a pin, one with a simple restroom pictogram
//   map        a folded paper map with a dashed route and a pin
// Light mode draws a sun; dark mode a crescent moon and a few stars. Simple geometric shapes only: no brands, logos
// or characters. Each scene is one image for screen readers, named by its look2.scene.* string.
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import type { HeroTone, Theme } from '../theme/tokens.ts';

export type SceneKind = 'wallet' | 'emergency' | 'toilets' | 'map';
export const SCENE_KINDS: readonly SceneKind[] = ['wallet', 'emergency', 'toilets', 'map'];

/** The hero gradient each scene sits on. */
export const SCENE_TONE: Record<SceneKind, HeroTone> = { wallet: 'wallet', emergency: 'emergency', toilets: 'toilets', map: 'map' };

/** What a screen reader hears for each scene. */
export const SCENE_LABEL: Record<SceneKind, Key> = {
  wallet: 'look2.scene.wallet',
  emergency: 'look2.scene.emergency',
  toilets: 'look2.scene.toilets',
  map: 'look2.scene.map',
};

/** viewBox of every scene. */
export const SCENE_W = 200;
export const SCENE_H = 140;

type Ink = { paper: string; wash: string; chip: string; line: string; warm: string; deep: string; mid: string };

const inks = (theme: Theme, tone: HeroTone): Ink => ({
  paper: theme.heroPaper,
  wash: theme.heroWash,
  chip: theme.heroChip,
  line: theme.heroMuted,
  warm: theme.heroAccent,
  deep: theme.hero[tone][0],
  mid: theme.hero[tone][1],
});

/** Sun by day (light mode), crescent moon and stars by night (dark mode), top right. */
function Sky({ c, night }: { c: Ink; night: boolean }) {
  if (!night) {
    return (
      <G>
        <Circle cx={176} cy={22} r={18} fill={c.wash} />
        <Circle cx={176} cy={22} r={10} fill={c.warm} />
      </G>
    );
  }
  const star = (x: number, y: number, r: number) => `M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`;
  return (
    <G>
      <Circle cx={176} cy={22} r={10} fill={c.warm} />
      <Circle cx={181} cy={18} r={9} fill={c.mid} />
      <Path d={star(150, 14, 4)} fill={c.line} />
      <Path d={star(192, 46, 3)} fill={c.line} />
      <Circle cx={160} cy={36} r={1.6} fill={c.line} />
    </G>
  );
}

function WalletArt({ c }: { c: Ink }) {
  return (
    <G>
      <Path d="M8 128 C 50 116, 150 116, 196 128 V140 H8 Z" fill={c.wash} />
      {/* back ticket */}
      <G transform="rotate(-14 112 58)">
        <Rect x={64} y={26} width={98} height={44} rx={6} fill={c.paper} />
        <Rect x={64} y={26} width={10} height={44} fill={c.warm} />
        <Path d="M138 30 V66" stroke={c.deep} strokeWidth={1.6} strokeDasharray={[3, 4]} />
        <Rect x={82} y={36} width={40} height={5} rx={2.5} fill={c.deep} />
        <Rect x={82} y={47} width={28} height={4} rx={2} fill={c.mid} />
        <Rect x={82} y={56} width={34} height={4} rx={2} fill={c.mid} />
      </G>
      {/* front ticket with a barcode stub */}
      <G transform="rotate(7 120 64)">
        <Rect x={78} y={40} width={96} height={42} rx={6} fill={c.paper} />
        <Path d="M146 44 V78" stroke={c.deep} strokeWidth={1.6} strokeDasharray={[3, 4]} />
        <Rect x={88} y={50} width={36} height={5} rx={2.5} fill={c.deep} />
        <Rect x={88} y={61} width={24} height={4} rx={2} fill={c.mid} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Rect key={i} x={153 + i * 3.4} y={50} width={i % 2 ? 1.4 : 2.2} height={24} fill={c.deep} />
        ))}
      </G>
      {/* wallet: body, flap and clasp */}
      <Rect x={52} y={72} width={128} height={56} rx={12} fill={c.deep} stroke={c.line} strokeWidth={2} />
      <Path d="M52 84 Q52 72 64 72 H168 Q180 72 180 84 V96 H52 Z" fill={c.mid} stroke={c.line} strokeWidth={2} />
      <Path d="M60 116 H120" stroke={c.line} strokeWidth={1.4} strokeDasharray={[2, 4]} strokeLinecap="round" />
      <Rect x={156} y={88} width={26} height={18} rx={9} fill={c.warm} />
      <Circle cx={168} cy={97} r={3.5} fill={c.deep} />
      {/* luggage tag on a string */}
      <Path d="M52 92 C 38 92, 30 84, 30 74" fill="none" stroke={c.line} strokeWidth={1.6} strokeLinecap="round" />
      <G transform="rotate(-18 30 62)">
        <Path d="M22 50 L30 44 L38 50 V76 H22 Z" fill={c.paper} />
        <Circle cx={30} cy={51} r={2.4} fill={c.deep} />
        <Rect x={25} y={60} width={10} height={3} rx={1.5} fill={c.mid} />
        <Rect x={25} y={67} width={8} height={3} rx={1.5} fill={c.mid} />
      </G>
    </G>
  );
}

function EmergencyArt({ c }: { c: Ink }) {
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <G>
      {/* calm rings and a slow wave: steady, not alarming */}
      <Circle cx={124} cy={72} r={58} fill={c.wash} />
      <Circle cx={124} cy={72} r={44} fill={c.wash} />
      <Path d="M6 124 C 30 114, 48 134, 72 124 S 114 114, 138 124 S 180 134, 198 124" fill="none" stroke={c.line} strokeWidth={2} strokeLinecap="round" />
      {/* compass */}
      <Circle cx={124} cy={72} r={32} fill={c.paper} stroke={c.line} strokeWidth={3} />
      {ticks.map((d) => (
        <Rect key={d} x={122.5} y={43} width={3} height={d % 90 === 0 ? 8 : 5} rx={1.5} fill={c.deep} transform={`rotate(${d} 124 72)`} />
      ))}
      <G transform="rotate(28 124 72)">
        <Path d="M124 48 L131 72 H117 Z" fill={c.deep} />
        <Path d="M124 96 L117 72 H131 Z" fill={c.mid} />
      </G>
      <Circle cx={124} cy={72} r={5} fill={c.warm} stroke={c.deep} strokeWidth={1.6} />
      {/* small help cross badge */}
      <Circle cx={74} cy={40} r={16} fill={c.warm} />
      <Rect x={70.5} y={30} width={7} height={20} rx={2} fill={c.deep} />
      <Rect x={64} y={36.5} width={20} height={7} rx={2} fill={c.deep} />
    </G>
  );
}

function ToiletsArt({ c }: { c: Ink }) {
  return (
    <G>
      {/* hills, a path to the horizon, a tree */}
      <Path d="M0 108 C 40 92, 80 96, 120 104 S 180 96, 200 100 V140 H0 Z" fill={c.wash} />
      <Path d="M40 140 C 70 124, 92 116, 118 108" fill="none" stroke={c.line} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={[3, 6]} />
      <Circle cx={44} cy={86} r={14} fill={c.wash} />
      <Rect x={42} y={96} width={4} height={14} rx={2} fill={c.line} />
      {/* post */}
      <Rect x={130} y={30} width={8} height={98} rx={3} fill={c.paper} />
      <Path d="M118 128 H150" stroke={c.line} strokeWidth={2.4} strokeLinecap="round" />
      {/* board pointing right: a pin */}
      <Path d="M108 36 H176 L188 48 L176 60 H108 Z" fill={c.paper} stroke={c.deep} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M124 40 C118 40 115 44 115 48 C115 53 124 58 124 58 C124 58 133 53 133 48 C133 44 130 40 124 40 Z" fill={c.deep} />
      <Circle cx={124} cy={47.5} r={2.6} fill={c.paper} />
      <Rect x={142} y={44} width={28} height={4} rx={2} fill={c.mid} />
      <Rect x={142} y={52} width={18} height={3} rx={1.5} fill={c.mid} />
      {/* board pointing left: a plain two-figure restroom pictogram */}
      <Path d="M160 70 H92 L80 82 L92 94 H160 Z" fill={c.warm} stroke={c.deep} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={112} cy={76} r={3} fill={c.deep} />
      <Rect x={109} y={80.5} width={6} height={10} rx={2} fill={c.deep} />
      <Path d="M122 90.5 V82 H128 V90.5" fill={c.deep} />
      <Circle cx={142} cy={76} r={3} fill={c.deep} />
      <Path d="M138 90.5 L140 80.5 H144 L146 90.5 Z" fill={c.deep} />
      <Circle cx={125} cy={77} r={3} fill={c.deep} />
    </G>
  );
}

function MapArt({ c }: { c: Ink }) {
  return (
    <G>
      <Path d="M20 130 C 70 120, 150 120, 196 130 V140 H20 Z" fill={c.wash} />
      {/* three folded panels, the middle one in shade */}
      <Path d="M34 44 L80 32 L80 116 L34 128 Z" fill={c.paper} />
      <Path d="M80 32 L126 44 L126 128 L80 116 Z" fill={c.paper} />
      <Path d="M80 32 L126 44 L126 128 L80 116 Z" fill={c.chip} />
      <Path d="M126 44 L172 32 L172 116 L126 128 Z" fill={c.paper} />
      {/* a lake, a coast line and the dashed route */}
      <Path d="M138 56 C 148 50, 164 54, 164 64 C 164 74, 148 76, 140 70 Z" fill={c.mid} opacity={0.45} />
      <Path d="M42 70 C 52 66, 62 72, 74 66" fill="none" stroke={c.mid} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M44 112 C 60 100, 70 104, 84 92 S 110 84, 122 96 S 146 104, 160 84" fill="none" stroke={c.deep} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={[4, 5]} />
      <Circle cx={44} cy={112} r={4} fill={c.deep} />
      {/* pin at the end of the route */}
      <Path d="M160 52 C152 52 147 58 147 65 C147 74 160 84 160 84 C160 84 173 74 173 65 C173 58 168 52 160 52 Z" fill={c.warm} stroke={c.deep} strokeWidth={1.6} />
      <Circle cx={160} cy={65} r={4.2} fill={c.deep} />
      {/* north arrow */}
      <Path d="M18 30 L24 16 L30 30 L24 26 Z" fill={c.line} />
    </G>
  );
}

/** One tab's hero scene. `width` is the drawn width; height follows the 200 x 140 viewBox. */
export const TabScene = memo(function TabScene({ kind, width = 180 }: { kind: SceneKind; width?: number }) {
  const { theme, t } = useApp();
  const c = inks(theme, SCENE_TONE[kind]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t(SCENE_LABEL[kind])}>
      <Svg width={width} height={(width * SCENE_H) / SCENE_W} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
        <Sky c={c} night={theme.dark} />
        {kind === 'wallet' ? <WalletArt c={c} /> : null}
        {kind === 'emergency' ? <EmergencyArt c={c} /> : null}
        {kind === 'toilets' ? <ToiletsArt c={c} /> : null}
        {kind === 'map' ? <MapArt c={c} /> : null}
      </Svg>
    </View>
  );
});
