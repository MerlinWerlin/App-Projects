/** Standards and sources for the chosen country, with how each value was checked. Only official sites are linked. */
import { Linking, View } from 'react-native';
import { isPublicSource, VERIFIED_LABEL } from '../src/data/src';
import type { Source } from '../src/data/types';
import { useApp } from '../src/state/AppState';
import { SPACE } from '../src/theme/theme';
import { Card, Divider, Notice, Row, Screen, Section, Txt } from '../src/ui/kit';

export default function Sources() {
  const { country, ctx } = useApp();
  const open = (s: Source) => (isPublicSource(s.url) ? () => void Linking.openURL(s.url) : undefined);
  const catalogue: { name: string; src: Source }[] = [
    ...country.sheets, ...country.tiles, ...country.shingles, ...country.caps, ...country.gutters, ...country.downpipes,
  ];
  return (
    <Screen>
      <Txt v="title" accessibilityRole="header">{country.name}</Txt>
      {!country.guided ? <Notice text="No local catalogue for this country yet. Eaveline uses general methods and the values you enter." /> : null}
      {country.standards.length ? (
        <Section title="Standards, codes and guidance">
          <Card style={{ paddingVertical: 0 }}>
            {country.standards.map((s, i) => (
              <View key={s.name}>
                {i ? <Divider /> : null}
                <Row title={s.name} sub={`${s.topic} · ${s.src.label}`} onPress={open(s.src)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
      <Section title="Working at heights">
        <Card style={{ paddingVertical: 0 }}>
          <Row title={country.safety.regulator} sub={country.safety.text} onPress={open(country.safety.src)} />
        </Card>
      </Section>
      <Section title={`Drainage (${ctx.terms.gutters} and ${ctx.terms.downpipes})`}>
        <Card style={{ gap: SPACE.xs }}>
          <Txt v="subhead">{country.drainage.method}</Txt>
          <Txt v="footnote" tone="ink2">{country.drainage.slopeFactorNote}</Txt>
          <Txt v="footnote" tone="ink2">{country.drainage.fallNote}</Txt>
          <Txt v="footnote" tone="ink2">{country.drainage.intensityNote}</Txt>
        </Card>
      </Section>
      {catalogue.length ? (
        <Section title="Materials catalogue">
          <Card style={{ paddingVertical: 0 }}>
            {catalogue.map((c, i) => (
              <View key={`${c.name}-${i}`}>
                {i ? <Divider /> : null}
                <Row title={c.name} sub={`${c.src.label} · ${VERIFIED_LABEL[c.src.verified]}`} onPress={open(c.src)} />
              </View>
            ))}
          </Card>
          <Txt v="footnote" tone="ink3">Product values come from makers’ data sheets and installation guides commonly stocked by local roofing suppliers. Profile names are generic descriptions.</Txt>
        </Section>
      ) : null}
      {country.gaps.length ? (
        <Section title="Not verified (check locally)">
          {country.gaps.map(g => <Notice key={g} text={g} />)}
        </Section>
      ) : null}
      {country.notes.length ? (
        <Section title="Local notes">
          {country.notes.map(n => <Notice key={n} icon="information-circle-outline" text={n} />)}
        </Section>
      ) : null}
      <Section title="Methods">
        <Card style={{ gap: SPACE.xs }}>
          <Txt v="footnote" tone="ink2">Geometry: rise = run × tan θ; rafter = run ÷ cos θ; roof area = plan area ÷ cos θ; hip/valley = √(run₁² + run₂² + rise²).</Txt>
          <Txt v="footnote" tone="ink2">Sheets: ⌈eave length ÷ cover width⌉ across each plane; length = slope + overhang; long runs split with the profile’s end lap.</Txt>
          <Txt v="footnote" tone="ink2">Battens: the span between the eaves and top battens divided into the fewest equal gauges not over the maximum. Slates: gauge = (length − headlap) ÷ 2.</Txt>
          <Txt v="footnote" tone="ink2">Drainage: Q (L/s) = catchment (m²) × intensity (mm/h) ÷ 3600, against the local method’s tables.</Txt>
        </Card>
      </Section>
    </Screen>
  );
}

