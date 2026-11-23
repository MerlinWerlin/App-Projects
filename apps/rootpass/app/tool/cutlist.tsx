import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { cutList, type Part } from '../../src/core/cutlist.ts';
import { lenShort, parseNum, toMm } from '../../src/core/units.ts';
import { Big, Btn, Card, Note, NumField, Row, Section, Txt, VERIFY, Working } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const MAX_ROWS = 12;
const DEFAULTS: Record<string, string> = { stock: '6500', kerf: '3', trim: '10', rows: '3', l0: '1800', q0: '4', l1: '950', q1: '6', l2: '600', q2: '4' };
const LENGTHS = ['stock', 'kerf', 'trim', ...Array.from({ length: MAX_ROWS }, (_, k) => `l${k}`)] as const;

export default function CutListTool() {
  const t = useTool('cutlist', DEFAULTS, LENGTHS);
  const U = t.units;
  const rows = Math.min(MAX_ROWS, Math.max(1, t.num('rows') || 1));
  const parts: Part[] = [];
  for (let k = 0; k < rows; k++) {
    const l = t.v[`l${k}`] ?? '';
    if (l.trim() === '') continue;
    parts.push({ length: toMm(parseNum(l), U), qty: (t.v[`q${k}`] ?? '').trim() === '' ? 1 : parseNum(t.v[`q${k}`]) });
  }
  const input = { stock: t.mm('stock'), kerf: t.v.kerf.trim() === '' ? 0 : t.mm('kerf'), trim: t.v.trim.trim() === '' ? 0 : t.mm('trim'), parts };
  const r = useMemo(() => cutList(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeRow = (k: number) => {
    const next: Record<string, string> = {};
    for (let j = k; j < rows - 1; j++) { next[`l${j}`] = t.v[`l${j + 1}`] ?? ''; next[`q${j}`] = t.v[`q${j + 1}`] ?? ''; }
    next[`l${rows - 1}`] = ''; next[`q${rows - 1}`] = '';
    next.rows = String(Math.max(1, rows - 1));
    t.setMany(next);
  };

  return (
    <ToolScreen tool="cutlist" onSave={t.save} jobName={t.jobName}>
      <Section title="Stock">
        <NumField label="Stock length" value={t.v.stock} onChange={t.set('stock')} unit={t.u} hint="Most RHS, SHS and angle comes in 6.5 m or 8 m lengths." invalid={t.invalid('stock')} />
        <Row>
          <NumField label="Blade kerf" value={t.v.kerf} onChange={t.set('kerf')} unit={t.u} invalid={t.invalid('kerf')} />
          <NumField label="End trim" value={t.v.trim} onChange={t.set('trim')} unit={t.u} hint="Squared off each new length." invalid={t.invalid('trim')} />
        </Row>
      </Section>
      <Section title="Parts">
        {Array.from({ length: rows }, (_, k) => (
          <View key={k} style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 2 }}><NumField label={`Part ${k + 1} length`} value={t.v[`l${k}`] ?? ''} onChange={t.set(`l${k}`)} unit={t.u} invalid={t.invalid(`l${k}`)} /></View>
            <View style={{ flex: 1.1 }}><NumField label="Qty" value={t.v[`q${k}`] ?? ''} onChange={t.set(`q${k}`)} integer invalid={t.invalid(`q${k}`)} /></View>
            {rows > 1 ? (
              <Pressable onPress={() => removeRow(k)} accessibilityRole="button" accessibilityLabel={`Remove part ${k + 1}`} style={{ width: 48, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={24} color={C.ink3} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {rows < MAX_ROWS ? <Btn kind="secondary" icon="add" label="Add a part" onPress={() => t.setMany({ rows: String(rows + 1), [`l${rows}`]: '', [`q${rows}`]: '1' })} /> : null}
      </Section>

      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <Card>
          <Row>
            <Big label="Stock lengths" value={String(r.value.bars.length)} sub={r.value.optimal ? 'fewest possible' : `at least ${r.value.lowerBound} needed`} tone="accent" />
            <Big label="Pieces" value={String(r.value.pieces)} sub={`${lenShort(r.value.partsLength, U)} ${t.u} of parts`} />
          </Row>
          {r.value.bars.map((b, k) => (
            <View key={k} style={{ gap: 6 }}>
              <Txt v="label" tone="ink2">Length {k + 1}: {b.cuts.map(c => lenShort(c.length, U)).join(' + ')}</Txt>
              <View style={{ flexDirection: 'row', height: 34, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: C.ground }} accessible accessibilityLabel={`Length ${k + 1}: ${b.cuts.length} pieces, offcut ${lenShort(b.offcut, U)} ${t.u}`}>
                {input.trim > 0 ? <View style={{ flex: input.trim, backgroundColor: C.line }} /> : null}
                {b.cuts.map((c, j) => (
                  <View key={j} style={{ flex: c.length, backgroundColor: j % 2 ? '#C8601A' : C.accent, borderRightWidth: 2, borderRightColor: C.ground, justifyContent: 'center', overflow: 'hidden' }}>
                    <Txt v="small" tone="accentInk" numberOfLines={1} style={{ textAlign: 'center', fontWeight: '700' }}>{lenShort(c.length, U)}</Txt>
                  </View>
                ))}
                {b.offcut > 0 ? <View style={{ flex: b.offcut, backgroundColor: C.raised }} /> : null}
              </View>
              <Txt v="small" tone="ink3">Offcut {lenShort(b.offcut, U)} {t.u}</Txt>
            </View>
          ))}
          <Txt v="small" tone="ink3">Buying {r.value.bars.length} × {lenShort(input.stock, U)} {t.u}: {lenShort(r.value.waste, U)} {t.u} goes to kerf, trim and offcuts.</Txt>
          <Working steps={r.steps} />
        </Card>
      )}
      <Note>{VERIFY}</Note>
    </ToolScreen>
  );
}
