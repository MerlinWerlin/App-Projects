import Svg, { Rect, Path } from 'react-native-svg';
import { petById, type PetId, type PetMood } from '../core/islandPets';

export function IslandPetArt({ pet, mood = 'happy', size = 80 }: { pet: PetId; mood?: PetMood; size?: number }) {
  const p = petById(pet);
  return <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {p.rows.flatMap((row, y) => [...row].map((pixel, x) => {
      if (pixel === '.') return null;
      const fill = pixel === '#' || pixel === 'e' ? '#35283F' : pixel === 'w' ? '#FFF5E5' : p.color;
      return <Rect key={`${x}:${y}`} x={x} y={y + (pixel === 'e' && mood === 'sleepy' ? 0.55 : 0)} width={1}
        height={pixel === 'e' && mood === 'sleepy' ? 0.3 : 1} fill={fill} />;
    }))}
    {mood === 'playful' ? <Path d="M13 0h1v1h1v1h-1v1h-1V2h-1V1h1z" fill="#F2C252" /> : null}
    {mood === 'happy' ? <Path d="M12 10h1v-1h1v1h1v1h-1v1h-1v-1h-1z" fill="#E478A5" /> : null}
  </Svg>;
}
