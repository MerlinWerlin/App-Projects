/** Areas to tile (rectangles that add up, e.g. an L-shape) and cut-outs (windows, doors, baths) as typed rows. */
import { Pressable, View } from 'react-native';
import { Icon } from './Icon.tsx';
import { RADIUS, SPACE, useTheme } from '../theme/theme.ts';
import { useUnits } from './fields.tsx';
import { Btn, Field, Txt } from './kit.tsx';

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
        const title = r.cut ? `Cut-out ${n}` : `Area ${n}`;
        const showTitle = r.cut || adds > 1;
        return (
          <View key={i} style={{ backgroundColor: r.cut ? t.sunk : 'transparent', borderRadius: RADIUS.field, padding: r.cut ? SPACE.sm : 0 }}>
            {showTitle ? <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Txt v="headline" style={{ flex: 1 }}>{r.cut ? `${title}: taken off` : title}</Txt>
              {(r.cut || adds > 1) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={() => del(i)} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="remove" size={24} color={t.ink3} />
                </Pressable>
              ) : null}
            </View> : null}
            <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
              <Field flex={1} label={r.cut ? 'Width' : A} value={r.a} onChangeText={v => set(i, { a: v })} unit={u.unit('room')} keyboard={u.keyboard} accessibilityLabel={`${title} ${r.cut ? 'width' : A}`} />
              <Field flex={1} label={r.cut ? 'Height' : B} value={r.b} onChangeText={v => set(i, { b: v })} unit={u.unit('room')} keyboard={u.keyboard} accessibilityLabel={`${title} ${r.cut ? 'height' : B}`} />
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: SPACE.xs }}>
        <Btn kind="plain" icon="add" label={surface === 'wall' ? 'Wall' : 'Area'} accessibilityHint={surface === 'wall' ? 'Adds another wall' : 'Adds another rectangle, for an L-shape'} onPress={() => onChange([...rows, { a: '', b: '', cut: false }])} style={{ flex: 1, paddingHorizontal: SPACE.sm }} />
        <Btn kind="plain" icon="minus" label={surface === 'wall' ? 'Window, door' : 'Cut-out'} accessibilityHint="Adds an area that isn't tiled, like a bath or a window" onPress={() => onChange([...rows, { a: '', b: '', cut: true }])} style={{ flex: 1, paddingHorizontal: SPACE.sm }} />
      </View>
      <Txt v="footnote" tone="ink3">{u.system === 'metric' ? 'Sizes in mm. Type 2.4m for metres.' : `Room sizes in feet. Type 12' 6" or 150" for inches.`}</Txt>
    </View>
  );
}
