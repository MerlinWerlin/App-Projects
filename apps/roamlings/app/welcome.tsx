import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Pet } from '../src/core/pet';
import { t } from '../src/i18n';
import { stepsPermission } from '../src/native/steps';
import { actions, useGame } from '../src/store/game';
import { space, type as ty, useColors } from '../src/theme/tokens';
import { Button, Egg, regionTint } from '../src/ui/kit';
import { PetView } from '../src/ui/PetView';

const demo = (speciesId: string, paletteId: string, stage: 0 | 1 | 2, branch: Pet['branch'] = null): Pet => ({
  id: `demo-${speciesId}`, seed: 0, speciesId, rarity: 'common', paletteId, mod: null, trait: 'curious', region: 'wilds',
  hatchedAt: 0, nickname: null, stage, xp: 0, branchXp: { swift: 0, scholarly: 0, cozy: 0 }, branch,
});

const PAGES = [
  { title: 'welcome.1.title', body: 'welcome.1.body' },
  { title: 'welcome.2.title', body: 'welcome.2.body' },
  { title: 'welcome.3.title', body: 'welcome.3.body' },
] as const;

/** Three short cards on first launch, then motion permission and the starter egg. */
export default function Welcome() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page]!;

  const finish = async () => {
    await stepsPermission().catch(() => 'unavailable');
    actions.setOnboarded();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.lg }}>
        <View style={{ height: 240, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          {page === 0 ? <PetView pet={demo('zapling', 'zapling-c', 2, 'swift')} size={220} mood="joyful" animate /> : null}
          {page === 1 ? <Egg size={200} tint={regionTint[g.region] ?? '#A08C5B'} crack={1} /> : null}
          {page === 2 ? (
            <>
              <PetView pet={demo('mossbun', 'mossbun-c', 0)} size={110} />
              <PetView pet={demo('mossbun', 'mossbun-c', 1)} size={140} />
              <PetView pet={demo('mossbun', 'mossbun-c', 2, 'cozy')} size={170} mood="joyful" />
            </>
          ) : null}
        </View>
        <Text style={[ty.title, { color: c.ink, textAlign: 'center' }]} accessibilityRole="header">{t(p.title)}</Text>
        <Text style={[ty.body, { color: c.ink2, textAlign: 'center', maxWidth: 320 }]}>{t(p.body)}</Text>
      </View>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityLabel={t('welcome.page', { n: page + 1, total: PAGES.length })}>
          {PAGES.map((_, i) => (
            <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? c.accent : c.line }} />
          ))}
        </View>
        {last ? <Text style={[ty.small, { color: c.ink3, textAlign: 'center' }]}>{t('welcome.motion')}</Text> : null}
        <Button label={last ? t('welcome.go') : t('welcome.next')} onPress={() => (last ? finish().catch(() => {}) : setPage(page + 1))} />
      </View>
    </View>
  );
}
