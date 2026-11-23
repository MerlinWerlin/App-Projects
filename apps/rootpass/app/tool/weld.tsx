import { useMemo } from 'react';
import { legFromThroat, PROCESSES, weldFiller, type Joint, type ProcessId } from '../../src/core/weld.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { fmt, lenShort, mass } from '../../src/core/units.ts';
import { Big, Card, Note, NumField, Row, Section, Segmented, Txt, Working } from '../../src/ui/kit.tsx';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { joint: 'fillet', size: 'leg', throat: '4', legA: '6', legB: '6', t: '10', gap: '2', face: '1.5', angle: '60', length: '10000', reinf: '10', process: 'gmaw', eff: '' };
const LENGTHS = ['throat', 'legA', 'legB', 't', 'gap', 'face', 'length'] as const;

export default function WeldTool() {
  const app = useApp();
  // ISO 2553 drawings (UK, Ireland) size fillets by throat a; AS 1554 and AWS usually by leg.
  const sizeDefault = app.country.code === 'GB' || app.country.code === 'IE' ? 'throat' : 'leg';
  const t = useTool('weld', { ...DEFAULTS, size: sizeDefault }, LENGTHS, { joint: ['fillet', 'singleV', 'doubleV', 'squareButt'], process: Object.keys(PROCESSES), size: ['leg', 'throat'] }, { throat: '0.1875', legA: '0.25', legB: '0.25', t: '0.375', gap: '0.0625', face: '0.0625', length: '400' });
  const byThroat = t.v.size === 'throat';
  const U = t.units;
  const kind = t.v.joint as Joint['kind'];
  const joint: Joint = kind === 'fillet'
    ? (byThroat ? { kind, legA: legFromThroat(t.mm('throat')), legB: legFromThroat(t.mm('throat')) } : { kind, legA: t.mm('legA'), legB: t.mm('legB') })
    : kind === 'squareButt'
      ? { kind, thickness: t.mm('t'), gap: t.mm('gap') }
      : { kind, thickness: t.mm('t'), gap: t.mm('gap'), rootFace: t.mm('face'), includedDeg: t.num('angle') };
  const process = (t.v.process in PROCESSES ? t.v.process : 'gmaw') as ProcessId;
  const eff = t.v.eff.trim() === '' ? undefined : t.num('eff') / 100;
  const input = { joint, length: t.mm('length'), reinforcementPct: t.v.reinf.trim() === '' ? 0 : t.num('reinf'), process, efficiency: eff };
  const r = useMemo(() => weldFiller(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = r.ok ? (
    <Card>
      <Row>
        <Big label="Filler to buy" value={mass(r.value.fillerKg, U)} sub={`about ${r.value.packs} × ${r.value.packName}`} tone="accent" />
        <Big label="Weld metal" value={mass(r.value.depositedKg, U)} sub="deposited in the joint" />
      </Row>
      <Big label={U === 'imperial' ? 'Per foot of weld' : 'Per metre of weld'} value={U === 'imperial' ? mass(r.value.perMetreKg * 0.3048, U) : mass(r.value.perMetreKg, U)} />
      <Working steps={r.steps} />
    </Card>
  ) : null;

  return (
    <ToolScreen tool="weld" onSave={t.save} jobName={t.jobName} preview={results}>
      <Segmented value={kind} onChange={t.set('joint')} options={[{ value: 'fillet', label: 'Fillet' }, { value: 'singleV', label: 'Single V' }, { value: 'doubleV', label: 'Double V' }, { value: 'squareButt', label: 'Square' }]} />
      <Section title="Joint">
        {kind === 'fillet' ? (
          <>
            <Segmented label="Size by" value={t.v.size as 'leg' | 'throat'} onChange={t.set('size')} options={[{ value: 'leg', label: 'Leg length' }, { value: 'throat', label: 'Throat (a)' }]} />
            {byThroat ? (
              <NumField label="Throat a" value={t.v.throat} onChange={t.set('throat')} unit={t.u} invalid={t.invalid('throat')}
                hint={`Equal-leg 90° fillet: leg = a × √2 = ${Number.isFinite(t.mm('throat')) ? lenShort(legFromThroat(t.mm('throat')), U, 1) : '–'} ${t.u}`} />
            ) : (
              <Row>
                <NumField label="Leg A" value={t.v.legA} onChange={t.set('legA')} unit={t.u} invalid={t.invalid('legA')} />
                <NumField label="Leg B" value={t.v.legB} onChange={t.set('legB')} unit={t.u} invalid={t.invalid('legB')} />
              </Row>
            )}
          </>
        ) : (
          <>
            <Row>
              <NumField label="Plate thickness" value={t.v.t} onChange={t.set('t')} unit={t.u} invalid={t.invalid('t')} />
              <NumField label="Root gap" value={t.v.gap} onChange={t.set('gap')} unit={t.u} invalid={t.invalid('gap')} />
            </Row>
            {kind !== 'squareButt' ? (
              <Row>
                <NumField label="Root face" value={t.v.face} onChange={t.set('face')} unit={t.u} invalid={t.invalid('face')} />
                <NumField label="Included angle" value={t.v.angle} onChange={t.set('angle')} unit="°" step={5} min={5} invalid={t.invalid('angle')} />
              </Row>
            ) : null}
          </>
        )}
        <Row>
          <NumField label="Total weld length" value={t.v.length} onChange={t.set('length')} unit={t.u} invalid={t.invalid('length')} />
          <NumField label="Reinforcement" value={t.v.reinf} onChange={t.set('reinf')} unit="%" step={5} min={0} hint="Cap and convexity" invalid={t.invalid('reinf')} />
        </Row>
      </Section>
      <Section title="Process">
        <Segmented
          value={process}
          onChange={t.set('process')}
          options={[{ value: 'gmaw', label: 'MIG' }, { value: 'fcawG', label: 'Flux gas' }, { value: 'fcawS', label: 'Gasless' }, { value: 'mmaw', label: 'Stick' }, { value: 'gtaw', label: 'TIG' }]}
        />
        <NumField label="Efficiency (optional)" value={t.v.eff} onChange={t.set('eff')} unit="%" hint={`Typical for ${PROCESSES[process].name}: ${fmt(PROCESSES[process].efficiency * 100, 0)} %. Leave blank to use it.`} invalid={t.invalid('eff')} />
      </Section>
      {!r.ok ? <Note kind="error">{r.error}</Note> : results}
      {r.ok ? r.warnings.map(w => <Note key={w} kind="info">{w}</Note>) : null}
      <Txt v="small" tone="ink3">Carbon steel density 7850 kg/m³. For stainless the figure is about 2 % higher.</Txt>
    </ToolScreen>
  );
}
