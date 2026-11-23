/**
 * "What your local supplier stocks" picker: sizes from the country's stock catalogue (src/core/catalogue.ts), then
 * the walls or thicknesses that size comes in. Picking one fills the calculator's fields; the fields stay editable
 * for anything custom. Never names a merchant in the UI.
 */
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { StockGroup, StockSize } from '../core/stock.ts';
import { useApp } from '../state/AppState.tsx';
import { Txt } from './kit.tsx';
import { C, RADIUS, SPACE } from './theme.ts';

function Chip({ label, on, onPress, a11y }: { label: string; on: boolean; onPress(): void; a11y?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={a11y ?? label}
      style={({ pressed }) => ({ minHeight: 48, minWidth: 56, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? C.accent : pressed ? C.line : C.raised })}>
      <Txt v="headline" tone={on ? 'accentInk' : 'ink'} numberOfLines={1}>{label}</Txt>
    </Pressable>
  );
}

export function StockPicker({ group, onPick, what }: { group: StockGroup | null; onPick(size: StockSize, wallMm: number | null): void; what: string }) {
  const { country } = useApp();
  const [size, setSize] = useState<number | null>(null);
  const [wall, setWall] = useState<number | null>(null);
  if (!group || !group.verified) {
    return (
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACE.md }}>
        <Txt v="small" tone="ink2">
          {country.code === 'OTHER'
            ? `No stock list for your country: type the ${what} below.`
            : `No verified stock list of ${what} for ${country.name} yet: type your size below.`}
        </Txt>
      </View>
    );
  }
  const chosen = size !== null ? group.sizes[size] : null;
  return (
    <View style={{ gap: SPACE.sm }}>
      <Txt v="small" tone="ink3">Commonly stocked in {country.name}{group.partial ? ' (partial list)' : ''}. Tap one, or type a custom size below.</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }} keyboardShouldPersistTaps="handled">
        {group.sizes.map((s, k) => (
          <Chip key={`${s.label}-${k}`} label={s.label} on={k === size} onPress={() => {
            setSize(k);
            setWall(null);
            if (!s.walls.length) onPick(s, null);
          }} />
        ))}
      </ScrollView>
      {chosen && chosen.walls.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }} keyboardShouldPersistTaps="handled">
          {chosen.walls.map((w, k) => (
            <Chip key={w.label + k} label={w.label} on={k === wall} a11y={`${chosen.label}, ${w.label} wall`} onPress={() => { setWall(k); onPick(chosen, w.mm); }} />
          ))}
        </ScrollView>
      ) : null}
      {group.note ? <Txt v="small" tone="ink3">{group.note}</Txt> : null}
    </View>
  );
}
