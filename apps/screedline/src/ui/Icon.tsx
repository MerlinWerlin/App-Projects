/**
 * Icons: SF Symbols on iPhone (expo-symbols), so glyphs match the system and follow its weight. The Material
 * Community name is the fallback for the web preview only. Every name used in the app must be in SF below; the
 * registry test checks that.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';
import { SF } from './sf';

export function Icon({ name, size = 24, color, weight = 'semibold' }: { name: string; size?: number; color: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold' }) {
  const fallback = <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
  const sf = SF[name];
  if (Platform.OS !== 'ios' || !sf) return fallback;
  return <SymbolView name={sf as SFSymbol} size={size} tintColor={color} weight={weight} resizeMode="scaleAspectFit" style={{ width: size, height: size }} fallback={fallback} />;
}
