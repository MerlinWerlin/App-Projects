/** Areas to tile (rectangles that add up, e.g. an L-shape) and cut-outs (windows, doors, baths) as typed rows. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { RADIUS, SPACE, useTheme } from '../theme/theme.ts';
import { useUnits } from './fields.tsx';
import { Field, Txt } from './kit.tsx';

export interface AreaRow { a: string; b: string; cut: boolean; label?: string }

export const encodeRows = (rows: AreaRow[]) => JSON.stringify(rows);
export function decodeRows(s: string | undefined, fallback: AreaRow[]): AreaRow[] {
  try {
    const v = JSON.parse(s ?? '');
    if (Array.isArray(v) && v.every(r => r && typeof r.a === 'string' && typeof r.b === 'string')) return v.map(r => ({ a: r.a, b: r.b, cut: !!r.cut, label: typeof r.label === 'string' ? r.label : undefined }));
  } catch { /* fall through */ }
  return fallback;
}

export function AreaRows({ rows, onChange, surface }: { rows: AreaRow[]; onChange(rows: AreaRow[]): void; surface: 'floor' | 'wall' }) {
  const t = useTheme();
  const u = useUnits();
  const set = (i: number, p: Partial<AreaRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const del = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const adds = rows.filter(r => !r.cut).length;
  const A = surface === 'wall' ? 'Wall width' : 'Length';
  const B = surface === 'wall' ? 'Height' : 'Width';
  let addN = 0, cutN = 0;
  return (
    <View style={{ gap: SPACE.sm }}>
      {rows.map((r, i) => {
        const n = r.cut ? ++cutN : ++addN;
        const title = r.cut ? `Cut-out ${n}` : adds > 1 ? `Area ${n}` : surface === 'wall' ? 'Wall' : 'Floor';
        return (
          <View key={i} style={{ backgroundColor: r.cut ? t.sunk : 'transparent', borderRadius: RADIUS.field, padding: r.cut ? SPACE.sm : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Txt v="headline" style={{ flex: 1 }}>{r.cut ? `− ${title}` : title}</Txt>
              {(r.cut || adds > 1) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={() => del(i)} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close-circle" size={26} color={t.ink3} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
              <Field flex={1} label={r.cut ? 'Width' : A} value={r.a} onChangeText={v => set(i, { a: v })} unit={u.unit('room')} keyboard={u.keyboard} accessibilityLabel={`${title} ${r.cut ? 'width' : A}`} />
              <Field flex={1} label={r.cut ? 'Height' : B} value={r.b} onChangeText={v => set(i, { b: v })} unit={u.unit('room')} keyboard={u.keyboard} accessibilityLabel={`${title} ${r.cut ? 'height' : B}`} />
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs }}>
        <AddChip icon="add" label={surface === 'wall' ? 'Add a wall' : 'Add area (L-shape)'} onPress={() => onChange([...rows, { a: '', b: '', cut: false }])} />
        <AddChip icon="remove" label={surface === 'wall' ? 'Window or door' : 'Cut-out (bath, cabinet)'} onPress={() => onChange([...rows, { a: '', b: '', cut: true }])} />
      </View>
      <Txt v="footnote" tone="ink3">{u.system === 'metric' ? 'Sizes in mm. Type 2.4m for metres.' : `Room sizes in feet. Type 12' 6" or 150" for inches.`}</Txt>
    </View>
  );
}

function AddChip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: SPACE.md, borderRadius: RADIUS.chip, borderWidth: 1.5, borderColor: t.ink, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={t.ink} />
      <Txt v="headline">{label}</Txt>
    </Pressable>
  );
}
