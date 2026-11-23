import { View } from 'react-native';
import { decking } from '../src/core/layout.ts';
import { materialsFor } from '../src/core/materials.ts';
import { useSettings } from '../src/state/settings.tsx';
import { space } from '../src/theme/theme.ts';
import { Blade, Checks, ErrorCard, Field, P, Readouts, Segment, StepsCard, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';
import { lengthToInput } from '../src/core/units.ts';

export default function Decking() {
  const { fmt, country, settings } = useSettings();
  const cat = materialsFor(country.code);
  const first = cat.decking[0];
  const fine = useFine();
  const r = useReaders();
  const { vals, set, setAll } = useToolInputs('decking', (d) => ({ width: d.len(3000, 144), length: d.len(4800, 192), boardId: first.id, board: d.len(first.w), gap: d.len(5, 0.1875), joists: d.len(country.spacings[d.units === 'imperial' ? 1 : Math.min(2, country.spacings.length - 1)]), stock: first.lengths.length ? d.len(Math.max(...first.lengths)) : '', waste: '10' }));
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
      <Segment
        chips
        label={cat.verified ? `Boards stocked in ${country.name}` : 'Common boards (generic)'}
        options={[...cat.decking.map((b) => ({ value: b.id, label: b.name })), { value: 'custom', label: 'Custom' }]}
        value={vals.boardId || 'custom'}
        onChange={(id) => {
          const b = cat.decking.find((x) => x.id === id);
          const L = (mm: number) => lengthToInput(mm, settings.units, settings.denom);
          setAll((v) => ({ ...v, boardId: id, board: b ? L(b.w) : v.board, stock: b ? (b.lengths.length ? L(Math.max(...b.lengths)) : '') : v.stock }));
        }}
      />
      {cat.decking.find((b) => b.id === vals.boardId) ? <P muted small>{`${cat.decking.find((b) => b.id === vals.boardId)!.material}. ${cat.decking.find((b) => b.id === vals.boardId)!.lengths.length ? `Lengths ${cat.decking.find((b) => b.id === vals.boardId)!.lengths.map((l) => fmt.len(l)).join(', ')}.` : 'Usually sold in random lengths or by the metre.'}`}</P> : null}
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
