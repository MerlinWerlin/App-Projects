import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Shape, ShapeKind } from '../core/concrete';
import { SUPPLIER_NOTE } from '../core/jobs';
import { fmtField, fromMetric, parseNumber, toMetric, unitLabel, type FieldKind, type UnitSystem } from '../core/units';
import { useApp } from '../state/AppState';
import { BOLD, FONT, RADIUS, SPACE, TARGET } from '../theme/theme';
import { defaults, type Field, type Run, type Tool, type Values, visible } from '../tools/registry';
import { line, showOut } from '../tools/present';
import { Button, Card, Choice, DONE_ID, DoneBar, FieldShell, Icon, NumberInput, T } from './kit';

type Texts = Record<string, string>;
interface UiShape { kind: ShapeKind; a: string; b: string; subtract: boolean }

const dpFor = (kind: FieldKind, sys: UnitSystem) => (kind === 'count' ? 0 : kind === 'svol' && sys === 'metric' ? 4 : sys === 'imperial' && kind !== 'num' && kind !== 'pct' ? 2 : (kind === 'thick' || kind === 'size') ? 1 : 3);
const toText = (kind: FieldKind, v: unknown, sys: UnitSystem) => (typeof v === 'number' && Number.isFinite(v) ? fmtField(fromMetric(kind, v, sys), dpFor(kind, sys)) : '');
const fromText = (kind: FieldKind, s: string, sys: UnitSystem) => {
  const x = parseNumber(s);
  return x === null ? null : toMetric(kind, x, sys);
};

function initialTexts(tool: Tool, v: Values, sys: UnitSystem) {
  const texts: Texts = {};
  const choices: Record<string, string> = {};
  let shapes: UiShape[] = [];
  for (const f of tool.fields) {
    if (f.type === 'num') texts[f.key] = toText(f.kind, v[f.key], sys);
    else if (f.type === 'choice') choices[f.key] = typeof v[f.key] === 'string' && f.options.some(o => o.value === v[f.key]) ? (v[f.key] as string) : f.def;
    else if (f.type === 'list') texts[f.key] = (Array.isArray(v[f.key]) ? (v[f.key] as (number | null)[]) : f.def).map(x => toText('len', x, sys)).join(', ');
    else if (f.type === 'shapes') shapes = (Array.isArray(v[f.key]) ? (v[f.key] as Shape[]) : f.def).map(s => ({ kind: s.kind, a: toText('len', s.a, sys), b: toText('len', s.b ?? null, sys), subtract: !!s.subtract }));
  }
  return { texts, choices, shapes };
}

