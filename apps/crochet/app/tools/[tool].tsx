// Each tool on its own screen.
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import {
  HOOK_SIZES,
  SIZES,
  YARN_WEIGHTS,
  amigurumiShape,
  estimateYarn,
  evenly,
  foundationChain,
  incRoundsForDiameter,
  rescale,
  rowsForLength,
  shapeToText,
  sphereDiameterCm,
  stitchesForWidth,
  type StitchFamily,
} from '../../src/core/calc';
import { STITCHES, convertTerms, searchStitches, stitchAbbrev, stitchName, type Terms } from '../../src/core/terms';
import { formatNumber, t, type MessageKey } from '../../src/i18n';
import { usePlus } from '../../src/plus/entitlement';
import { addProject } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { font, radius, space, useColors } from '../../src/theme/tokens';
import { haptic } from '../../src/ui/haptics';
import { Body, Button, Card, Chip, Field, Group, H2, Label, NumberField, Row, ScreenScroll, Segmented, Stepper, SwitchRow } from '../../src/ui/kit';
import { useToast } from '../../src/ui/Toast';

export default function ToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const title = t(`tool.${tool}.title` as MessageKey);
  let body: ReactNode;
  switch (tool) {
    case 'ball':
      body = <BallTool />;
      break;
    case 'evenly':
      body = <EvenlyTool />;
      break;
    case 'convert':
      body = <ConvertTool />;
      break;
    case 'gauge':
      body = <GaugeTool />;
      break;
    case 'yarn':
      body = <YarnTool />;
      break;
    case 'price':
      body = <PriceTool />;
      break;
    case 'glossary':
      body = <GlossaryTool />;
      break;
    case 'hooks':
      body = <HooksTool />;
      break;
    case 'weights':
      body = <WeightsTool />;
      break;
    case 'sizes':
      body = <SizesTool />;
      break;
    default:
      body = <Body muted>{t('tools.unknown')}</Body>;
  }
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScreenScroll keyboard>{body}</ScreenScroll>
    </>
  );
}

function Result({ children }: { children: ReactNode }) {
  const { c } = useColors();
  return <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.l, padding: space.l, gap: 6 }}>{children}</View>;
}

function Big({ children }: { children: ReactNode }) {
  const { c } = useColors();
  return (
    <Text selectable maxFontSizeMultiplier={1.5} style={{ fontFamily: font.display, fontSize: 24, color: c.ink }}>
      {children}
    </Text>
  );
}

function useTermsView() {
  const s = useSettings();
  return (us: string) => convertTerms(us, 'US', s.terms);
}

// ------------------------------------------------------------------ amigurumi ball

