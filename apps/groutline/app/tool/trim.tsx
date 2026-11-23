// Trim & edging: lengths to buy with a cut list that reuses offcuts.
import { Pressable, View } from 'react-native';
import { calcTrim } from '../../src/core/trim.ts';
import { editableLength, formatLength } from '../../src/core/units.ts';
import { count } from '../../src/core/steps.ts';
import { Icon } from '../../src/ui/Icon.tsx';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE, useTheme } from '../../src/theme/theme.ts';
import { plural, useUnits } from '../../src/ui/fields.tsx';
import { Btn, Card, Field, Notes, Num, Problems, Row, Section, Segmented, Stat, Steps, Txt } from '../../src/ui/kit.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

export default function TrimTool() {
  const app = useApp();
  const t = useTheme();
  const u = useUnits();
  const c = app.country;
  const stocks = c.trimStockMm;
  const [s, set, job] = useToolInputs({ runs: JSON.stringify(['', '']), stock: editableLength(stocks[0], u.system, 'room'), allowance: u.system === 'metric' ? '5' : '3/16' });
  let runs: string[] = [];
  try { runs = JSON.parse(s.runs as string); if (!Array.isArray(runs)) runs = ['']; } catch { runs = ['']; }
  const setRuns = (next: string[]) => set({ runs: JSON.stringify(next) });
  const r = calcTrim({
    runsMm: runs.map(x => (x.trim() ? u.parse(x, 'room') ?? -1 : 0)), stockMm: u.parse(s.stock as string, 'room') ?? NaN,
    allowanceMm: u.parse(s.allowance as string, 'joint', true) ?? NaN, system: u.system,
  });
  const F = (mm: number) => formatLength(mm, u.system);
  const summary = r.ok ? [`${count(r.value.lengths)} ${plural('length', r.value.lengths)} of ${F(u.parse(s.stock as string, 'room') ?? 0)}`, `${F(r.value.totalRun)} of edge`] : null;

  return (
    <ToolScreen tool="trim" inputs={s} job={job} summary={summary} steps={r.ok ? r.steps : []} intro={`${c.terms.trim}, edge strips, cove or movement-joint profiles: add each edge, get the lengths to buy.`}
      result={r.ok ? (
        <Card>
          <Num value={count(r.value.lengths)} unit={`${plural('length', r.value.lengths)} to buy`} size={72} />
          <Row gap={SPACE.lg}>
            <Stat label="Total edge" value={F(r.value.totalRun)} />
            <Stat label="Offcut left" value={F(r.value.offcut)} />
          </Row>
          <Section title="Cut list">
            <View style={{ gap: SPACE.xs }}>
              {r.value.bars.map((bar, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }} accessible accessibilityLabel={`Length ${i + 1}: ${bar.map(F).join(', ')}`}>
                  <Txt v="footnote" tone="ink3" style={{ width: 26 }}>{String(i + 1)}</Txt>
                  <View style={{ flex: 1, flexDirection: 'row', height: 28, borderRadius: 6, overflow: 'hidden', backgroundColor: t.sunk }}>
                    {bar.map((p, j) => (
                      <View key={j} style={{ flex: p, backgroundColor: j % 2 ? t.ink2 : t.ink, borderRightWidth: 2, borderRightColor: t.sheet, justifyContent: 'center', paddingHorizontal: 4 }}>
                        <Txt v="caption" numberOfLines={1} style={{ color: t.ground }}>{F(p)}</Txt>
                      </View>
                    ))}
                    {(() => { const used = bar.reduce((a, b) => a + b, 0); const left = (u.parse(s.stock as string, 'room') ?? 0) - used; return left > 1 ? <View style={{ flex: left }} /> : null; })()}
                  </View>
                </View>
              ))}
            </View>
          </Section>
          <Notes notes={r.notes} />
          <Steps steps={r.steps} />
        </Card>
      ) : <Problems problems={r.problems} />}
    >
      <Section title="Edges to trim">
        <View style={{ gap: SPACE.sm }}>
          {runs.map((v, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.xs }}>
              <Field flex={1} label={`Edge ${i + 1}`} value={v} onChangeText={x => setRuns(runs.map((y, j) => (j === i ? x : y)))} unit={u.unit('room')} keyboard={u.keyboard} />
              {runs.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove edge ${i + 1}`} onPress={() => setRuns(runs.filter((_, j) => j !== i))} style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="remove" size={24} color={t.ink3} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Btn label="Add an edge" kind="plain" icon="add" onPress={() => setRuns([...runs, ''])} />
        </View>
      </Section>
      <Section title={`${c.terms.trim} comes in`}>
        <View style={{ gap: SPACE.sm }}>
          {stocks.length > 1 ? <Segmented label="Stock length" value={s.stock as string} onChange={v => set({ stock: v })} options={stocks.map(m => ({ id: editableLength(m, u.system, 'room'), label: F(m) }))} /> : null}
          <Row>
            <Field label="Stock length" value={s.stock as string} onChangeText={v => set({ stock: v })} unit={u.unit('room')} keyboard={u.keyboard} />
            <Field label="Allowance per cut" value={s.allowance as string} onChangeText={v => set({ allowance: v })} unit={u.unit('joint')} keyboard={u.keyboard} hint="Saw kerf, mitre" />
          </Row>
          <Txt v="footnote" tone="ink3">{`Common ${c.terms.trim.toLowerCase()} lengths here: ${stocks.map(F).join(', ')}.`}</Txt>
        </View>
      </Section>
    </ToolScreen>
  );
}

