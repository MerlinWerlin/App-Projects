import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { money } from '../../src/core/country.ts';
import { stockFor, type StockSize } from '../../src/core/stock.ts';
import { fmt, fromMm, mass } from '../../src/core/units.ts';
import { MATERIALS, SHAPES, weight, type MaterialId, type ShapeId } from '../../src/core/weight.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { Big, Card, Note, NumField, Row, Section, Txt, Working } from '../../src/ui/kit.tsx';
import { StockPicker } from '../../src/ui/StockPicker.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { shape: 'shs', material: 'mild', d0: '50', d1: '50', d2: '3', length: '6500', qty: '1', price: '' };
const LENGTHS = ['d0', 'd1', 'd2', 'length'] as const;

/** Which dimension fields a stocked size and wall fill, per shape (order of SHAPES[shape].dims). */
function stockFields(shape: ShapeId, s: StockSize, wallMm: number | null): Record<string, number> {
  switch (shape) {
    case 'shs':
    case 'angle': return wallMm === null ? { d0: s.dims[0], d1: s.dims[1] } : { d0: s.dims[0], d1: s.dims[1], d2: wallMm };
    case 'chs':
    case 'flat': return wallMm === null ? { d0: s.dims[0] } : { d0: s.dims[0], d1: wallMm };
    case 'plate': return { d1: s.dims[0] };
    case 'round': return { d0: s.dims[0] };
    default: return {};
  }
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ minHeight: 50, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: on ? C.accent : pressed ? C.line : C.raised })}>
            <Txt v="headline" tone={on ? 'accentInk' : 'ink'}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const SHAPE_WORD: Record<ShapeId, string> = { plate: 'plate thicknesses', flat: 'flat bar', round: 'round bar', square: 'square bar', chs: 'round tube and pipe', shs: 'box section', angle: 'angle' };

export default function WeightTool() {
  const app = useApp();
  const t = useTool('weight', DEFAULTS, LENGTHS, { shape: Object.keys(SHAPES), material: Object.keys(MATERIALS) });
  const U = t.units;
  const shape = (t.v.shape in SHAPES ? t.v.shape : 'shs') as ShapeId;
  const dimNames = SHAPES[shape].dims;
  const price = t.v.price.trim() === '' ? undefined : t.num('price');
  const input = { shape, material: t.v.material as MaterialId, dims: dimNames.map((_, k) => t.mm(`d${k}`)), length: t.mm('length'), qty: t.num('qty'), pricePerKg: price };
  const r = useMemo(() => weight(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const stock = useMemo(() => stockFor(app.country.code, shape), [app.country.code, shape]);
  const show = (mm: number) => {
    const v = fromMm(mm, U);
    return U === 'imperial' ? String(Math.round(v * 10000) / 10000) : String(Math.round(v * 100) / 100);
  };

  return (
    <ToolScreen tool="weight" onSave={t.save} jobName={t.jobName}>
      <Section title="Section">
        <Chips value={shape} onChange={t.set('shape')} options={(Object.keys(SHAPES) as ShapeId[]).map(k => ({ value: k, label: app.sp(SHAPES[k].name) }))} />
      </Section>
      <Section title="Size">
        {shape !== 'square' ? (
          <StockPicker
            key={`${shape}-${app.country.code}`}
            group={stock}
            what={SHAPE_WORD[shape]}
            onPick={(s, w) => t.setMany(Object.fromEntries(Object.entries(stockFields(shape, s, w)).map(([k, mm]) => [k, show(mm)])))}
          />
        ) : null}
        <Row>
          {dimNames.map((name, k) => (
            <NumField key={name} label={name[0].toUpperCase() + name.slice(1)} value={t.v[`d${k}`] ?? ''} onChange={t.set(`d${k}`)} unit={t.u} invalid={t.invalid(`d${k}`)} />
          ))}
        </Row>
        <Row>
          <NumField label={shape === 'plate' ? 'Length' : 'Length each'} value={t.v.length} onChange={t.set('length')} unit={t.u} invalid={t.invalid('length')} />
          <NumField label="Quantity" value={t.v.qty} onChange={t.set('qty')} integer step={1} min={1} invalid={t.invalid('qty')} />
        </Row>
      </Section>
      <Section title="Material">
        <Chips value={t.v.material as MaterialId} onChange={t.set('material')} options={(Object.keys(MATERIALS) as MaterialId[]).map(k => ({ value: k, label: app.sp(MATERIALS[k].name) }))} />
        <NumField label="Price per kg (optional)" value={t.v.price} onChange={t.set('price')} unit={`${app.country.currency?.symbol ?? ''}/kg`} invalid={t.invalid('price')} />
      </Section>
      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <Card>
          <Row>
            <Big label="Total" value={mass(r.value.total, U)} sub={`${input.qty} × ${mass(r.value.each, U)}`} tone="accent" />
            <Big label={U === 'imperial' ? 'Per foot' : 'Per metre'} value={U === 'imperial' ? `${fmt((r.value.perMetre / 0.45359237) * 0.3048, 2)} lb` : `${fmt(r.value.perMetre, 2)} kg`} />
          </Row>
          {r.value.cost !== undefined ? <Big label="Cost" value={money(r.value.cost, app.country)} sub="at your price per kg" tone="arc" /> : null}
          <Working steps={r.steps} />
        </Card>
      )}
      {r.ok ? r.warnings.map(w => <Note key={w} kind="info">{w}</Note>) : null}
      <Txt v="small" tone="ink3">Nominal sizes and densities: real stock varies with mill tolerance. Box section uses the standard EN 10219 corner radii.</Txt>
    </ToolScreen>
  );
}
