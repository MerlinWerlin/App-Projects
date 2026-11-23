import { useMemo } from 'react';
import { saddle } from '../../src/core/saddle.ts';
import { saddleQuarterLabel, saddleTemplate } from '../../src/core/templates.ts';
import { fmt, len, lenShort } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { Big, Btn, Card, Note, NumField, Row, Section, Segmented, TableRows, Txt, VERIFY, Working } from '../../src/ui/kit.tsx';
import { PipeChips, WrapPreview } from '../../src/ui/parts.tsx';
import { ToolScreen, usePdfExport, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { header: '114.3', branch: '88.9', wall: '5.5', angle: '90', offset: '0', contact: 'inside', height: '', divisions: '16' };
const LENGTHS = ['header', 'branch', 'wall', 'offset', 'height'] as const;

export default function SaddleTool() {
  const app = useApp();
  const t = useTool('saddle', DEFAULTS, LENGTHS);
  const exportPdf = usePdfExport();
  const input = {
    headerOD: t.mm('header'),
    branchOD: t.mm('branch'),
    branchWall: t.v.contact === 'inside' ? t.mm('wall') : 0,
    angleDeg: t.num('angle'),
    offset: t.v.offset.trim() === '' ? 0 : t.mm('offset'),
    contact: t.v.contact === 'outside' ? 'outside' as const : 'inside' as const,
    heightFromCentre: t.v.height.trim() === '' ? 0 : t.mm('height'),
    divisions: t.num('divisions'),
  };
  const r = useMemo(() => saddle(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const U = t.units;

  return (
    <ToolScreen tool="saddle" onSave={t.save} jobName={t.jobName}>
      <Section title="Header (run pipe)">
        <NumField label="Outside diameter" value={t.v.header} onChange={t.set('header')} unit={t.u} invalid={t.invalid('header')} />
        <PipeChips units={U} selectedMm={input.headerOD} onPick={t.set('header')} />
      </Section>
      <Section title="Branch (the pipe you cut)">
        <NumField label="Outside diameter" value={t.v.branch} onChange={t.set('branch')} unit={t.u} invalid={t.invalid('branch')} />
        <PipeChips units={U} selectedMm={input.branchOD} onPick={t.set('branch')} />
        <Segmented
          label="Line sits on"
          value={t.v.contact as 'inside' | 'outside'}
          onChange={t.set('contact')}
          options={[{ value: 'inside', label: 'Inside of wall' }, { value: 'outside', label: 'Outside of wall' }]}
        />
        {t.v.contact === 'inside' ? (
          <NumField label="Branch wall" value={t.v.wall} onChange={t.set('wall')} unit={t.u} hint="Set-on branch: the bore sits on the header, so the line is worked on the inside of the wall." invalid={t.invalid('wall')} />
        ) : null}
      </Section>
      <Section title="Position">
        <Row>
          <NumField label="Angle between pipes" value={t.v.angle} onChange={t.set('angle')} unit="°" step={5} min={10} hint="90° = square tee" invalid={t.invalid('angle')} />
        </Row>
        <Row>
          <NumField label="Offset from centre" value={t.v.offset} onChange={t.set('offset')} unit={t.u} allowNegative hint="0 = on centre. Off-centre (tangent) branches move toward one side." invalid={t.invalid('offset')} />
        </Row>
        <Row>
          <NumField label="Branch end from header centre (optional)" value={t.v.height} onChange={t.set('height')} unit={t.u} hint="Gives the length of pipe to cut." invalid={t.invalid('height')} />
        </Row>
      </Section>

      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <>
          <Card>
            <Row>
              <Big label="Deepest cut" value={len(r.value.maxDepth, U)} sub="back from a square end" tone="accent" />
              <Big label="Wrap length" value={len(r.value.circumference, U)} sub="branch circumference" />
            </Row>
            {r.value.longLength !== undefined ? (
              <Row>
                <Big label="Cut pipe to" value={len(r.value.longLength, U)} sub={`long point; short point ${len(r.value.shortLength!, U)}`} tone="arc" />
              </Row>
            ) : null}
            <WrapPreview
              points={r.value.points}
              circumference={r.value.circumference}
              maxDepth={r.value.maxDepth}
              ordinates={r.value.ordinates}
              labels={deg => saddleQuarterLabel(deg, input.angleDeg)}
            />
            <Btn
              label="Print true-scale template"
              icon="print"
              onPress={() => exportPdf(() => {
                const doc = saddleTemplate(input, U, app.prefs.paper);
                return doc.ok ? { doc: doc.value.doc, fileName: `Saddle ${fmt(input.branchOD, 1)} on ${fmt(input.headerOD, 1)} at ${fmt(input.angleDeg, 0)}deg` } : null;
              })}
            />
            <Working steps={r.steps} />
          </Card>
          {r.warnings.map(w => <Note key={w} kind="warn">{w}</Note>)}
          <Section title={`Ordinates (${t.u}, cut back from a square end)`}>
            <Segmented
              value={String(input.divisions) as '8' | '12' | '16' | '24'}
              onChange={t.set('divisions')}
              options={[{ value: '8', label: '8' }, { value: '12', label: '12' }, { value: '16', label: '16' }, { value: '24', label: '24' }]}
            />
            <TableRows
              head={['Line', 'Angle', 'Round', 'Cut back']}
              rows={r.value.ordinates.slice(0, -1).map((o, k) => [k + 1, `${fmt(o.phiDeg, o.phiDeg % 1 ? 1 : 0)}°`, lenShort(o.x, U), lenShort(o.h, U)])}
            />
            <Txt v="small" tone="ink3">Divide the branch into equal lines starting at a SIDE (0°). "Round" is the distance round the outside from line 1. Mark each cut-back from a square line, join the marks with a smooth curve.</Txt>
          </Section>
          <Note>{VERIFY}</Note>
        </>
      )}
    </ToolScreen>
  );
}
