// Settings > Satchel Full Unlock (1.0.0): where you stand (trial days left, ended, unlocked) and the full paywall
// with Start free trial / Unlock / Restore purchases on the same screen. No nags: it never opens on its own.
import { FadeInView, SectionHeader } from './hero.tsx';
import { useApp } from '../state/app.tsx';
import { Paywall } from './Paywall.tsx';
import { space } from '../theme/tokens.ts';

export function UnlockSection() {
  const { t } = useApp();
  return (
    <FadeInView style={{ gap: space.s }}>
      <SectionHeader title={t('access.title')} icon="sparkles-outline" tone="accent" />
      <Paywall />
    </FadeInView>
  );
}
