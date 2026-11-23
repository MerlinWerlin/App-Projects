/** Ohm's law and the power triangle. Free for everyone. */
import { useMemo, useState } from 'react';
import { fmtSig, parseNum } from '../../src/core/num.ts';
import { OHM_UNITS, ohm, powerTriangle, type OhmKey, type Supply } from '../../src/core/power.ts';
import { SPACE } from '../../src/theme/theme.ts';
import { Btn, FieldRow, NumField, Result, Screen, Segmented, Toggle, Txt } from '../../src/ui/kit.tsx';
import { useSave } from '../../src/ui/useSave.ts';
import { CAPTURE, DEMO } from '../../src/capture.ts';

type Mode = 'ohm' | 'power';
type Given = 'current' | 'kw' | 'kva';
const OHM_LABEL: Record<OhmKey, string> = { V: 'Voltage', I: 'Current', R: 'Resistance', P: 'Power' };

export default function Power() {
  const save = useSave();
  const [mode, setMode] = useState<Mode>('ohm');
  const [o, setO] = useState<Record<OhmKey, string>>({ V: '230', I: '', R: '', P: '' });
  const [supply, setSupply] = useState<Supply>('three');
  const [given, setGiven] = useState<Given>('kw');
  const [p, setP] = useState<Record<string, string>>(CAPTURE ? DEMO.power : { v: '400', pf: '0.85' });

  const filled = (Object.keys(o) as OhmKey[]).filter(k => o[k].trim() !== '');
  const ohmR = useMemo(() => ohm(Object.fromEntries(filled.map(k => [k, parseNum(o[k])]))), [o]); // eslint-disable-line react-hooks/exhaustive-deps
  const powR = useMemo(() => powerTriangle({ supply, voltage: parseNum(p.v), pf: parseNum(p.pf), [given]: parseNum(p.x) }), [supply, given, p]);

  return (
    <Screen title="Power" sub="Ohm’s law and kW / kVA / amps">
      <Segmented label="Calculator" value={mode} onChange={setMode} options={[{ id: 'ohm', label: 'Ohm’s law' }, { id: 'power', label: '1φ / 3φ power' }]} />
      {mode === 'ohm' ? (
        <>
          <Txt v="subhead" tone="ink2">Fill in any two. The other two are worked out.</Txt>
          <FieldRow>
            {(['V', 'I'] as OhmKey[]).map(k => <NumField key={k} label={OHM_LABEL[k]} value={o[k]} onChange={v => setO(s => ({ ...s, [k]: v }))} unit={OHM_UNITS[k]} />)}
          </FieldRow>
          <FieldRow>
            {(['R', 'P'] as OhmKey[]).map(k => <NumField key={k} label={OHM_LABEL[k]} value={o[k]} onChange={v => setO(s => ({ ...s, [k]: v }))} unit={OHM_UNITS[k]} />)}
          </FieldRow>
          {filled.length ? <Btn title="Clear" kind="quiet" icon="refresh" onPress={() => setO({ V: '', I: '', R: '', P: '' })} style={{ alignSelf: 'flex-start', paddingHorizontal: SPACE.xs }} /> : null}
          <Result
            error={ohmR.ok ? null : filled.length > 2 ? 'Clear one: only two values can be given.' : ohmR.error}
            answers={ohmR.ok ? (Object.keys(OHM_UNITS) as OhmKey[]).map(k => ({ label: `${OHM_LABEL[k]}${filled.includes(k) ? ' (given)' : ''}`, value: `${fmtSig(ohmR.value[k])} ${OHM_UNITS[k]}` })) : []}
            steps={ohmR.ok ? ohmR.steps : []}
            onSave={ohmR.ok ? () => save({ kind: 'ohm', title: 'Ohm’s law', lines: (Object.keys(OHM_UNITS) as OhmKey[]).map(k => `${OHM_LABEL[k]}: ${fmtSig(ohmR.value[k])} ${OHM_UNITS[k]}`), steps: ohmR.steps }) : undefined}
          />
        </>
      ) : (
        <>
          <Toggle label="Supply" value={supply} onChange={s => { setSupply(s); setP(x => ({ ...x, v: s === 'three' ? '400' : '230' })); }} options={[{ id: 'single', label: 'Single-phase' }, { id: 'three', label: 'Three-phase' }]} />
          <FieldRow>
            <NumField label={supply === 'three' ? 'Line voltage' : 'Voltage'} value={p.v ?? ''} onChange={v => setP(x => ({ ...x, v }))} unit="V" />
            <NumField label="Power factor" value={p.pf ?? ''} onChange={v => setP(x => ({ ...x, pf: v }))} />
          </FieldRow>
          <Toggle label="I know the" value={given} onChange={setGiven} options={[{ id: 'kw', label: 'kW' }, { id: 'kva', label: 'kVA' }, { id: 'current', label: 'Amps' }]} />
          <NumField label={given === 'kw' ? 'Real power' : given === 'kva' ? 'Apparent power' : 'Line current'} value={p.x ?? ''} onChange={v => setP(x => ({ ...x, x: v }))} unit={given === 'kw' ? 'kW' : given === 'kva' ? 'kVA' : 'A'} />
          <Result
            error={powR.ok ? null : powR.error}
            answers={powR.ok ? [
              { label: 'Current per line', value: `${fmtSig(powR.value.I)} A` },
              { label: 'Real power', value: `${fmtSig(powR.value.P / 1000)} kW` },
              { label: 'Apparent', value: `${fmtSig(powR.value.S / 1000)} kVA` },
              { label: 'Reactive', value: `${fmtSig(powR.value.Q / 1000)} kvar` },
              { label: 'Phase angle', value: `${powR.value.angleDeg.toFixed(1)}°` },
            ] : []}
            steps={powR.ok ? powR.steps : []}
            warnings={powR.ok ? powR.warnings : []}
            onSave={powR.ok ? () => save({ kind: 'power', title: `${supply === 'three' ? 'Three' : 'Single'}-phase power`, lines: [`${fmtSig(powR.value.V)} V, pf ${fmtSig(powR.value.pf)}`, `${fmtSig(powR.value.I)} A · ${fmtSig(powR.value.P / 1000)} kW · ${fmtSig(powR.value.S / 1000)} kVA`], steps: powR.steps }) : undefined}
          />
        </>
      )}
    </Screen>
  );
}
