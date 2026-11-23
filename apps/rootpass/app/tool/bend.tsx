import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { bend, defaultK } from '../../src/core/bend.ts';
import { fmt, len, parseNum, toMm } from '../../src/core/units.ts';
import { Big, Btn, Card, Note, NumField, Row, Section, Txt, VERIFY, Working } from '../../src/ui/kit.tsx';
import { C } from '../../src/ui/theme.ts';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const MAX = 8;
const DEFAULTS: Record<string, string> = { t: '2', r: '2', angle: '90', k: '', flanges: '2', f0: '50', f1: '30' };
const LENGTHS = ['t', 'r', ...Array.from({ length: MAX }, (_, k) => `f${k}`)] as const;

export default function BendTool() {
  const t = useTool('bend', DEFAULTS, LENGTHS);
  const U = t.units;
  const T = t.mm('t'), R = t.mm('r');
  const autoK = Number.isFinite(T) && Number.isFinite(R) && T > 0 ? defaultK(R, T) : 0.4;
  const k = t.v.k.trim() === '' ? autoK : t.num('k');
  const n = Math.min(MAX, Math.max(2, t.num('flanges') || 2));
  const flanges = Array.from({ length: n }, (_, j) => toMm(parseNum(t.v[`f${j}`] ?? ''), U));
  const input = { thickness: T, radius: R, angleDeg: t.num('angle'), k, flanges: flanges.every(f => Number.isFinite(f)) ? flanges : undefined };
  const r = useMemo(() => bend(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolScreen tool="bend" onSave={t.save} jobName={t.jobName}>
      <Section title="Material and tooling">
        <Row>
          <NumField label="Thickness" value={t.v.t} onChange={t.set('t')} unit={t.u} invalid={t.invalid('t')} />
          <NumField label="Inside radius" value={t.v.r} onChange={t.set('r')} unit={t.u} invalid={t.invalid('r')} />
        </Row>
        <Row>
          <NumField label="Bend angle" value={t.v.angle} onChange={t.set('angle')} unit="°" step={5} min={1} hint="How far it bends from flat: 90 for a right angle." invalid={t.invalid('angle')} />
          <NumField label="K-factor" value={t.v.k} onChange={t.set('k')} hint={`Blank = ${fmt(autoK, 2)} for this radius. Use your shop's figure if you have one.`} invalid={t.invalid('k')} />
        </Row>
      </Section>
      <Section title="Outside flange lengths (optional)">
        <Row>
          {Array.from({ length: n }, (_, j) => (
            <NumField key={j} label={`Flange ${j + 1}`} value={t.v[`f${j}`] ?? ''} onChange={t.set(`f${j}`)} unit={t.u} invalid={t.invalid(`f${j}`)} />
          ))}
        </Row>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {n < MAX ? <View style={{ flex: 1 }}><Btn kind="secondary" icon="add" label="Add a bend" onPress={() => t.setMany({ flanges: String(n + 1), [`f${n}`]: '' })} /></View> : null}
          {n > 2 ? (
            <Pressable onPress={() => t.setMany({ flanges: String(n - 1), [`f${n - 1}`]: '' })} accessibilityRole="button" accessibilityLabel="Remove the last bend" style={{ width: 60, minHeight: 60, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="remove-circle-outline" size={28} color={C.ink3} />
            </Pressable>
          ) : null}
        </View>
        <Txt v="small" tone="ink3">Measured to the outside of each bend, every bend at the same angle and radius.</Txt>
      </Section>
      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <Card>
          {r.value.flat !== undefined ? <Big label="Flat blank" value={len(r.value.flat, U)} sub={`${n - 1} bend${n - 1 === 1 ? '' : 's'}`} tone="accent" /> : null}
          <Row>
            <Big label="Bend deduction" value={Number.isFinite(r.value.bd) ? len(r.value.bd, U, 2) : '–'} />
            <Big label="Bend allowance" value={len(r.value.ba, U, 2)} />
          </Row>
          <Big label="Outside setback" value={Number.isFinite(r.value.ossb) ? len(r.value.ossb, U, 2) : '–'} />
          <Working steps={r.steps} />
        </Card>
      )}
      {r.ok ? r.warnings.map(w => <Note key={w} kind="warn">{w}</Note>) : null}
      <Note>Do a test bend on an offcut: K-factor changes with the brake, tooling and material. {VERIFY}</Note>
    </ToolScreen>
  );
}
