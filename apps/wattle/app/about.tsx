import { Screen, Card, SectionLabel, Txt } from '../src/ui/kit.tsx';
import { SPACE } from '../src/theme/theme.ts';

const SOURCES: [string, string][] = [
  ['Conduit bending', 'Right-triangle trigonometry on the centreline: distance between marks = rise ÷ sin θ, shrink = rise × tan(θ/2). Same multipliers and shrink values as published conduit-bending manuals and bender instructions (Benfield; Greenlee, Klein and Ideal bender sheets; Ugly’s Electrical References). Bends are treated as points: real bends have a radius and spring back, so mark, bend and check.'],
  ['Voltage drop', 'mV/A·m method as used in AS/NZS 3008.1.1 (you enter the value; no table values are stored in Wattle). Physics estimate: R = ρ20 (1 + α (T − 20)) ÷ A, copper per IEC 60028 and aluminium per IEC 60889, with an effective resistivity matched to IEC 60228 class 2 stranded conductors so it errs high. Vd = 2·I·L·Z single-phase, √3·I·L·Z three-phase. 5 % limit: AS/NZS 3000 clause 3.6.2; nominal 230/400 V per AS 60038.'],
  ['Conduit fill', 'Fill % = Σ cable areas ÷ conduit inside area. Guide limits 53/31/40 % and the jam-ratio check come from NFPA 70 (NEC) Chapter 9. Australian rules for cables in conduit are in AS/NZS 3000 Appendix C. Preset diameters are approximate: use the maker’s data.'],
  ['Power', 'V = IR, P = VI. S = V·I (single-phase) or √3·V_L·I_L (three-phase), P = S·pf, Q = S·sin φ.'],
  ['Cable runs', 'Best-fit decreasing cut planning (D. S. Johnson, 1973). Not guaranteed optimal.'],
  ['Converter', 'AWG per ASTM B258; 1 in = 25.4 mm; 1 hp = 745.7 W; 1 kcmil = 0.5067 mm².'],
];

export default function About() {
  return (
    <Screen pushed title="Safety & sources">
      <Card style={{ gap: SPACE.sm }}>
        <Txt v="headline">A calculation aid for licensed electricians</Txt>
        <Txt v="callout" tone="ink2">Wattle’s results are estimates to help licensed electricians and supervised apprentices work faster. They don’t replace AS/NZS 3000 (Wiring Rules), AS/NZS 3008 (cable selection), the manufacturer’s data, or a design by a qualified person, and they don’t cover current-carrying capacity, derating, fault-loop impedance or protection. Wattle is not instructions for doing electrical work. In Australia and New Zealand, electrical work must be done by a licensed electrician.</Txt>
      </Card>
      <SectionLabel>Where the maths comes from</SectionLabel>
      {SOURCES.map(([t, b]) => (
        <Card key={t} style={{ gap: 4 }}>
          <Txt v="headline">{t}</Txt>
          <Txt v="subhead" tone="ink2">{b}</Txt>
        </Card>
      ))}
      <Txt v="footnote" tone="ink2">Every calculator has “Show the working” so you can check each step. Wattle collects no data.</Txt>
    </Screen>
  );
}
