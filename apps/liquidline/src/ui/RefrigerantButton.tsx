// The refrigerant chooser shown at the top of each calculator: name, safety class and the safety reminder.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { refrigerant, safetyNote, SAFETY_LABEL } from '../core/refrigerants.ts';
import { useCountry } from '../state/prefs.ts';
import { useSettings } from '../state/store.ts';
import { FONT, RADIUS, SPACE, TOUCH, usePalette } from '../theme/tokens.ts';
import { Chip, Notice } from './kit.tsx';

export function RefrigerantButton({ showNote = true }: { showNote?: boolean }) {
  const p = usePalette();
  const s = useSettings();
  const c = useCountry();
  const r = refrigerant(s.refrigerant);
  const note = safetyNote(s.refrigerant, c.flammableStandard);
  return (
    <View style={{ gap: SPACE.sm }}>
      <Pressable
        testID="refrigerant-button"
        accessibilityRole="button"
        accessibilityLabel={`Refrigerant ${r?.name ?? s.refrigerant}, ${r ? SAFETY_LABEL[r.safety] : ''}. Change`}
        onPress={() => router.push('/refrigerants')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: p.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.lg, minHeight: TOUCH + 16, opacity: pressed ? 0.7 : 1, borderWidth: 1, borderColor: p.line })}
      >
        <Text style={{ fontFamily: FONT.display, fontSize: 36, color: p.text }}>{r?.id ?? s.refrigerant}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          {r ? <Chip text={SAFETY_LABEL[r.safety]} tone={r.safety === 'A1' ? 'neutral' : 'warn'} /> : null}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: p.text2 }}>Change</Text>
        <Ionicons name="chevron-down" size={20} color={p.text2} />
      </Pressable>
      {showNote && note ? <Notice text={note} /> : null}
    </View>
  );
}
