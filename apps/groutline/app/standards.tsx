// The standards and rules Groutline uses for the chosen country, in plain words.
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradientText } from '../src/core/falls.ts';
import { formatLength } from '../src/core/units.ts';
import { useApp } from '../src/state/AppState.tsx';
import { SPACE, useTheme } from '../src/theme/theme.ts';
import { Card, Section, Txt } from '../src/ui/kit.tsx';

const TOPIC: Record<string, string> = { installation: 'Installation', waterproofing: 'Waterproofing', falls: 'Falls', slip: 'Slip resistance', stairs: 'Stairs', materials: 'Materials' };

export default function Standards() {
  const { country: c, system } = useApp();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ padding: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xl }}>
      <Txt v="title" accessibilityRole="header">{`${c.flag} ${c.name}`}</Txt>
      <Txt v="subhead" tone="ink2" style={{ marginTop: 4 }}>
        {c.guided ? 'What Groutline uses for this country. Standards change and councils add their own rules: the current documents always win.' : 'Generic guidance only: we have not checked the local rules for your country.'}
      </Txt>
      <Section title="Defaults used in the calculators">
        <Card style={{ gap: SPACE.sm }}>
          <View><Txt v="headline">{`${c.terms.falls}: ${gradientText(c.falls.min, system)} minimum${c.falls.max ? `, ${gradientText(c.falls.max, system)} steepest` : ''}`}</Txt><Txt v="footnote" tone="ink2">{c.falls.label}</Txt></View>
          <View><Txt v="headline">{`${c.terms.waterproofing}: shower walls ${formatLength(c.membraneHeights.showerWallMm, system)}, upturn ${formatLength(c.membraneHeights.upturnMm, system, 'tile')}`}</Txt><Txt v="footnote" tone="ink2">{c.membraneHeights.label}</Txt></View>
          {c.stairs ? <View><Txt v="headline">{`Stairs: riser ${c.stairs.riserMin ? `${formatLength(c.stairs.riserMin, system, 'tile')}–` : 'up to '}${formatLength(c.stairs.riserMax, system, 'tile')}, going ${formatLength(c.stairs.goingMin, system, 'tile')}${c.stairs.goingMax < 10000 ? `–${formatLength(c.stairs.goingMax, system, 'tile')}` : ' min'}`}</Txt><Txt v="footnote" tone="ink2">{c.stairs.source}</Txt></View> : null}
          <View><Txt v="headline">Adhesive contact</Txt><Txt v="footnote" tone="ink2">{c.contactRule}</Txt></View>
        </Card>
      </Section>
      <Section title="Standards named in notes">
        <View style={{ gap: SPACE.xs }}>
          {c.standards.map(s => (
            <Card key={s.name}>
              <Txt v="caption" tone="ink3" style={{ textTransform: 'uppercase' }}>{TOPIC[s.topic]}</Txt>
              <Txt v="headline">{s.name}</Txt>
              <Txt v="subhead" tone="ink2">{s.note}</Txt>
            </Card>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
