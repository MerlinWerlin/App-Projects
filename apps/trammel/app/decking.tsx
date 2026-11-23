import { View } from 'react-native';
import { decking } from '../src/core/layout.ts';
import { useSettings } from '../src/state/settings.tsx';
import { space } from '../src/theme/theme.ts';
import { Blade, Checks, ErrorCard, Field, P, Readouts, StepsCard, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Decking() {
  const { fmt } = useSettings();
  const fine = useFine();
  const r = useReaders();
  const { vals, set } = useToolInputs('decking', (d) => ({ width: d.len(3000), length: d.len(4800), board: d.len(86), gap: d.len(5), joists: d.len(450), stock: d.len(5400), waste: '10' }));
  const res = decking({ deckWidth: r.len(vals.width) ?? NaN, deckLength: r.len(vals.length) ?? NaN, boardWidth: r.len(vals.board) ?? NaN, gap: r.len(vals.gap) ?? 0, joistSpacing: r.len(vals.joists), stockLength: r.len(vals.stock), wastePct: r.num(vals.waste) ?? 0 }, fmt);
  const v = res.ok ? res.value : null;
  const save = v ? { title: `Deck: ${v.boards} boards`, summary: `${v.boards} boards${v.ripped ? `, last ripped to ${fine(v.lastBoard)}` : ''}; ${fmt.num(v.withWaste, 1)} m with waste${v.stockPieces ? `, ${v.stockPieces} lengths` : ''}${v.fixings ? `, ${v.fixings} screws` : ''}`, inputs: vals } : null;
  const pair = (a: React.ReactNode, b: React.ReactNode) => (
    <View style={{ flexDirection: 'row', gap: space.m }}>
      <View style={{ flex: 1 }}>{a}</View>
      <View style={{ flex: 1 }}>{b}</View>
    </View>
  );
  return (
    <ToolShell tool="decking" save={save}>
      <P muted small>Width runs across the boards, length runs along them.</P>
      {pair(<Field label="Deck width" value={vals.width} onChange={set('width')} />, <Field label="Deck length" value={vals.length} onChange={set('length')} />)}
      {pair(<Field label="Board width" value={vals.board} onChange={set('board')} />, <Field label="Gap" value={vals.gap} onChange={set('gap')} />)}
      {pair(<Field label="Joist spacing" optional value={vals.joists} onChange={set('joists')} />, <Field label="Board length" optional value={vals.stock} onChange={set('stock')} />)}
      <Field label="Waste allowance" kind="number" value={vals.waste} onChange={set('waste')} hint="Percent" />
      {!res.ok || !v ? (
        <ErrorCard text={res.ok ? '' : res.error} />
      ) : (
        <>
          <Blade label="Boards across" value={String(v.boards)} sub={v.ripped ? `last board ripped to ${fine(v.lastBoard)}` : v.gapAdjust * (v.boards - 1) >= 3 ? `open each gap ${fine(v.gapAdjust)} to finish flush` : v.gapAdjust > 0 ? `finishes ${fine(v.gapAdjust * (v.boards - 1))} short of the edge` : 'finishes on a full board'} />
          <Readouts
            rows={[
              { label: 'Linear metres', value: `${fmt.num(v.linearMetres, 1)} m` },
              { label: 'With waste', value: `${fmt.num(v.withWaste, 1)} m`, strong: true },
              ...(v.stockPieces ? [{ label: `Lengths of ${fmt.len(r.len(vals.stock) ?? 0)}`, value: String(v.stockPieces), strong: true }] : []),
              ...(v.joists ? [{ label: 'Joists', value: String(v.joists) }] : []),
              ...(v.fixings ? [{ label: 'Screws (2 per joist)', value: String(v.fixings) }] : []),
            ]}
          />
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
          <Verify />
        </>
      )}
    </ToolShell>
  );
}
