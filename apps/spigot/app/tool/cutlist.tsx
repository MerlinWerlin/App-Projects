import React, { useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cutList, type PieceSpec } from '../../src/calc/cutlist';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Button, Card, Field, FieldLabel, H, Note, ResultPanel, readField, useKeypad, useTap, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { HIT, font, radius, space, usePalette } from '../../src/ui/theme';

interface Line { length: number; qty: number }

export default function CutListScreen() {
  const c = usePalette();
  const tap = useTap();
  const { prefs, setPrefs } = useApp();
  const u = prefs.unit;
  const rec = useOpenedRecord();
  const ri = rec?.inputs ?? {};
  const [lines, setLines] = useState<Line[]>(() => Array.isArray(ri.pieces) ? (ri.pieces as Line[]).filter(p => typeof p?.length === 'number' && typeof p?.qty === 'number') : []);
  const [stock, setStock] = useState(lengthToInput(typeof ri.stock === 'number' ? ri.stock : prefs.stock, u));
  const [kerf, setKerf] = useState(lengthToInput(typeof ri.kerf === 'number' ? ri.kerf : prefs.kerf, u));
  const [trim, setTrim] = useState(typeof ri.trim === 'number' ? lengthToInput(ri.trim, u) : '');
  const [len, setLen] = useState('');
  const [qty, setQty] = useState('1');

  const fields: NumField[] = [
    { label: 'Piece length', text: len, setText: setLen, hint: 'Cut length of the piece' },
    { label: 'How many', text: qty, setText: setQty, kind: 'integer', suffix: 'pcs' },
    { label: 'Stock length', text: stock, setText: s => { setStock(s); const r = readField({ text: s }, u); if (typeof r === 'number' && r > 0) setPrefs({ stock: r }); }, hint: 'Usually 6 m (6000) for copper and PVC' },
    { label: 'Blade width (kerf)', text: kerf, setText: s => { setKerf(s); const r = readField({ text: s }, u); if (typeof r === 'number' && r >= 0) setPrefs({ kerf: r }); }, hint: 'Lost to each cut. Pipe cutter ≈ 0, saw ≈ 2' },
    { label: 'End trim', text: trim, setText: setTrim, optional: true, hint: 'Cut off the factory end of each length first' },
  ];
  const kp = useKeypad(fields);
  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };

  const add = () => {
    const l = num(0); const q = num(1) ?? 1;
    if (l === undefined || l <= 0 || !Number.isInteger(q) || q < 1) return;
    tap('success');
    setLines(ls => {
      const same = ls.findIndex(x => Math.abs(x.length - l) < 0.05);
      if (same >= 0) return ls.map((x, i) => (i === same ? { ...x, qty: Math.min(500, x.qty + q) } : x));
      return [...ls, { length: l, qty: Math.min(500, q) }];
    });
    setLen(''); setQty('1');
  };

  const pieces: PieceSpec[] = lines.map(l => ({ length: l.length, qty: l.qty }));
  const result = useMemo(() => {
    const s = num(2), k = num(3) ?? 0, t = num(4) ?? 0;
    if (!lines.length || s === undefined || errs.slice(2).some(Boolean)) return null;
    return cutList({ stock: s, kerf: k, trim: t, pieces });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stock, kerf, trim, u]);
  const plan = result && result.ok ? result.value : null;

  const snapshot = plan ? {
    inputs: { pieces: lines, stock: num(2)!, kerf: num(3) ?? 0, trim: num(4) ?? 0 },
    summary: `${plan.totalPieces} pieces from ${plan.bars.length} × ${formatLength(num(2)!, u, { metres: true })}`,
  } : null;

  const shareText = () => plan ? [
    `Spigot cut list: ${snapshot?.summary}`,
    `Blade ${formatLength(num(3) ?? 0, u)}, end trim ${formatLength(num(4) ?? 0, u)}`,
    ...plan.bars.map((b, i) => `Length ${i + 1}: ${b.pieces.map(p => formatLength(p.length, u)).join(' + ')}  (offcut ${formatLength(b.offcut, u)})`),
  ].join('\n') : '';

  return (
    <ToolFrame tool="cutlist" snapshot={snapshot}>
      <Stack.Screen options={{ title: 'Cut list' }} />
      <ResultPanel
        main={plan ? { label: 'Stock lengths needed', value: `${plan.bars.length} × ${formatLength(num(2)!, u, { metres: true })}` } : null}
        rest={plan ? [
          { label: 'Pieces', value: String(plan.totalPieces) },
          { label: 'Used', value: `${Math.round(plan.efficiency * 100)} %` },
          { label: 'Longest offcut', value: formatLength(Math.max(...plan.bars.map(b => b.offcut)), u) },
        ] : undefined}
        empty={result && !result.ok ? result.error : 'Add the lengths you need'}
      />
      {result && result.ok && result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
      <Card>
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 2 }}><Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} /></View>
          <View style={{ flex: 1 }}><Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} /></View>
        </View>
        <Button label="Add to list" icon="add" disabled={num(0) === undefined || !!errs[0] || !!errs[1]} onPress={add} />
        {lines.length ? (
          <View style={{ gap: space.s }}>
            <FieldLabel>{`Your list (${lines.reduce((s, l) => s + l.qty, 0)} pieces)`}</FieldLabel>
            {lines.map((l, i) => (
              <View key={i} style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: c.surface2, borderRadius: radius.m, paddingLeft: space.l }}>
                <Text style={{ flex: 1, fontFamily: font.display, fontSize: 24, color: c.ink }}>{formatLength(l.length, u)}</Text>
                <Text style={{ fontFamily: font.display, fontSize: 24, color: c.ink2 }}>× {l.qty}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${formatLength(l.length, u)}`} onPress={() => { tap(); setLines(ls => ls.filter((_, j) => j !== i)); }} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close-circle" size={28} color={c.ink3} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
      <Card>
        <Field field={fields[2]!} onOpen={() => kp.openAt(2)} error={errs[2]} />
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}><Field field={fields[3]!} onOpen={() => kp.openAt(3)} error={errs[3]} /></View>
          <View style={{ flex: 1 }}><Field field={fields[4]!} onOpen={() => kp.openAt(4)} error={errs[4]} /></View>
        </View>
      </Card>
      {plan ? (
        <View style={{ gap: space.m }}>
          <H>Cutting plan</H>
          {plan.bars.map((b, i) => <BarView key={i} index={i} bar={b} stock={num(2)!} unit={u} />)}
          <Button kind="secondary" icon="share-outline" label="Share cut list" onPress={() => { void Share.share({ message: shareText() }).catch(() => undefined); }} />
          <Note>{plan.optimal ? 'This is the fewest lengths possible for this list.' : 'Very good plan for a long list.'} Waste is kept in as few long offcuts as possible so they’re still usable.</Note>
        </View>
      ) : null}
      {kp.element}
    </ToolFrame>
  );
}

function BarView({ bar, index, stock, unit }: { bar: { pieces: { length: number }[]; offcut: number }; index: number; stock: number; unit: 'metric' | 'imperial' }) {
  const c = usePalette();
  const colours = [c.copper, c.vis, '#4F9DDE', '#58B368'];
  return (
    <Card style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.display, fontSize: 20, color: c.ink }}>LENGTH {index + 1}</Text>
        <Text style={{ fontSize: 15, color: c.ink3 }}>Offcut {formatLength(bar.offcut, unit)}</Text>
      </View>
      <View accessible accessibilityLabel={`Length ${index + 1}: ${bar.pieces.map(p => formatLength(p.length, unit)).join(', ')}, offcut ${formatLength(bar.offcut, unit)}`} style={{ flexDirection: 'row', height: 36, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface2, gap: 2 }}>
        {bar.pieces.map((p, j) => <View key={j} style={{ width: `${(p.length / stock) * 100}%`, backgroundColor: colours[j % colours.length] }} />)}
      </View>
      <Text style={{ fontFamily: font.displayMedium, fontSize: 20, color: c.ink2 }}>{bar.pieces.map(p => formatLength(p.length, unit)).join('  +  ')}</Text>
    </Card>
  );
}
