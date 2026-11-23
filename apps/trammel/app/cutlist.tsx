// Cut list: stock lengths and pieces as editable rows (kept as JSON in the saved inputs), then the cutting plan.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { optimiseCuts } from '../src/core/cutlist.ts';
import { lengthToInput } from '../src/core/units.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, TOUCH, useTheme } from '../src/theme/theme.ts';
import { CutBars } from '../src/ui/diagrams.tsx';
import { Blade, Button, Card, Checks, ErrorCard, Field, H, P, Readouts, StepsCard, useReaders } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

type Row = { l: string; q: string; n?: string };

function rows(raw: string | undefined, fallback: Row[]): Row[] {
  try {
    const v = JSON.parse(raw ?? '');
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object').map((x) => ({ l: String(x.l ?? ''), q: String(x.q ?? ''), n: x.n == null ? undefined : String(x.n) }));
  } catch {
    // fall through
  }
  return fallback;
}

export default function CutList() {
  const t = useTheme();
  const { fmt, settings } = useSettings();
  const r = useReaders();
  const L = (mm: number) => lengthToInput(mm, settings.units, settings.denom);
  const { vals, set } = useToolInputs('cutlist', (d) => ({
    stock: JSON.stringify([{ l: d.len(6000), q: '' }, { l: d.len(5400), q: '' }]),
    pieces: JSON.stringify([
      { l: d.len(2400), q: '8', n: 'Studs' },
      { l: d.len(1100), q: '8', n: 'Noggins' },
      { l: d.len(600), q: '6', n: 'Trimmers' },
    ]),
    kerf: String(settings.kerf),
    trim: '',
  }));
  const stock = rows(vals.stock, [{ l: L(6000), q: '' }]);
  const pieces = rows(vals.pieces, []);
  const setRows = (key: 'stock' | 'pieces', list: Row[]) => set(key)(JSON.stringify(list));
  const res = optimiseCuts(
    {
      stock: stock.map((s) => ({ length: r.len(s.l) ?? NaN, qty: s.q.trim() ? Number(s.q) : null })),
      pieces: pieces.map((p) => ({ length: r.len(p.l) ?? NaN, qty: p.q.trim() ? Number(p.q) : NaN, label: p.n?.trim() || undefined })),
      kerf: r.num(vals.kerf) ?? 0,
      trim: r.len(vals.trim) ?? 0,
    },
    fmt,
  );
  const plan = res.ok ? res.value : null;
  const planText = plan
    ? [`Cut list (kerf ${vals.kerf} mm)`, ...plan.bars.map((b, i) => `#${i + 1} ${fmt.len(b.stock)}: ${b.cuts.map((c) => `${fmt.len(c.length)}${c.label ? ` ${c.label}` : ''}`).join(' + ')} (offcut ${fmt.len(b.offcut)})`), `Buy: ${plan.byStock.map((s) => `${s.count} x ${fmt.len(s.length)}`).join(', ')}`].join('\n')
    : '';
  const save = plan ? { title: `Cut list: ${plan.bars.length} lengths`, summary: `Buy ${plan.byStock.map((s) => `${s.count} x ${fmt.len(s.length)}`).join(', ')}; ${fmt.num(plan.yieldPct, 1)}% used, ${fmt.len(plan.offcutTotal)} offcut`, inputs: vals } : null;
  return (
    <ToolShell tool="cutlist" save={save}>
      <Card>
        <H>Stock lengths</H>
        <P muted small>Leave the number empty if you can get as many as you need.</P>
        {stock.map((s, i) => (
          <RowEditor key={`s${i}`} row={s} qtyHint="Any" onChange={(row) => setRows('stock', stock.map((x, k) => (k === i ? row : x)))} onRemove={stock.length > 1 ? () => setRows('stock', stock.filter((_, k) => k !== i)) : undefined} />
        ))}
        <Button label="Add a stock length" kind="quiet" icon="add-circle-outline" onPress={() => setRows('stock', [...stock, { l: '', q: '' }])} />
      </Card>
      <Card>
        <H>Pieces to cut</H>
        {pieces.map((p, i) => (
          <RowEditor key={`p${i}`} row={p} named qtyHint="1" onChange={(row) => setRows('pieces', pieces.map((x, k) => (k === i ? row : x)))} onRemove={() => setRows('pieces', pieces.filter((_, k) => k !== i))} />
        ))}
        <Button label="Add a piece" kind="quiet" icon="add-circle-outline" onPress={() => setRows('pieces', [...pieces, { l: '', q: '1', n: '' }])} />
      </Card>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Field label="Saw kerf (mm)" kind="number" value={vals.kerf} onChange={set('kerf')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="End trim" optional value={vals.trim} onChange={set('trim')} />
        </View>
      </View>
      {!res.ok || !plan ? (
        <ErrorCard text={res.ok ? '' : res.error} />
      ) : (
        <>
          <Blade label="Buy" value={`${plan.bars.length} length${plan.bars.length === 1 ? '' : 's'}`} sub={`${plan.byStock.map((s) => `${s.count} × ${fmt.len(s.length)}`).join(' + ')}\n${fmt.num(plan.yieldPct, 1)}% of the timber used · ${fmt.len(plan.offcutTotal)} offcut`} />
          <Checks checks={res.checks.filter((c) => c.level === 'fail')} />
          <Card>
            <H>Cutting plan</H>
            <P muted small>Cut left to right. Each length is shown to scale.</P>
            <CutBars bars={plan.bars} label={(mm) => fmt.len(mm)} />
          </Card>
          <Readouts
            rows={[
              { label: 'Pieces', value: fmt.len(plan.piecesLength) },
              { label: 'Saw kerf', value: fmt.len(plan.kerfTotal) },
              { label: 'Offcuts', value: fmt.len(plan.offcutTotal) },
              { label: 'Timber bought', value: fmt.len(plan.bought), strong: true },
            ]}
          />
          <Button label="Share cut list" kind="secondary" icon="share-outline" onPress={() => Share.share({ message: planText }).catch(() => {})} />
          <Checks checks={res.checks.filter((c) => c.level !== 'fail')} />
          <StepsCard steps={res.steps} />
        </>
      )}
    </ToolShell>
  );
}

// Top level (not inside CutList) so its inputs keep focus while typing.
function RowEditor({ row, onChange, onRemove, named, qtyHint }: { row: Row; onChange: (r: Row) => void; onRemove?: () => void; named?: boolean; qtyHint: string }) {
  const t = useTheme();
  const { settings } = useSettings();
  const r = useReaders();
  const bad = row.l.trim() !== '' && r.len(row.l) == null;
  const input = { minHeight: TOUCH, borderRadius: radius.m, borderWidth: 2, backgroundColor: t.card, paddingHorizontal: space.s, fontFamily: fonts.display, fontSize: 24, color: t.ink } as const;
  return (
    <View style={{ gap: space.xs, paddingBottom: space.s, borderBottomWidth: 1, borderBottomColor: t.line }}>
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
        <TextInput value={row.l} onChangeText={(l) => onChange({ ...row, l })} placeholder="Length" placeholderTextColor={t.muted} keyboardType={settings.units === 'imperial' ? 'numbers-and-punctuation' : 'decimal-pad'} accessibilityLabel="Length" selectTextOnFocus style={[input, { flex: 2, minWidth: 0, borderColor: bad ? t.bad : t.line }]} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: t.muted }}>×</Text>
        <TextInput value={row.q} onChangeText={(q) => onChange({ ...row, q: q.replace(/[^0-9]/g, '') })} placeholder={qtyHint} placeholderTextColor={t.muted} keyboardType="number-pad" accessibilityLabel="How many" selectTextOnFocus style={[input, { flex: 1, minWidth: 0, borderColor: t.line }]} />
        {onRemove ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove this row" hitSlop={8} style={{ width: 44, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close-circle" size={28} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      {named ? <TextInput value={row.n ?? ''} onChangeText={(n) => onChange({ ...row, n })} placeholder="Name (optional), e.g. Studs" placeholderTextColor={t.muted} accessibilityLabel="Piece name" style={{ minHeight: 44, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.ink, paddingHorizontal: space.s }} /> : null}
      {bad ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: t.bad }}>Can’t read that length</Text> : null}
    </View>
  );
}
