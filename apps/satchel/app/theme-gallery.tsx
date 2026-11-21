// Screenshot builds only (EXPO_PUBLIC_SATCHEL_CAPTURE=1, store/capture): every destination theme's Trips head, one under
// the other, so all 25 can be checked in light and dark from one deep link (satchel://theme-gallery). Each head is the
// real HeroHeader with the mascot, inside that country's theme for the given month (Japan twice: November maple and
// April blossom). In a store build the route sends you home: no traveller ever sees it.
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRY_THEMES, particleFor, type CountryPick } from '../src/core/countrytheme.ts';
import { CAPTURE } from '../src/native/notifications.ts';
import { useApp } from '../src/state/app.tsx';
import { CountryPreviewScope } from '../src/state/countryTheme.tsx';
import { space } from '../src/theme/tokens.ts';
import { HeroHeader } from '../src/ui/hero.tsx';

// An invented city per country, for the head's title only.
const CITY: Record<string, string> = {
  JP: 'Tokyo', KR: 'Seoul', CA: 'Banff', FR: 'Paris', IT: 'Rome', GB: 'London', US: 'New York', AU: 'Sydney', NZ: 'Queenstown',
  TH: 'Bangkok', ID: 'Bali', MX: 'Oaxaca', ES: 'Seville', GR: 'Santorini', VN: 'Hoi An', PT: 'Lisbon', DE: 'Berlin',
  IE: 'Dublin', NL: 'Amsterdam', CH: 'Zermatt', IN: 'Agra', SG: 'Singapore', FJ: 'Nadi', IS: 'Reykjavik', TR: 'Cappadocia',
};

const PICKS: { key: string; pick: CountryPick }[] = [
  ...Object.values(COUNTRY_THEMES).map((spec) => ({ key: `${spec.iso2}-11`, pick: { spec, particle: particleFor(spec, 11), month: 11 } })),
  { key: 'JP-4', pick: { spec: COUNTRY_THEMES.JP, particle: particleFor(COUNTRY_THEMES.JP, 4), month: 4 } },
];

export default function ThemeGallery() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useEffect(() => {
    if (!CAPTURE) router.replace('/');
  }, [router]);
  if (!CAPTURE) return null;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
      data={PICKS}
      keyExtractor={(x) => x.key}
      initialNumToRender={26}
      renderItem={({ item }) => (
        <View>
          <CountryPreviewScope pick={item.pick}>
            <HeroHeader tone="trips" illustration="route" mascot="home" title={`Day 3 of 9 in ${CITY[item.pick.spec.iso2] ?? item.pick.spec.iso2}`} subtitle={`${item.pick.spec.iso2} · month ${item.pick.month}`} />
          </CountryPreviewScope>
        </View>
      )}
    />
  );
}
