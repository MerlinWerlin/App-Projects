import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { MATERIALS, SHAPES, weight, type MaterialId, type ShapeId } from '../../src/core/weight.ts';
import { fmt, mass } from '../../src/core/units.ts';
import { Big, Card, Note, NumField, Row, Section, Txt, Working } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { shape: 'shs', material: 'mild', d0: '50', d1: '50', d2: '3', length: '6500', qty: '1', price: '' };
const LENGTHS = ['d0', 'd1', 'd2', 'length'] as const;

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ minHeight: 50, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: on ? C.accent : C.raised }}>
            <Txt v="headline" tone={on ? 'accentInk' : 'ink'}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function WeightTool() {
  const t = useTool('weight', DEFAULTS, LENGTHS);
  const U = t.units;
  const shape = t.v.shape as ShapeId;
  const dimNames = SHAPES[shape].dims;
  const price = t.v.price.trim() === '' ? undefined : t.num('price');
  const input = { shape, material: t.v.material as MaterialId, dims: dimNames.map((_, k) => t.mm(`d${k}`)), length: t.mm('length'), qty: t.num('qty'), pricePerKg: price };
  const r = useMemo(() => weight(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolScreen tool="weight" onSave={t.save} jobName={t.jobName}>
      <Section title="Section">
        <Chips value={shape} onChange={t.set('shape')} options={(Object.keys(SHAPES) as ShapeId[]).map(k => ({ value: k, label: SHAPES[k].name }))} />
      </Section>
      <Section title="Material">
        <Chips value={t.v.material as MaterialId} onChange={t.set('material')} options={(Object.keys(MATERIALS) as MaterialId[]).map(k => ({ value: k, label: MATERIALS[k].name }))} />
      </Section>
      <Section title="Size">
        <Row>
          {dimNames.map((name, k) => (
            <NumField key={name} label={name[0].toUpperCase() + name.slice(1)} value={t.v[`d${k}`] ?? ''} onChange={t.set(`d${k}`)} unit={t.u} invalid={t.invalid(`d${k}`)} />
          ))}
        </Row>
        <Row>
          <NumField label={shape === 'plate' ? 'Length' : 'Length each'} value={t.v.length} onChange={t.set('length')} unit={t.u} invalid={t.invalid('length')} />
          <NumField label="Quantity" value={t.v.qty} onChange={t.set('qty')} integer step={1} min={1} invalid={t.invalid('qty')} />
        </Row>
        <NumField label="Price per kg (optional)" value={t.v.price} onChange={t.set('price')} unit="$/kg" invalid={t.invalid('price')} />
      </Section>
      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <Card>
          <Row>
            <Big label="Total" value={mass(r.value.total, U)} sub={`${input.qty} × ${mass(r.value.each, U)}`} tone="accent" />
            <Big label={U === 'imperial' ? 'Per foot' : 'Per metre'} value={U === 'imperial' ? `${fmt((r.value.perMetre / 0.45359237) * 0.3048, 2)} lb` : `${fmt(r.value.perMetre, 2)} kg`} />
          </Row>
          {r.value.cost !== undefined ? <Big label="Cost" value={`$${fmt(r.value.cost, 2)}`} sub="at your price per kg" tone="arc" /> : null}
          <Working steps={r.steps} />
        </Card>
      )}
      {r.ok ? r.warnings.map(w => <Note key={w} kind="info">{w}</Note>) : null}
      <Txt v="small" tone="ink3">Nominal sizes and densities: real stock varies with mill tolerance. SHS/RHS uses the standard EN 10219 corner radii.</Txt>
    </ToolScreen>
  );
}
