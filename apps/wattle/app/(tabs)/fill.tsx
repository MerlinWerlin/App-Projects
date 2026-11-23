/** Conduit fill: cables vs the conduit's inside area, against the 53/31/40 % guide. */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CABLES, CONDUITS, conduitFill } from '../../src/core/fill.ts';
import { newId } from '../../src/core/jobs.ts';
import { fmt, parseNum } from '../../src/core/num.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE } from '../../src/theme/theme.ts';
import { Btn, Card, FieldRow, Locked, NumField, Result, Screen, Segmented, Txt } from '../../src/ui/kit.tsx';
import { useSave } from '../../src/ui/useSave.ts';

interface Line { id: string; preset: string; od: string; qty: string }

export default function Fill() {
  const app = useApp();
  const { theme } = app;
  const save = useSave();
  const [conduit, setConduit] = useState('pvc20');
  const [cid, setCid] = useState(String(CONDUITS.find(c => c.id === 'pvc20')!.idMm));
  const [lines, setLines] = useState<Line[]>([{ id: 'l1', preset: 'v2.5', od: '3.6', qty: '3' }]);

  const pickConduit = (id: string) => {
    setConduit(id);
    const c = CONDUITS.find(x => x.id === id);
    if (c) setCid(String(c.idMm));
  };
  const patch = (id: string, p: Partial<Line>) => setLines(ls => ls.map(l => (l.id === id ? { ...l, ...p } : l)));

  const r = useMemo(() => conduitFill({
    conduitId: parseNum(cid),
    lines: lines.map(l => ({ label: CABLES.find(c => c.id === l.preset)?.label, od: parseNum(l.od), qty: parseNum(l.qty) })),
  }), [cid, lines]);

  const answers = r.ok ? [
    { label: 'Fill', value: `${fmt(r.value.fillPct, 1)} %` },
    { label: 'Guide limit', value: `${fmt(r.value.limitPct, 0)} %` },
    { label: 'Cables', value: String(r.value.count) },
    ...(r.value.maxSame != null ? [{ label: 'Most of this cable', value: String(r.value.maxSame) }] : []),
  ] : [];

  return (
    <Screen title="Conduit fill" sub="How full is the conduit?">
      {!app.can('fill') ? <Locked what="Conduit fill" /> : (
        <>
          <Segmented label="Conduit size" value={conduit} onChange={pickConduit} options={[...CONDUITS.map(c => ({ id: c.id, label: c.label.replace(' PVC', '') })), { id: 'custom', label: 'Other' }]} />
          <NumField label="Conduit inside diameter" value={cid} onChange={v => { setCid(v); setConduit('custom'); }} unit="mm" hint="Approximate for medium-duty PVC. Use the maker’s inside diameter for your conduit." />
          {lines.map((l, i) => (
            <Card key={l.id} style={{ gap: SPACE.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Txt v="headline" style={{ flex: 1 }}>Cable {i + 1}</Txt>
                {lines.length > 1 ? (
                  <Pressable onPress={() => setLines(ls => ls.filter(x => x.id !== l.id))} accessibilityRole="button" accessibilityLabel={`Remove cable ${i + 1}`} hitSlop={12} style={{ padding: SPACE.xs }}>
                    <Ionicons name="trash-outline" size={22} color={theme.fail} />
                  </Pressable>
                ) : null}
              </View>
              <Segmented label={`Cable ${i + 1} type`} value={l.preset} onChange={id => patch(l.id, { preset: id, od: String(CABLES.find(c => c.id === id)?.odMm ?? l.od) })}
                options={[...CABLES.map(c => ({ id: c.id, label: c.label.replace(' single (V-90)', '') })), { id: 'custom', label: 'Other' }]} />
              <FieldRow>
                <NumField label="Overall diameter" value={l.od} onChange={v => patch(l.id, { od: v, preset: 'custom' })} unit="mm" />
                <NumField label="How many" value={l.qty} onChange={v => patch(l.id, { qty: v })} integer />
              </FieldRow>
            </Card>
          ))}
          <Btn title="Add another cable" icon="add" kind="secondary" onPress={() => setLines(ls => [...ls, { id: newId(), preset: 'v2.5', od: '3.6', qty: '1' }])} />
          <Result
            error={r.ok ? null : r.error}
            answers={answers}
            status={r.ok ? (r.value.pass ? 'pass' : 'fail') : undefined}
            statusText={r.ok ? (r.value.pass ? 'Inside the guide' : 'Over the guide') : undefined}
            steps={r.ok ? r.steps : []}
            warnings={r.ok ? r.warnings : []}
            onSave={r.ok ? () => save({ kind: 'fill', title: 'Conduit fill', lines: [`Conduit ID ${cid} mm`, ...lines.map(l => `${l.qty} × ${CABLES.find(c => c.id === l.preset)?.label ?? `${l.od} mm cable`}`), ...answers.map(a => `${a.label}: ${a.value}`)], steps: r.steps }) : undefined}
          />
          <Txt v="footnote" tone="ink2">Guide: 53 % for one cable, 31 % for two, 40 % for three or more (NEC Chapter 9). For Australian compliance, check AS/NZS 3000 Appendix C and the conduit maker. Cable diameters vary by brand: check the datasheet.</Txt>
        </>
      )}
    </Screen>
  );
}
