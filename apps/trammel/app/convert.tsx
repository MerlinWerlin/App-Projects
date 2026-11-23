// Fractions <-> mm: type any length in any unit; see it in mm, inches to 1/8-1/32, feet-inches and metres, with
// the rounding error of each fraction.
import { Text, View } from 'react-native';
import { formatFeetInches, formatInches, formatMm, MM_PER_INCH, parseLength, toInchFraction, type FractionDenom } from '../src/core/units.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme } from '../src/theme/theme.ts';
import { Blade, Card, ErrorCard, Field, H, P, Readouts, Segment } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

export default function Convert() {
  const t = useTheme();
  const { settings } = useSettings();
  const { vals, set } = useToolInputs('convert', () => ({ value: settings.units === 'metric' ? '1384' : `4' 6 1/2"`, as: settings.units === 'metric' ? 'metric' : 'imperial' }));
  const as = vals.as === 'imperial' ? 'imperial' : 'metric';
  const mm = vals.value.trim() ? parseLength(vals.value, as) : null;
  const err = (d: FractionDenom) => (mm == null ? '' : toInchFraction(mm, d).errorMm);
  const save = mm != null ? { title: `${vals.value} converted`, summary: `${formatMm(mm, 1)} = ${formatInches(mm, 16)} = ${formatFeetInches(mm, 16)}`, inputs: vals } : null;
  return (
    <ToolShell tool="convert" save={save}>
      <Segment label="A plain number is" options={[{ value: 'metric', label: 'Millimetres' }, { value: 'imperial', label: 'Inches' }]} value={as} onChange={set('as')} />
      <Field label="Length" value={vals.value} onChange={set('value')} hint={`Try 1384, 1.2m, 54 1/2 or 4' 6 1/2"`} />
      {mm == null ? (
        <ErrorCard text={vals.value.trim() ? 'Can’t read that length. Try 2400, 2.4m, 54 1/2 or 4\' 6 1/2".' : 'Type a length to convert.'} />
      ) : (
        <>
          <Blade label="Millimetres" value={formatMm(mm, mm < 100 ? 2 : 1)} sub={`${formatFeetInches(mm, settings.denom)} · ${(mm / 1000).toFixed(3)} m`} />
          <Readouts
            rows={[
              { label: 'Decimal inches', value: `${(mm / MM_PER_INCH).toFixed(3)}"` },
              { label: 'Nearest 1/8"', value: formatInches(mm, 8) },
              { label: 'Nearest 1/16"', value: formatInches(mm, 16), strong: true },
              { label: 'Nearest 1/32"', value: formatInches(mm, 32) },
              { label: 'Feet and inches', value: formatFeetInches(mm, 16) },
            ]}
          />
          <Card>
            <H>Rounding</H>
            <P muted small>How far each tape fraction is from the exact length.</P>
            {([8, 16, 32] as FractionDenom[]).map((d) => (
              <View key={d} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.sunk, borderRadius: radius.s, padding: space.s }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: t.ink }}>1/{d}"</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: t.ink }}>
                  {(err(d) as number) >= 0 ? '+' : ''}
                  {(err(d) as number).toFixed(2)} mm
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ToolShell>
  );
}
