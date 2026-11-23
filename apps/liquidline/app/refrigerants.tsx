// Refrigerant picker: the ones common in the person's country first, then the rest.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { refrigerant, SAFETY_LABEL } from '../src/core/refrigerants.ts';
import { hasGlide } from '../src/core/pt.ts';
import { useCountry } from '../src/state/prefs.ts';
import { updateSettings, useSettings } from '../src/state/store.ts';
import { FONT, RADIUS, SPACE, TOUCH, usePalette } from '../src/theme/tokens.ts';
import { Chip, Label, Screen } from '../src/ui/kit.tsx';

export default function RefrigerantPicker() {
  const c = useCountry();
  const s = useSettings();
  const common = c.refrigerants.slice(0, c.commonCount);
  const rest = c.refrigerants.slice(c.commonCount);
  return (
    <Screen tab={false}>
      <Label>{c.guided ? `Common in ${c.name}` : 'Common'}</Label>
      <List ids={common} current={s.refrigerant} />
      <Label>More refrigerants</Label>
      <List ids={rest} current={s.refrigerant} />
    </Screen>
  );
}

function List({ ids, current }: { ids: string[]; current: string }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: p.line }}>
      {ids.map((id, i) => {
        const r = refrigerant(id);
        if (!r) return null;
        const on = id === current;
        return (
          <Pressable
            key={id}
            testID={`pick-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${r.name}, ${SAFETY_LABEL[r.safety]}${r.legacy ? ', legacy' : ''}`}
            onPress={() => {
              updateSettings({ refrigerant: id });
              router.back();
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH + 8, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, backgroundColor: pressed ? p.surface2 : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: p.line })}
          >
            <Text style={{ fontFamily: FONT.display, fontSize: 28, color: p.text, minWidth: 96 }}>{r.id}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Chip text={r.safety} tone={r.safety === 'A1' ? 'neutral' : 'warn'} />
                {hasGlide(id) && r.kind === 'zeotrope' ? <Chip text="Glide" tone="low" /> : null}
                {r.legacy ? <Chip text="Legacy" /> : null}
              </View>
              <Text numberOfLines={2} style={{ fontSize: 14, color: p.text2 }}>{r.uses}</Text>
            </View>
            {on ? <Ionicons name="checkmark-circle" size={26} color={p.ok} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
