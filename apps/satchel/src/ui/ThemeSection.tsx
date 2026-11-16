// Settings > Destination themes: one switch for the country look (src/core/countrytheme.ts), on by default, saved
// with the other app prefs. With it off the app keeps its usual colours whatever the trip.
import { useApp } from '../state/app.tsx';
import { space } from '../theme/tokens.ts';
import { FadeInView, SectionHeader } from './hero.tsx';
import { Body, Card, ToggleRow } from './kit.tsx';

export function ThemeSection() {
  const { t, prefs, setPrefs } = useApp();
  return (
    <FadeInView style={{ gap: space.s }}>
      <SectionHeader title={t('countrytheme.title')} icon="sparkles-outline" tone="accent" />
      <Card>
        <ToggleRow label={t('countrytheme.toggle')} hint={t('countrytheme.toggleHint')} value={prefs.countryThemes} onChange={(v) => setPrefs({ countryThemes: v })} />
        <Body muted>{t('countrytheme.body')}</Body>
      </Card>
    </FadeInView>
  );
}
