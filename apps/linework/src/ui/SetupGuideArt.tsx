// Original line-art illustrations for the setup guide (T66), drawn in this repo with react-native-svg in the app's
// ink / graphite tokens. Decorative only: each step's title and body say the same thing.
// SVG coordinates are not mirrored by the right-to-left layout, so the pictures read the same in every language.
import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import type { GuideStepId } from '../core/setupGuide';

const W = 240;
const H = 160;

export function SetupGuideArt({ id, height = 150 }: { id: GuideStepId; height?: number }) {
  const { c } = useTheme();
  const ink = c.ink;
  const lead = c.graphite;
  const soft = c.muted;
  const paper = c.card;
  const stroke = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  let art: ReactElement;
  if (id === 'stand') {
    // Side view: a phone resting on a glass, camera looking down at the paper, with the height marked.
    art = (
      <G {...stroke}>
        <Line x1={12} y1={140} x2={228} y2={140} stroke={soft} strokeWidth={2} />
        <Rect x={92} y={134} width={118} height={6} rx={1} fill={paper} stroke={soft} strokeWidth={1.5} />
        {/* glass */}
        <Path d="M36 140 L30 72 H82 L76 140 Z" fill="none" stroke={lead} strokeWidth={2} />
        <Line x1={32} y1={92} x2={80} y2={92} stroke={soft} strokeWidth={1.5} strokeDasharray="3 4" />
        {/* phone lying across the rim, reaching out over the paper */}
        <Rect x={24} y={60} width={150} height={11} rx={4} fill={paper} stroke={lead} strokeWidth={2} />
        <Rect x={146} y={70} width={10} height={4} rx={1.5} fill={ink} />
        {/* what the camera sees */}
        <Path d="M151 76 L112 132 M151 76 L192 132" fill="none" stroke={ink} strokeWidth={1.5} strokeDasharray="4 5" strokeOpacity={0.7} />
        {/* height marker */}
        <Line x1={176} y1={65} x2={216} y2={65} stroke={soft} strokeWidth={1} strokeDasharray="2 3" />
        <Line x1={216} y1={70} x2={216} y2={128} stroke={ink} strokeWidth={2} />
        <Path d="M211 75 L216 69 L221 75 M211 123 L216 129 L221 123" fill="none" stroke={ink} strokeWidth={2} />
        {/* pencil drawing underneath */}
        <Path d="M128 131 L148 103 L154 107 L134 135 Z" fill={paper} stroke={lead} strokeWidth={1.5} />
        <Path d="M128 131 L127 137 L134 135" fill={lead} stroke={lead} strokeWidth={1} />
      </G>
    );
  } else if (id === 'pick') {
    // A phone showing a grid of pictures; one is picked.
    const tiles = [
      [92, 30],
      [126, 30],
      [92, 64],
      [126, 64],
      [92, 98],
      [126, 98],
    ] as const;
    art = (
      <G {...stroke}>
        <Rect x={80} y={10} width={80} height={140} rx={12} fill={paper} stroke={lead} strokeWidth={2} />
        <Line x1={110} y1={18} x2={130} y2={18} stroke={soft} strokeWidth={2} />
        {tiles.map(([x, y], i) => (
          <Rect key={i} x={x} y={y} width={26} height={26} rx={4} fill="none" stroke={i === 1 ? ink : soft} strokeWidth={i === 1 ? 2.5 : 1.5} />
        ))}
        {/* hills and sun */}
        <Path d="M95 52 L102 43 L107 49 L111 45 L115 52" fill="none" stroke={soft} strokeWidth={1.5} />
        <Circle cx={111} cy={37} r={2.5} fill="none" stroke={soft} strokeWidth={1.5} />
        {/* the picked one: a flower */}
        <Circle cx={139} cy={41} r={3} fill="none" stroke={ink} strokeWidth={1.5} />
        <Path d="M139 38 C136 33, 142 33, 139 38 M142 41 C147 38, 147 44, 142 41 M139 44 C142 49, 136 49, 139 44 M136 41 C131 44, 131 38, 136 41" fill="none" stroke={ink} strokeWidth={1.5} />
        <Line x1={139} y1={47} x2={139} y2={53} stroke={ink} strokeWidth={1.5} />
        <Circle cx={152} cy={30} r={7} fill={ink} />
        <Path d="M148.5 30 L151 32.5 L155.5 27.5" fill="none" stroke={paper} strokeWidth={2} />
        {/* a heart, a cat's ears and a star (templates) */}
        <Path d="M105 86 C97 80, 99 72, 105 76 C111 72, 113 80, 105 86 Z" fill="none" stroke={soft} strokeWidth={1.5} />
        <Path d="M131 86 L132 72 L136 77 H142 L146 72 L147 86 Z" fill="none" stroke={soft} strokeWidth={1.5} />
        <Path d="M105 102 L107.5 108 L114 108.5 L109 112.5 L110.5 119 L105 115.5 L99.5 119 L101 112.5 L96 108.5 L102.5 108 Z" fill="none" stroke={soft} strokeWidth={1.5} />
        <Path d="M129 118 C133 106, 137 120, 141 108 S 147 114, 149 110" fill="none" stroke={soft} strokeWidth={1.5} />
        {/* fingertip tap */}
        <Circle cx={176} cy={58} r={9} fill="none" stroke={ink} strokeWidth={1.5} strokeOpacity={0.5} />
        <Circle cx={176} cy={58} r={4} fill={ink} fillOpacity={0.35} />
      </G>
    );
  } else if (id === 'lock') {
    // The picture faded so the pencil shows through, the opacity slider half way, the padlock closed.
    art = (
      <G {...stroke}>
        <Rect x={64} y={10} width={112} height={140} rx={12} fill={paper} stroke={lead} strokeWidth={2} />
        {/* faded picture: a leafy branch */}
        <G strokeOpacity={0.45}>
          <Path d="M84 128 C100 110, 112 92, 128 60" fill="none" stroke={ink} strokeWidth={2} />
          <Path d="M100 108 C88 104, 86 94, 92 90 C100 94, 102 100, 100 108 Z" fill="none" stroke={ink} strokeWidth={2} />
          <Path d="M112 88 C124 90, 130 82, 128 76 C118 76, 112 80, 112 88 Z" fill="none" stroke={ink} strokeWidth={2} />
          <Path d="M120 72 C110 66, 110 58, 116 54 C122 58, 124 64, 120 72 Z" fill="none" stroke={ink} strokeWidth={2} />
        </G>
        {/* the pencil seen through it */}
        <Path d="M98 112 L130 132 L127 137 L95 117 Z" fill={paper} stroke={lead} strokeWidth={1.5} />
        <Path d="M98 112 L91 110 L95 117" fill={lead} stroke={lead} strokeWidth={1} />
        {/* opacity slider */}
        <Line x1={160} y1={34} x2={160} y2={130} stroke={soft} strokeWidth={3} />
        <Line x1={160} y1={82} x2={160} y2={130} stroke={ink} strokeWidth={3} />
        <Circle cx={160} cy={82} r={7} fill={paper} stroke={ink} strokeWidth={2} />
        {/* padlock, closed */}
        <Rect x={83} y={30} width={22} height={17} rx={3} fill={ink} />
        <Path d="M87 30 V25 C87 18, 101 18, 101 25 V30" fill="none" stroke={ink} strokeWidth={2.5} />
        <Circle cx={94} cy={38.5} r={2} fill={paper} />
      </G>
    );
  } else {
    // Tracing: solid lines already traced, dashed ones still to go, and a single tap that brings the controls back.
    art = (
      <G {...stroke}>
        <Path d="M28 46 L188 40 L212 136 L20 142 Z" fill={paper} stroke={soft} strokeWidth={1.5} />
        <Path d="M54 116 C66 84, 92 78, 108 96" fill="none" stroke={lead} strokeWidth={2.5} />
        <Path d="M108 96 C122 112, 146 110, 158 82 C164 68, 176 66, 184 76" fill="none" stroke={soft} strokeWidth={2} strokeDasharray="4 6" />
        <Path d="M72 106 C76 98, 84 96, 88 102" fill="none" stroke={lead} strokeWidth={2} />
        {/* pencil at the join */}
        <Path d="M108 96 L132 62 L139 67 L115 101 Z" fill={paper} stroke={lead} strokeWidth={1.5} />
        <Path d="M108 96 L107 103 L115 101" fill={lead} stroke={lead} strokeWidth={1} />
        <Path d="M132 62 L136 56 L143 61 L139 67" fill={c.inkSoft} stroke={soft} strokeWidth={1.5} />
        {/* one tap: ripple and the control pills coming back */}
        <Circle cx={204} cy={22} r={5} fill={ink} fillOpacity={0.35} />
        <Circle cx={204} cy={22} r={11} fill="none" stroke={ink} strokeWidth={1.5} strokeOpacity={0.6} />
        <Circle cx={204} cy={22} r={17} fill="none" stroke={ink} strokeWidth={1} strokeOpacity={0.3} />
        <Rect x={150} y={10} width={30} height={12} rx={6} fill={ink} fillOpacity={0.25} />
        <Rect x={150} y={26} width={30} height={12} rx={6} fill={ink} fillOpacity={0.25} />
      </G>
    );
  }

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`}>
        {art}
      </Svg>
    </View>
  );
}