export function ToolView({ tool, prefill, jobContext }: { tool: Tool; prefill?: Values; jobContext?: string }) {
  const app = useApp();
  const { theme, prefs } = app;
  const sys = prefs.units;
  const insets = useSafeAreaInsets();
  const start = useMemo(() => {
    const base = defaults(tool, tool.fields.some(f => f.key === 'waste' && f.type === 'num' && f.label === 'Waste allowance') ? { waste: prefs.waste } : {});
    return { ...base, ...(prefill ?? app.drafts[tool.id] ?? {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);
  const init = useMemo(() => initialTexts(tool, start, sys), [tool, start, sys]);
  const [texts, setTexts] = useState<Texts>(init.texts);
  const [choices, setChoices] = useState(init.choices);
  const [shapes, setShapes] = useState<UiShape[]>(init.shapes);
  const [showWorking, setShowWorking] = useState(false);
  const lastSys = useRef(sys);

  // Re-show the same canonical values if units change while this screen is open.
  useEffect(() => {
    if (lastSys.current === sys) return;
    const prev = lastSys.current;
    lastSys.current = sys;
    const canonical = valuesFrom(tool, texts, choices, shapes, prev);
    const next = initialTexts(tool, canonical, sys);
    setTexts(next.texts); setShapes(next.shapes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys]);

  const values = useMemo(() => valuesFrom(tool, texts, choices, shapes, sys), [tool, texts, choices, shapes, sys]);
  const run: Run | null = useMemo(() => (tool.run ? tool.run(values) : null), [tool, values]);
  useEffect(() => { app.setDraft(tool.id, values); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [values]);

  const locked = !app.canUse(tool.id);
  const errors = run && !run.ok ? run.errors : {};

  const setChoice = (f: Extract<Field, { type: 'choice' }>, val: string) => {
    setChoices(c => ({ ...c, [f.key]: val }));
    if (f.apply) {
      const patch = f.apply(val);
      setTexts(t => {
        const next = { ...t };
        for (const [k, v] of Object.entries(patch)) {
          const field = tool.fields.find(x => x.key === k);
          if (field?.type === 'num') next[k] = toText(field.kind, v, sys);
        }
        return next;
      });
      const choicePatch = Object.entries(patch).filter(([k, v]) => typeof v === 'string' && tool.fields.some(x => x.key === k && x.type === 'choice'));
      if (choicePatch.length) setChoices(c => ({ ...c, ...Object.fromEntries(choicePatch) as Record<string, string> }));
    }
  };

  const summary = (): string[] => {
    if (!run || !run.ok) return [];
    const inputs = tool.fields.filter(f => visible(f, values) && f.type !== 'shapes').map(f => {
      if (f.type === 'choice') return `${f.label} ${f.options.find(o => o.value === choices[f.key])?.label ?? ''}`;
      if (f.type === 'list') return `${f.label} ${texts[f.key]} ${unitLabel('len', sys)}`;
      if (f.type !== 'num') return '';
      return texts[f.key] ? `${f.label} ${texts[f.key]}${unitLabel(f.kind, sys) ? ' ' + unitLabel(f.kind, sys) : ''}` : '';
    }).filter(Boolean);
    const u = unitLabel('len', sys);
    const shapeLine = tool.fields.some(f => f.type === 'shapes') && shapes.length
      ? `Shapes: ${shapes.map(s => `${s.subtract ? 'minus ' : ''}${s.kind === 'rect' ? `rectangle ${s.a} × ${s.b}` : s.kind === 'tri' ? `triangle ${s.a} × ${s.b}` : `circle ⌀${s.a}`} ${u}`).join(', ')}`
      : null;
    const h = showOut(run.headline, sys);
    return [
      `${run.headline.label}: ${h.value}${h.unit ? ' ' + h.unit : ''} (${run.headline.caption})`,
      ...run.outputs.map(o => line(o, sys)),
      ...(run.table ? run.table.rows.map(([a, b]) => `${showOut(a, sys).value} ${showOut(a, sys).unit}: ${showOut(b, sys).value} ${showOut(b, sys).unit}`) : []),
      ...(shapeLine ? [shapeLine] : []),
      `Inputs: ${inputs.join(', ')}`,
    ];
  };

  const save = () => {
    const lines = summary();
    if (!lines.length) return;
    const put = (jobId: string) => {
      app.saveToJob(jobId, { toolId: tool.id, title: tool.title, values, lines });
      const name = app.jobs.find(j => j.id === jobId)?.name;
      Alert.alert('Saved', name ? `Added to ${name}.` : 'Added to the job.');
    };
    const newJob = () => {
      if (!app.canAddJob) { router.push('/unlock'); return; }
      const create = (name?: string) => { const j = app.createJob(name ?? ''); if (j) { app.saveToJob(j.id, { toolId: tool.id, title: tool.title, values, lines }); Alert.alert('Saved', `Added to ${j.name}.`); } };
      if (Platform.OS === 'ios') Alert.prompt('New job', 'Name it after the client or address.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: (name?: string) => create(name) }], 'plain-text');
      else create('New job');
    };
    if (jobContext && app.jobs.some(j => j.id === jobContext)) return put(jobContext);
    const recent = app.jobs.slice(0, 6);
    if (!recent.length) return newJob();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Save to job', options: [...recent.map(j => j.name), 'New job…', 'Cancel'], cancelButtonIndex: recent.length + 1 },
        i => { if (i < recent.length) put(recent[i]!.id); else if (i === recent.length) newJob(); },
      );
    } else put(recent[0]!.id);
  };

  const share = () => {
    const lines = summary();
    if (!lines.length) return;
    Share.share({ message: [tool.title.toUpperCase(), ...lines, '', SUPPLIER_NOTE].join('\n') }).catch(() => undefined);
  };

  if (locked) return <Locked tool={tool} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <ScrollView
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xxl }}
      >
        <View style={{ backgroundColor: theme.ground, paddingHorizontal: SPACE.l, paddingTop: SPACE.s, paddingBottom: SPACE.m }}>
          <ResultSlab run={run} />
        </View>
        <View style={{ paddingHorizontal: SPACE.l, gap: SPACE.l }}>
          {tool.fields.filter(f => visible(f, values)).map(f => {
            if (f.type === 'num') {
              return (
                <FieldShell key={f.key} label={f.label} help={f.help} error={errors[f.key]}>
                  <NumberInput label={f.label} value={texts[f.key] ?? ''} onChange={s => setTexts(t => ({ ...t, [f.key]: s }))} unit={unitLabel(f.kind, sys)} integer={f.kind === 'count'} negative={f.kind === 'temp'} error={!!errors[f.key]} placeholder={f.optional ? 'Optional' : undefined} />
                </FieldShell>
              );
            }
            if (f.type === 'choice') {
              return (
                <FieldShell key={f.key} label={f.label} help={f.help} error={errors[f.key]}>
                  <Choice label={f.label} options={f.options} value={choices[f.key] ?? f.def} onChange={v => setChoice(f, v)} />
                </FieldShell>
              );
            }
            if (f.type === 'list') {
              return (
                <FieldShell key={f.key} label={`${f.label} (${unitLabel('len', sys)})`} help={f.help} error={errors[f.key]}>
                  <TextInput
                    accessibilityLabel={f.label}
                    value={texts[f.key] ?? ''}
                    onChangeText={s => setTexts(t => ({ ...t, [f.key]: s }))}
                    keyboardType="numbers-and-punctuation"
                    inputAccessoryViewID={DONE_ID}
                    maxFontSizeMultiplier={1.5}
                    style={{ minHeight: 64, borderRadius: RADIUS.m, borderWidth: errors[f.key] ? 3 : theme.borderWidth, borderColor: errors[f.key] ? theme.danger : theme.fieldLine, backgroundColor: theme.card, paddingHorizontal: SPACE.l, fontFamily: FONT.num, fontSize: 28, color: theme.ink }}
                  />
                </FieldShell>
              );
            }
            return <ShapesEditor key={f.key} shapes={shapes} setShapes={setShapes} errors={errors} sys={sys} />;
          })}

          {run && run.ok ? <Outputs run={run} /> : null}

          {run && run.ok && run.notes.length ? (
            <Card alt style={{ gap: SPACE.s }}>
              {run.notes.map((n, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: SPACE.s }}>
                  <Icon name="information-outline" size={20} color={theme.ink} />
                  <T kind="small" color={theme.ink} style={{ flex: 1 }}>{n}</T>
                </View>
              ))}
            </Card>
          ) : null}

          {run && run.ok ? (
            <Card style={{ padding: 0 }}>
              <Pressable testID="show-working" accessibilityRole="button" accessibilityState={{ expanded: showWorking }} onPress={() => setShowWorking(s => !s)} style={{ minHeight: TARGET, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.l, gap: SPACE.s }}>
                <Icon name="calculator-variant-outline" size={22} color={theme.ink} />
                <T kind="label" style={{ flex: 1 }}>Show the working</T>
                <Icon name={showWorking ? 'chevron-up' : 'chevron-down'} size={24} color={theme.ink2} />
              </Pressable>
              {showWorking ? (
                <View style={{ paddingHorizontal: SPACE.l, paddingBottom: SPACE.l, gap: SPACE.m }}>
                  {sys === 'imperial' ? <T kind="small">Working is shown in metric. Your inputs were converted exactly (1 ft = 0.3048 m).</T> : null}
                  {run.steps.map((s, i) => (
                    <View key={i} style={{ gap: 2, backgroundColor: theme.cardAlt, borderRadius: RADIUS.s, paddingHorizontal: SPACE.m, paddingVertical: SPACE.s }}>
                      <T kind="small">{s.label}</T>
                      <T style={{ fontFamily: FONT.num, fontSize: 20 }}>{s.working} = <Text style={{ fontFamily: FONT.numBold }}>{s.result}</Text></T>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          {run && run.ok && run.next ? (
            <Button kind="secondary" icon="truck-outline" label={run.next.label} onPress={() => router.push({ pathname: '/tool/[id]', params: { id: run.next!.tool, prefill: JSON.stringify(run.next!.values) } })} />
          ) : null}
          {run && run.ok ? (
            <View style={{ flexDirection: 'row', gap: SPACE.m }}>
              <Button style={{ flex: 1 }} icon="content-save-outline" label="Save to job" onPress={save} />
              <Button style={{ flex: 1 }} kind="secondary" icon="export-variant" label="Share" onPress={share} />
            </View>
          ) : null}
          <T kind="small" style={{ textAlign: 'center' }}>{SUPPLIER_NOTE}</T>
        </View>
      </ScrollView>
      <DoneBar />
    </View>
  );
}

function valuesFrom(tool: Tool, texts: Texts, choices: Record<string, string>, shapes: UiShape[], sys: UnitSystem): Values {
  const v: Values = {};
  for (const f of tool.fields) {
    if (f.type === 'num') v[f.key] = fromText(f.kind, texts[f.key] ?? '', sys);
    else if (f.type === 'choice') v[f.key] = choices[f.key] ?? f.def;
    else if (f.type === 'list') v[f.key] = (texts[f.key] ?? '').split(/[,;\s]+/).filter(Boolean).map(s => fromText('len', s, sys)) as number[];
    else if (f.type === 'shapes') v[f.key] = shapes.map(s => ({ kind: s.kind, a: fromText('len', s.a, sys), b: s.kind === 'circle' ? null : fromText('len', s.b, sys), subtract: s.subtract }));
  }
  return v;
}

export function ResultSlab({ run }: { run: Run | null }) {
  const { theme, prefs } = useApp();
  if (!run) return null;
  const toneColor = run.ok && run.tone === 'bad' ? theme.danger : run.ok && run.tone === 'warn' ? theme.amber : null;
  const shown = run.ok ? showOut(run.headline, prefs.units) : null;
  return (
    <View
      accessible accessibilityRole="summary" accessibilityLiveRegion="polite"
      accessibilityLabel={run.ok ? `${run.headline.label} ${shown!.value} ${shown!.unit}, ${run.headline.caption}` : 'Fill in the highlighted boxes'}
      style={{ backgroundColor: theme.slab, borderRadius: RADIUS.l, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, borderWidth: toneColor ? 3 : 0, borderColor: toneColor ?? 'transparent', minHeight: 112, justifyContent: 'center', gap: 2 }}
    >
      {run.ok ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s }}>
            <View style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: toneColor ?? theme.amber }} />
            <Text maxFontSizeMultiplier={1.4} style={{ ...BOLD, fontSize: 16, color: theme.onSlab2 }}>{run.headline.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s, flexWrap: 'wrap' }}>
            <Text adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: FONT.numBold, fontSize: 64, lineHeight: 68, color: theme.onSlab, fontVariant: ['tabular-nums'] }}>{shown!.value}</Text>
            {shown!.unit ? <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: FONT.num, fontSize: 30, color: theme.amber }}>{shown!.unit}</Text> : null}
          </View>
          <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.body, fontSize: 16, color: theme.onSlab2 }}>{run.headline.caption}</Text>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.m }}>
          <Icon name="alert-circle-outline" size={30} color={theme.amber} />
          <Text maxFontSizeMultiplier={1.5} style={{ flex: 1, ...BOLD, fontSize: 19, color: theme.onSlab }}>Fill in the highlighted boxes to see the answer.</Text>
        </View>
      )}
    </View>
  );
}

