import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { loadApps, type AppsLoad } from '../src/core/apps';
import {
  hiddenCount,
  hideAllExcept,
  isHidden,
  setFavouritesOnly,
  setHidden,
  showAll,
} from '../src/core/appVisibility';
import { SERVICE_REGIONS, serviceFor, storeIcons, type ServiceRegion } from '../src/core/storeIcons';
import type { TvApp } from '../src/core/types';
import { useT } from '../src/i18n/react';
import { useAppVisibility } from '../src/state/appVisibility';
import { useFavourites } from '../src/state/favourites';
import { useSession } from '../src/state/session';
import { radii, space, textStyle } from '../src/theme/design';
import { RemoteIcon } from '../src/ui/icons/RemoteIcon';
import { Text } from '../src/ui/Text';
import { InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

type Group = ServiceRegion | 'other';
const GROUPS: readonly Group[] = [...SERVICE_REGIONS, 'other'];
const GROUP_KEY = {
  global: 'app.chooseApps.region.global',
  au: 'app.chooseApps.region.au',
  us: 'app.chooseApps.region.us',
  uk: 'app.chooseApps.region.uk',
  eu: 'app.chooseApps.region.eu',
  other: 'app.chooseApps.region.other',
} as const satisfies Record<Group, string>;

/**
 * Choose apps (owner-1022), from the Apps tab. Every app the TV reports, grouped by where the service
 * is popular (Global, Australia, USA, UK, Europe, then anything else), each with a Show switch.
 * Favourites always show and are marked instead of switched. On top: "Favourites only", "Show all
 * apps" and "Only my favourites" (hides everything else). Hiding is Couch-only: nothing changes on
 * the TV. Saved per TV (src/state/appVisibility.ts).
 */
export default function ChooseAppsScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { session, snap } = useSession();
  const activeId = snap.activeId;
  const [load, setLoad] = useState<AppsLoad | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    loadApps(session.activeDriver())
      .then((r) => {
        if (!cancelled) setLoad(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, activeId]);

  const apps = load && load.kind === 'ok' ? load.apps : null;
  const fav = useFavourites(activeId, apps);
  const { visibility, update } = useAppVisibility(activeId);
  const all = useMemo(() => [...fav.favourites, ...fav.others], [fav.favourites, fav.others]);
  const favSet = useMemo(() => new Set(fav.ids), [fav.ids]);

  const grouped = useMemo(() => {
    const m = new Map<Group, TvApp[]>();
    for (const a of all) {
      const g: Group = serviceFor(a)?.region ?? 'other';
      const arr = m.get(g) ?? [];
      arr.push(a);
      m.set(g, arr);
    }
    for (const arr of m.values()) arr.sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }));
    return m;
  }, [all]);

  const hiddenN = hiddenCount(visibility, fav.others);
  const shownN = all.length - hiddenN;

  return (
    <>
      <LargeTitleHeader
        title={t('app.chooseApps.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Text style={[textStyle('subheadline'), styles.intro, { color: p.secondaryLabel }]}>{t('app.chooseApps.intro')}</Text>

        <InsetGroupedList footer={t('app.chooseApps.footer')}>
          <Row
            title={t('app.apps.vis.favsOnly')}
            subtitle={t('app.chooseApps.favsOnlySub')}
            accessory={{
              type: 'switch',
              value: visibility.favouritesOnly,
              onValueChange: (on) => update((v) => setFavouritesOnly(v, on)),
            }}
          />
          <Row
            title={t('app.chooseApps.showAll')}
            subtitle={apps ? t('app.chooseApps.counts', { shown: shownN, total: all.length }) : undefined}
            accessory={{ type: 'none' }}
            onPress={() => update((v) => setFavouritesOnly(showAll(v), false))}
          />
          <Row
            title={t('app.chooseApps.onlyFavs')}
            subtitle={t('app.chooseApps.onlyFavsSub')}
            accessory={{ type: 'none' }}
            onPress={() => update((v) => hideAllExcept(v, all.map((a) => a.id), fav.ids))}
          />
        </InsetGroupedList>

        {apps === null ? (
          <Text style={[textStyle('footnote'), styles.intro, { color: p.secondaryLabel }]}>
            {load && load.kind === 'error' ? t('app.chooseApps.noApps') : t('app.chooseApps.loading')}
          </Text>
        ) : (
          GROUPS.map((g) => {
            const items = grouped.get(g);
            if (!items || items.length === 0) return null;
            return (
              <InsetGroupedList key={g} header={t(GROUP_KEY[g])}>
                {items.map((a) => {
                  const isFav = favSet.has(a.id);
                  const shown = !isHidden(visibility, a.id);
                  return (
                    <Row
                      key={a.id}
                      title={a.name}
                      icon={<AppIcon app={a} />}
                      accessory={
                        isFav
                          ? { type: 'value', value: t('app.chooseApps.favourite') }
                          : { type: 'switch', value: shown, onValueChange: (on) => update((v) => setHidden(v, a.id, !on)) }
                      }
                      accessibilityLabel={isFav ? t('app.chooseApps.favLabel', { name: a.name }) : a.name}
                    />
                  );
                })}
              </InsetGroupedList>
            );
          })
        )}
        <View style={styles.bottom} />
      </LargeTitleHeader>
    </>
  );
}

/** The service's store icon when it is already known (the Apps tab fetched it), else a TV glyph. */
function AppIcon({ app }: { app: TvApp }) {
  const p = useDesign();
  const [failed, setFailed] = useState(false);
  const uri = failed ? null : storeIcons.peek(app);
  if (uri) {
    return <Image source={{ uri }} style={styles.icon} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.icon, styles.iconFallback, { backgroundColor: p.tintedFill }]}>
      <RemoteIcon name="tv" size={16} color={p.tintedLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: space.lg, marginBottom: space.sm },
  icon: { width: 29, height: 29, borderRadius: radii.sm - 3 },
  iconFallback: { alignItems: 'center', justifyContent: 'center' },
  bottom: { height: space.xxl },
});
