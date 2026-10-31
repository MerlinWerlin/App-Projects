import Svg, { G, Path, Rect } from 'react-native-svg';
import { petById, type PetId, type PetMood } from '../core/islandPets';
import type { PetFrameSet } from '../core/petLife';

/**
 * Original pixel companions. `frames` picks the pose from src/core/petLife.ts (the Live Activity
 * in targets/widget/IslandPetActivity.swift draws the same poses): sleep lies low with closed eyes
 * and a z, stretch stands a little taller, eat dips the head over a bowl, play tilts with a ball,
 * walk faces the way it is going, cheer has happy eyes and a heart.
 */
export function IslandPetArt({ pet, mood = 'happy', size = 80, frames, facingLeft = false }: {
  pet: PetId; mood?: PetMood; size?: number; frames?: PetFrameSet; facingLeft?: boolean;
}) {
  const p = petById(pet);
  const closed = frames === 'sleep' || frames === 'stretch' || (!frames && mood === 'sleepy');
  const cheer = frames === 'cheer';
  const lift = frames === 'sleep' ? 1.5 : frames === 'eat' ? 0.5 : 0;
  const transform = [
    'translate(8 16)',
    frames === 'play' ? 'rotate(-6)' : '',
    `scale(${facingLeft ? -1 : 1} ${frames === 'stretch' ? 1.08 : 1})`,
    'translate(-8 -16)',
  ].filter(Boolean).join(' ');
  return <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G transform={transform}>
      {p.rows.flatMap((row, y) => [...row].map((pixel, x) => {
        if (pixel === '.') return null;
        const fill = pixel === '#' || pixel === 'e' ? '#35283F' : pixel === 'w' ? '#FFF5E5' : p.color;
        const eye = pixel === 'e';
        const dy = eye && closed ? 0.55 : eye && cheer ? 0.15 : 0;
        return <Rect key={`${x}:${y}`} x={x} y={y + lift + dy} width={1}
          height={eye && (closed || cheer) ? 0.3 : 1} fill={fill} />;
      }))}
    </G>
    {frames === 'sleep' ? <Path d="M12 1h3v1h-1v1h-1v1h2v1h-3V4h1V3h1V2h-2z" fill="#E9DDF5" /> : null}
    {frames === 'eat' ? <Path d="M11 14h5v1h-1v1h-3v-1h-1z" fill="#F2C252" /> : null}
    {frames === 'play' ? <Rect x={13.5} y={13.5} width={2} height={2} rx={1} fill="#E478A5" /> : null}
    {frames === 'stretch' || (!frames && mood === 'playful')
      ? <Path d="M13 0h1v1h1v1h-1v1h-1V2h-1V1h1z" fill="#F2C252" /> : null}
    {frames === 'walk' ? <Rect x={facingLeft ? 13 : 2} y={15.2} width={1} height={0.6} fill="#E9DDF5" /> : null}
    {cheer || (!frames && mood === 'happy') ? <Path d="M12 10h1v-1h1v1h1v1h-1v1h-1v-1h-1z" fill="#E478A5" /> : null}
  </Svg>;
}