function Outputs({ run }: { run: Extract<Run, { ok: true }> }) {
  const { theme, prefs } = useApp();
  if (!run.outputs.length && !run.table) return null;
  return (
    <Card style={{ gap: SPACE.m }}>
      {run.outputs.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.m }}>
          {run.outputs.map((o, i) => {
            const s = showOut(o, prefs.units);
            return (
              <View key={i} style={{ width: '50%', paddingRight: SPACE.s }} accessible accessibilityLabel={`${o.label} ${s.value} ${s.unit}`}>
                <T kind="small">{o.label}</T>
                <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.numBold, fontSize: 30, color: theme.ink }}>
                  {s.value}<Text style={{ fontFamily: FONT.num, fontSize: 20, color: theme.ink2 }}>{s.unit ? ' ' + s.unit : ''}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {run.table ? (
        <View style={{ gap: SPACE.xs }}>
          <T kind="label">{run.table.title}</T>
          <View style={{ flexDirection: 'row', paddingVertical: SPACE.xs }}>
            <T kind="caps" style={{ flex: 1 }}>{run.table.head[0]}</T>
            <T kind="caps" style={{ flex: 1, textAlign: 'right' }}>{run.table.head[1]}</T>
          </View>
          {run.table.rows.map(([a, b], i) => {
            const sa = showOut(a, prefs.units), sb = showOut(b, prefs.units);
            return (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }}>
                <Text maxFontSizeMultiplier={1.5} style={{ flex: 1, fontFamily: FONT.num, fontSize: 22, color: theme.ink }}>{sa.value} {sa.unit}</Text>
                <Text maxFontSizeMultiplier={1.5} style={{ flex: 1, textAlign: 'right', fontFamily: FONT.numBold, fontSize: 22, color: theme.ink }}>{sb.value} {sb.unit}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

function ShapesEditor({ shapes, setShapes, errors, sys }: { shapes: UiShape[]; setShapes: (fn: (s: UiShape[]) => UiShape[]) => void; errors: Record<string, string>; sys: UnitSystem }) {
  const { theme } = useApp();
  const u = unitLabel('len', sys);
  const patch = (i: number, p: Partial<UiShape>) => setShapes(list => list.map((s, k) => (k === i ? { ...s, ...p } : s)));
  return (
    <View style={{ gap: SPACE.m }}>
      <T kind="label">Shapes</T>
      {errors.shapes ? <T kind="small" color={theme.danger}>{errors.shapes}</T> : null}
      {shapes.map((s, i) => (
        <Card key={i} style={{ gap: SPACE.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T kind="headline" style={{ flex: 1 }}>{s.subtract ? 'Cut-out' : 'Shape'} {i + 1}</T>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove shape ${i + 1}`} onPress={() => setShapes(list => list.filter((_, k) => k !== i))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash-can-outline" size={24} color={theme.danger} />
            </Pressable>
          </View>
          <Choice label="Shape type" value={s.kind} onChange={v => patch(i, { kind: v as ShapeKind })} options={[{ value: 'rect', label: 'Rectangle' }, { value: 'tri', label: 'Triangle' }, { value: 'circle', label: 'Circle' }]} />
          <FieldShell label={s.kind === 'circle' ? 'Diameter' : s.kind === 'tri' ? 'Base' : 'Length'} error={errors[`s${i}a`]}>
            <NumberInput label="Dimension" value={s.a} onChange={a => patch(i, { a })} unit={u} error={!!errors[`s${i}a`]} />
          </FieldShell>
          {s.kind !== 'circle' ? (
            <FieldShell label={s.kind === 'tri' ? 'Height (square to the base)' : 'Width'} error={errors[`s${i}b`]}>
              <NumberInput label="Second dimension" value={s.b} onChange={b => patch(i, { b })} unit={u} error={!!errors[`s${i}b`]} />
            </FieldShell>
          ) : null}
          <Choice label="Add or subtract" value={s.subtract ? 'minus' : 'plus'} onChange={v => patch(i, { subtract: v === 'minus' })} options={[{ value: 'plus', label: 'Add' }, { value: 'minus', label: 'Cut out' }]} />
        </Card>
      ))}
      <Button kind="secondary" icon="plus" label="Add a shape" onPress={() => setShapes(list => [...list, { kind: 'rect', a: '', b: '', subtract: false }])} />
    </View>
  );
}

function Locked({ tool }: { tool: Tool }) {
  const { theme, trial } = useApp();
  const example = tool.run ? tool.run(defaults(tool)) : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ padding: SPACE.l, gap: SPACE.l }}>
      <T kind="headline">{tool.blurb}</T>
      {example && example.ok ? (
        <View style={{ gap: SPACE.s }}>
          <T kind="caps">Example with typical numbers</T>
          <ResultSlab run={example} />
        </View>
      ) : null}
      <Card style={{ gap: SPACE.m }}>
        <View style={{ flexDirection: 'row', gap: SPACE.m, alignItems: 'center' }}>
          <Icon name="lock-outline" size={28} color={theme.ink} />
          <T kind="headline" style={{ flex: 1 }}>Part of Full Unlock</T>
        </View>
        <T>Every tool, unlimited jobs and job sheets. One payment, no subscription.</T>
        <Button icon="lock-open-variant-outline" label={trial.started ? 'See Full Unlock' : 'Try it free for 7 days'} onPress={() => router.push('/unlock')} />
      </Card>
    </ScrollView>
  );
}