function BallTool() {
  const { c } = useColors();
  const show = useTermsView();
  const toast = useToast();
  const [mode, setMode] = useState<'rounds' | 'size'>('rounds');
  const [inc, setInc] = useState(6);
  const [diameter, setDiameter] = useState<number | undefined>(6);
  const [gauge, setGauge] = useState<number | undefined>(20);
  const [evenOverride, setEvenOverride] = useState<number | null>(null);
  const [staggered, setStaggered] = useState(true);
  const [close, setClose] = useState(true);
  const incRounds = mode === 'rounds' ? inc : incRoundsForDiameter(diameter ?? 0, gauge ?? 0);
  const even = evenOverride ?? incRounds;
  const rounds = useMemo(() => (incRounds >= 1 ? amigurumiShape({ incRounds, evenRounds: even, staggered, close }) : []), [incRounds, even, staggered, close]);
  const max = 6 * incRounds;
  const approx = gauge ? sphereDiameterCm(max, gauge) : 0;

  return (
    <View style={{ gap: space.l }}>
      <Body muted>{t('tool.ball.help')}</Body>
      <Segmented
        options={[
          { value: 'rounds', label: t('tool.ball.byRounds') },
          { value: 'size', label: t('tool.ball.bySize') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'rounds' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body bold>{t('tool.ball.widest', { count: max })}</Body>
          <Stepper label={t('tool.ball.incRounds')} value={inc} onChange={setInc} min={2} max={20} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <NumberField style={{ flex: 1 }} label={t('tool.ball.diameter')} value={diameter} onChange={setDiameter} decimals />
          <NumberField style={{ flex: 1 }} label={t('tool.ball.gauge')} value={gauge} onChange={setGauge} decimals />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Body bold>{t('tool.ball.evenRounds')}</Body>
        <Stepper label={t('tool.ball.evenRounds')} value={even} onChange={setEvenOverride} min={0} max={40} />
      </View>
      <Group>
        <SwitchRow title={t('tool.ball.staggered')} subtitle={t('tool.ball.staggeredHelp')} value={staggered} onChange={setStaggered} />
        <SwitchRow title={t('tool.ball.close')} subtitle={t('tool.ball.closeHelp')} value={close} onChange={setClose} last />
      </Group>
      {approx > 0 ? (
        <Body small muted>
          {t('tool.ball.approx', { cm: formatNumber(approx, 1) })}
        </Body>
      ) : null}
      <Card style={{ gap: 6 }}>
        {rounds.map((r) => (
          <View key={r.n} style={{ flexDirection: 'row', gap: space.m }}>
            <Text style={{ width: 56, fontFamily: font.heavy, color: c.ink3, fontSize: 14 }}>{`Rnd ${r.n}`}</Text>
            <Body selectable style={{ flex: 1 }}>
              {show(r.text)} ({r.count})
            </Body>
          </View>
        ))}
      </Card>
      <Button
        title={t('tool.ball.saveProject')}
        icon="plus"
        onPress={() => {
          const p = addProject(t('tool.ball.projectName'), { pattern: { text: shapeToText(rounds, t('tool.ball.projectName')), terms: 'US', step: 0, done: [] }, tags: ['amigurumi'] });
          haptic('success');
          router.push(`/project/${p.id}`);
        }}
      />
      <Button
        title={t('common.copy')}
        kind="secondary"
        icon="copy"
        onPress={() => {
          Clipboard.setStringAsync(show(shapeToText(rounds))).then(() => toast(t('common.copied'))).catch(() => {});
        }}
      />
    </View>
  );
}

// ------------------------------------------------------------------ evenly

function EvenlyTool() {
  const { c } = useColors();
  const show = useTermsView();
  const [cur, setCur] = useState<number | undefined>(24);
  const [target, setTarget] = useState<number | undefined>(30);
  const plan = cur && target ? evenly(cur, target) : null;
  return (
    <View style={{ gap: space.l }}>
      <Body muted>{t('tool.evenly.help')}</Body>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.evenly.now')} value={cur} onChange={setCur} />
        <NumberField style={{ flex: 1 }} label={t('tool.evenly.want')} value={target} onChange={setTarget} />
      </View>
      {plan ? (
        <Result>
          <Label>{plan.change > 0 ? t('tool.evenly.incs', { count: plan.change }) : plan.change < 0 ? t('tool.evenly.decs', { count: -plan.change }) : t('tool.evenly.same')}</Label>
          <Big>
            {show(plan.text)} ({plan.result})
          </Big>
        </Result>
      ) : cur && target ? (
        <Body style={{ color: c.warn }}>{t('tool.evenly.impossible')}</Body>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ convert

function ConvertTool() {
  const toast = useToast();
  const [from, setFrom] = useState<Terms>('US');
  const [text, setText] = useState('');
  const out = convertTerms(text, from, from === 'US' ? 'UK' : 'US');
  return (
    <View style={{ gap: space.l }}>
      <Segmented
        options={[
          { value: 'US', label: t('tool.convert.usToUk') },
          { value: 'UK', label: t('tool.convert.ukToUs') },
        ]}
        value={from}
        onChange={setFrom}
      />
      <Field label={t('tool.convert.in')} value={text} onChangeText={setText} multiline placeholder={from === 'US' ? 'Rnd 3: [sc, inc] x6 (18)' : 'Rnd 3: [dc, inc] x6 (18)'} autoCapitalize="none" autoCorrect={false} />
      {text.trim() ? (
        <Result>
          <Label>{t('tool.convert.out')}</Label>
          <Body selectable>{out}</Body>
          <Button small kind="secondary" icon="copy" title={t('common.copy')} onPress={() => Clipboard.setStringAsync(out).then(() => toast(t('common.copied'))).catch(() => {})} />
        </Result>
      ) : null}
      <Card style={{ gap: 6 }}>
        <Label>{t('tool.convert.cheat')}</Label>
        {STITCHES.filter((s) => s.us !== s.uk).map((s) => (
          <Body key={s.us} small>
            <Text style={{ fontFamily: font.heavy }}>{s.us}</Text> {s.usName} {'→'} <Text style={{ fontFamily: font.heavy }}>{s.uk}</Text> {s.ukName}
          </Body>
        ))}
      </Card>
    </View>
  );
}

// ------------------------------------------------------------------ gauge

function GaugeTool() {
  const { units } = useSettings();
  const unit = units === 'in' ? 'in' : 'cm';
  const [swSts, setSwSts] = useState<number | undefined>(18);
  const [swRows, setSwRows] = useState<number | undefined>(20);
  const [swSize, setSwSize] = useState<number | undefined>(units === 'in' ? 4 : 10);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [length, setLength] = useState<number | undefined>(undefined);
  const [first, setFirst] = useState<'sc' | 'hdc' | 'dc'>('sc');
  const [pCount, setPCount] = useState<number | undefined>(undefined);
  const [pGauge, setPGauge] = useState<number | undefined>(undefined);
  const show = useTermsView();
  const sts = width && swSts && swSize ? stitchesForWidth(width, swSts, swSize) : 0;
  const rows = length && swRows && swSize ? rowsForLength(length, swRows, swSize) : 0;
  return (
    <View style={{ gap: space.l }}>
      <H2>{t('tool.gauge.yourSwatch')}</H2>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.sts')} value={swSts} onChange={setSwSts} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.rows')} value={swRows} onChange={setSwRows} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.over', { unit })} value={swSize} onChange={setSwSize} decimals />
      </View>
      <H2>{t('tool.gauge.want')}</H2>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.width', { unit })} value={width} onChange={setWidth} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.length', { unit })} value={length} onChange={setLength} decimals />
      </View>
      <Segmented
        options={[
          { value: 'sc', label: show('sc') },
          { value: 'hdc', label: show('hdc') },
          { value: 'dc', label: show('dc') },
        ]}
        value={first}
        onChange={setFirst}
      />
      {sts || rows ? (
        <Result>
          {sts ? <Big>{t('tool.gauge.resultSts', { sts, ch: foundationChain(sts, first) })}</Big> : null}
          {rows ? <Big>{t('tool.gauge.resultRows', { rows })}</Big> : null}
        </Result>
      ) : null}
      <H2>{t('tool.gauge.resize')}</H2>
      <Body small muted>
        {t('tool.gauge.resizeHelp')}
      </Body>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.patternCount')} value={pCount} onChange={setPCount} />
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.patternGauge')} value={pGauge} onChange={setPGauge} decimals />
      </View>
      {pCount && pGauge && swSts && swSize ? (
        <Result>
          <Big>{t('tool.gauge.resizeResult', { count: rescale(pCount, pGauge, (swSts * (units === 'in' ? 4 : 10)) / swSize) })}</Big>
        </Result>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ yarn estimate

function YarnTool() {
  const show = useTermsView();
  const { units } = useSettings();
  const k = units === 'in' ? 2.54 : 1;
  const [w, setW] = useState<number | undefined>(undefined);
  const [l, setL] = useState<number | undefined>(undefined);
  const [cyc, setCyc] = useState(4);
  const [st, setSt] = useState<StitchFamily>('sc');
  const [perBall, setPerBall] = useState<number | undefined>(undefined);
  const [key, setKey] = useState(0);
  const est = w && l ? estimateYarn(w * k, l * k, cyc, st, perBall) : null;
  return (
    <View style={{ gap: space.l }} key={key}>
      <Body muted>{t('tool.yarn.help')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SIZES.filter((s) => s.group !== 'Hat').map((s) => (
          <Chip
            key={s.name}
            label={s.name}
            onPress={() => {
              setW(Math.round(s.widthCm / k));
              setL(Math.round(s.lengthCm / k));
              setKey((x) => x + 1);
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.width', { unit: units })} value={w} onChange={setW} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.gauge.length', { unit: units })} value={l} onChange={setL} decimals />
      </View>
      <View style={{ gap: 6 }}>
        <Label>{t('tool.yarn.weight')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {YARN_WEIGHTS.map((y) => (
            <Chip key={y.cyc} label={`${y.cyc} ${y.us.split(' /')[0]}`} on={cyc === y.cyc} onPress={() => setCyc(y.cyc)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Label>{t('tool.yarn.stitch')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['sc', 'hdc', 'dc', 'granny', 'textured', 'mesh'] as const).map((s) => (
            <Chip key={s} label={s === 'sc' || s === 'hdc' || s === 'dc' ? show(s) : t(`tool.yarn.st.${s}`)} on={st === s} onPress={() => setSt(s)} />
          ))}
        </View>
      </View>
      <NumberField label={t('tool.yarn.perBall')} value={perBall} onChange={setPerBall} placeholder={t('common.optional')} />
      {est ? (
        <Result>
          <Big>{t('tool.yarn.result', { low: formatNumber(est.low), high: formatNumber(est.high) })}</Big>
          {est.balls ? <Body bold>{t('tool.yarn.balls', { count: est.balls })}</Body> : null}
          <Body small muted>
            {t('tool.yarn.disclaimer')}
          </Body>
        </Result>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ seller price (Plus)

function PriceTool() {
  const plus = usePlus();
  const [yarnCost, setYarnCost] = useState<number | undefined>(undefined);
  const [other, setOther] = useState<number | undefined>(undefined);
  const [hours, setHours] = useState<number | undefined>(undefined);
  const [rate, setRate] = useState<number | undefined>(20);
  const [fees, setFees] = useState<number | undefined>(10);
  if (!plus) {
    return (
      <View style={{ gap: space.l }}>
        <Body muted>{t('tool.price.blurbLong')}</Body>
        <Button title={t('plus.unlock')} icon="star" onPress={() => router.push('/plus')} />
      </View>
    );
  }
  const materials = (yarnCost ?? 0) + (other ?? 0);
  const labour = (hours ?? 0) * (rate ?? 0);
  const base = materials + labour;
  const price = fees != null && fees < 100 ? base / (1 - fees / 100) : base;
  return (
    <View style={{ gap: space.l }}>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.price.yarn')} value={yarnCost} onChange={setYarnCost} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.price.other')} value={other} onChange={setOther} decimals />
      </View>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NumberField style={{ flex: 1 }} label={t('tool.price.hours')} value={hours} onChange={setHours} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.price.rate')} value={rate} onChange={setRate} decimals />
        <NumberField style={{ flex: 1 }} label={t('tool.price.fees')} value={fees} onChange={setFees} decimals />
      </View>
      {base > 0 ? (
        <Result>
          <Big>{t('tool.price.result', { price: formatNumber(price, 2) })}</Big>
          <Body small muted>
            {t('tool.price.breakdown', { materials: formatNumber(materials, 2), labour: formatNumber(labour, 2) })}
          </Body>
        </Result>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ glossary

function GlossaryTool() {
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [terms, setTerms] = useState<Terms>(settings.terms);
  const list = searchStitches(q);
  const other: Terms = terms === 'US' ? 'UK' : 'US';
  return (
    <View style={{ gap: space.l }}>
      <Segmented
        options={[
          { value: 'US', label: t('terms.us') },
          { value: 'UK', label: t('terms.uk') },
        ]}
        value={terms}
        onChange={setTerms}
      />
      <Field label={t('tool.glossary.search')} value={q} onChangeText={setQ} placeholder="sc, htr, magic…" autoCapitalize="none" autoCorrect={false} />
      {list.map((s) => (
        <Card key={s.us} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s, flexWrap: 'wrap' }}>
            <H2>{stitchAbbrev(s, terms)}</H2>
            <Body bold>{stitchName(s, terms)}</Body>
          </View>
          {s.us !== s.uk ? (
            <Body small muted>
              {t('tool.glossary.inOther', { terms: other, abbr: stitchAbbrev(s, other), name: stitchName(s, other) })}
            </Body>
          ) : null}
          <Body small>{convertTerms(s.how, 'US', terms)}</Body>
        </Card>
      ))}
      {list.length === 0 ? <Body muted>{t('tool.glossary.none')}</Body> : null}
    </View>
  );
}

// ------------------------------------------------------------------ charts

function HooksTool() {
  return (
    <Group>
      {HOOK_SIZES.map((h, i) => (
        <Row key={h.mm} title={`${h.mm} mm`} subtitle={[h.us ? `US ${h.us}` : null, h.uk ? `UK ${h.uk}` : null, h.jp ? `JP ${h.jp}` : null].filter(Boolean).join('  ·  ') || '—'} last={i === HOOK_SIZES.length - 1} />
      ))}
    </Group>
  );
}

function WeightsTool() {
  return (
    <View style={{ gap: space.m }}>
      {YARN_WEIGHTS.map((y) => (
        <Card key={y.cyc} style={{ gap: 4 }}>
          <H2>{`${y.cyc} · ${y.us}`}</H2>
          <Body small>{t('tool.weights.names', { uk: y.uk, au: y.au })}</Body>
          <Body small muted>
            {t('tool.weights.detail', { h1: y.hookMm[0], h2: y.hookMm[1], wpi: y.wpi, g1: y.scPer10[0], g2: y.scPer10[1] })}
          </Body>
        </Card>
      ))}
    </View>
  );
}

function SizesTool() {
  const { units } = useSettings();
  const f = (cm: number) => (units === 'in' ? `${formatNumber(cm / 2.54, 0)}"` : `${cm} cm`);
  const groups = ['Blanket', 'Hat', 'Scarf'] as const;
  return (
    <View style={{ gap: space.l }}>
      {groups.map((g) => (
        <View key={g} style={{ gap: space.s }}>
          <Label>{t(`tool.sizes.${g}`)}</Label>
          <Group>
            {SIZES.filter((s) => s.group === g).map((s, i, arr) => (
              <Row key={s.name} title={s.name} subtitle={g === 'Hat' ? t('tool.sizes.hat', { c: f(s.widthCm), h: f(s.lengthCm) }) : `${f(s.widthCm)} × ${f(s.lengthCm)}`} last={i === arr.length - 1} />
            ))}
          </Group>
        </View>
      ))}
    </View>
  );
}
