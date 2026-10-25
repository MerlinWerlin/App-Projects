import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ICON_FRAME_ASPECT, loadApps, type AppsLoad } from '../../src/core/apps';
import { AppIconCache, driverIconFetch } from '../../src/core/appIconCache';
import { loadPersistentKv } from '../../src/native/kv';
import { storeIcons } from '../../src/core/storeIcons';
import { demoArtFor } from '../../src/core/demo';
import type { TvApp } from '../../src/core/types';
import { useT } from '../../src/i18n/react';
import { useFavourites } from '../../src/state/favourites';
import { useAppVisibility } from '../../src/state/appVisibility';
import { hiddenCount, setFavouritesOnly, showAll, visibleSections } from '../../src/core/appVisibility';
import { useSession } from '../../src/state/session';
import { AppTile } from '../../src/ui/apps/AppTile';
import { FavouriteControls } from '../../src/ui/apps/FavouriteControls';
import { appsEmptyCopy, appsEmptyKind } from '../../src/ui/apps/emptyCopy';
import { RemoteIcon } from '../../src/ui/icons/RemoteIcon';
import { FadeIn, animateNextLayout } from '../../src/ui/motion/FadeIn';
import { SkeletonBlock, WithSkeleton } from '../../src/ui/motion/Skeleton';
import { DemoNote } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { useAnnounce } from '../../src/ui/useAnnounce';
import { boxShadow, continuous, list, radii, space, textStyle } from '../../src/theme/design';
import { useReducedMotion } from '../../src/theme/useReducedMotion';
import { Card, LargeTitleHeader, PillButton, useDesign } from '../../src/ui/v2';

const COLS = 3;
/** Skeleton grid: two rows of placeholder tiles in the final layout. */
const SKELETON_TILES = COLS * 2;

/** Screen-reader custom action names (identifiers, never shown to the user). */
const ACTION_EARLIER = 'moveEarlier';
const ACTION_LATER = 'moveLater';
const ACTION_TOGGLE = 'toggleFavourite';
const ACTION_EDIT = 'editFavourites';

/**
 * TV-supplied icons, shared across mounts and keyed by TV id + app id (so they survive reconnects).
 * Dedupes concurrent fetches, remembers failures for a while, bounded LRU. RN Image does the HTTP
 * caching of the image bytes; data: URIs (Samsung) are kept in this cache's memory only.
 */
const iconCache = new AppIconCache();
// Found store icons are kept on the phone (about a month), so each is looked up once.
storeIcons.attachStore(loadPersistentKv());

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * Apps grid on design v2 (T68 step 7, docs/DESIGN_V2.md): "Apps" large title with the TV's name
 * under it and an Edit / Done pill in the bar; tiles are v2 cards (continuous corners, low shadow)
 * with the TV-supplied icon full-bleed in the 4:3 frame, the house tile otherwise. Empty and error
 * states are a Card with a tinted pill. A Favourites section first (T73), then every other app
 * alphabetically; tap opens on the TV. Long-press a tile (or the Edit button) to enter edit mode:
 * favourites can be moved earlier / later and removed, other apps added (up to FAVOURITES_CAP),
 * with labelled buttons and screen-reader actions rather than a drag gesture. Favourites persist
 * per saved TV (src/state/favourites.ts); demo TVs keep theirs until restart.
 */
export default function AppsScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { session, snap } = useSession();
  const [load, setLoad] = useState<AppsLoad | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);
  /** Per app id: URI, null (none / failed) or absent while resolving. */
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const activeId = snap.activeId;
  const tvName = session.activeTv()?.name ?? t('app.apps.yourTv');
  // Tiles that already played their entrance; a tile that remounts (e.g. moves rows after a pin)
  // appears in place instead of replaying the stagger. Cleared when the list reloads.
  const entered = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    entered.current = new Set();
    setLoad(null);
    setStatus(null);
    setEditing(false);
    loadApps(session.activeDriver())
      .then((r) => {
        if (!cancelled) setLoad(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, activeId, reloadTick]);

  const onIconError = useCallback(
    (app: TvApp, uri: string) => {
      if (activeId) iconCache.markFailed(activeId, app.id, uri);
      storeIcons.markFailed(app);
      setIcons((prev) => ({ ...prev, [app.id]: null }));
    },
    [activeId],
  );

  const loadedApps = load && load.kind === 'ok' ? load.apps : null;
  const fav = useFavourites(activeId, loadedApps);
  const { ids: favIds, canAdd, cap, edit } = fav;

  // Icons: the one the TV supplies first, else the service's official App Store icon fetched at
  // runtime (src/core/storeIcons.ts, owner decision 22 Oct 2026); tiles show the house style while
  // loading only when neither is known yet, and when nothing is found or the image fails.
  // Store lookups are queued (Apple's rate limit) and kept on the phone, so they are asked for
  // favourites first and do not go through iconCache's 8 s timeout (fb-1022e: Stan's icon vanished).
  useEffect(() => {
    if (!load || load.kind !== 'ok' || !activeId) {
      setIcons({});
      return;
    }
    const tvFetch = session.can('appIcons') ? driverIconFetch(session.activeDriver()) : null;
    const rank = new Map(fav.ids.map((id, i) => [id, i]));
    const ordered = [...load.apps].sort((x, y) => (rank.get(x.id) ?? 1e6) - (rank.get(y.id) ?? 1e6));
    // Known answers (cached URIs, remembered failures) show at once.
    const initial: Record<string, string | null> = {};
    for (const app of ordered) {
      const fromTv = tvFetch ? iconCache.peek(activeId, app.id) : null;
      if (fromTv) {
        initial[app.id] = fromTv;
        continue;
      }
      const fromStore = storeIcons.peek(app);
      if (fromStore !== undefined && (!tvFetch || fromTv === null)) initial[app.id] = fromStore;
    }
    setIcons(initial);
    let cancelled = false;
    const put = (id: string, uri: string | null) => {
      if (!cancelled) setIcons((prev) => (prev[id] === uri ? prev : { ...prev, [id]: uri }));
    };
    for (const app of ordered) {
      if (initial[app.id]) continue;
      void (async () => {
        const fromTv = tvFetch ? await iconCache.get(activeId, app, tvFetch).catch(() => null) : null;
        if (fromTv) return put(app.id, fromTv);
        put(app.id, await storeIcons.get(app));
      })();
    }
    return () => {
      cancelled = true;
    };
    // fav.ids only ranks the first fetch; a later favourite change must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, load, activeId]);

  // Choose apps / Favourites only (owner-1022). Edit mode shows every app so any can be added.
  const { visibility, update: updateVisibility } = useAppVisibility(activeId);
  const { favourites, others } = useMemo(
    () => visibleSections({ favourites: fav.favourites, others: fav.others }, visibility, editing),
    [fav.favourites, fav.others, visibility, editing],
  );
  const hiddenN = loadedApps ? hiddenCount(visibility, fav.others) : 0;
  const apps: TvApp[] = useMemo(() => [...favourites, ...others], [favourites, others]);

  useEffect(() => {
    for (const a of apps) entered.current.add(a.id);
  }, [apps]);

  /** Status line plus a spoken announcement (accessibilityLiveRegion is Android-only). */
  const say = useCallback((msg: string) => {
    setStatus(msg);
    AccessibilityInfo.announceForAccessibility(msg);
  }, []);

  const onLaunch = useCallback(
    (app: TvApp) => {
      setStatus(t('app.apps.opening', { name: app.name }));
      void session.launchApp(app.id).then((ok) => {
        setStatus(ok ? t('app.apps.opened', { name: app.name }) : null);
      });
    },
    [session, t],
  );

  const setEdit = useCallback(
    (on: boolean) => {
      setEditing(on);
      say(t(on ? 'app.apps.fav.editOn' : 'app.apps.fav.editOff'));
    },
    [say, t],
  );

  const onToggle = useCallback(
    (app: TvApp) => {
      const wasFav = favIds.includes(app.id);
      if (!wasFav && !canAdd) {
        say(t('app.apps.fav.full', { total: cap }));
        return;
      }
      animateNextLayout(reduce);
      if (!edit({ kind: 'toggle', id: app.id })) return;
      say(t(wasFav ? 'app.apps.fav.removed' : 'app.apps.fav.added', { name: app.name }));
    },
    [favIds, canAdd, cap, edit, reduce, say, t],
  );

  const onMove = useCallback(
    (app: TvApp, by: -1 | 1) => {
      const from = favIds.indexOf(app.id);
      if (from < 0) return;
      const to = Math.max(0, Math.min(favIds.length - 1, from + by));
      if (to === from) return;
      animateNextLayout(reduce);
      if (!edit({ kind: 'move', id: app.id, by })) return;
      say(t('app.apps.fav.moved', { name: app.name, n: to + 1, total: favIds.length }));
    },
    [favIds, edit, reduce, say, t],
  );

  const emptyKind = appsEmptyKind({
    kind: load ? load.kind : null,
    appCount: loadedApps ? loadedApps.length : 0,
    demo: snap.demo,
  });

  const renderGrid = (items: readonly TvApp[], startIndex: number, favouriteSection: boolean): ReactElement => {
    let i = startIndex;
    return (
      <View style={styles.grid}>
        {chunk(items, COLS).map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((a) => {
              const index = i++;
              const pos = favouriteSection ? favIds.indexOf(a.id) : -1;
              const earlier = pos > 0;
              const later = pos >= 0 && pos < favIds.length - 1;
              const actions: { name: string; label: string }[] = [];
              if (favouriteSection) {
                if (earlier) actions.push({ name: ACTION_EARLIER, label: t('ui.apps.fav.moveEarlier', { name: a.name }) });
                if (later) actions.push({ name: ACTION_LATER, label: t('ui.apps.fav.moveLater', { name: a.name }) });
                actions.push({ name: ACTION_TOGGLE, label: t('ui.apps.fav.remove', { name: a.name }) });
              } else if (canAdd) {
                actions.push({ name: ACTION_TOGGLE, label: t('ui.apps.fav.add', { name: a.name }) });
              }
              if (!editing) actions.push({ name: ACTION_EDIT, label: t('app.apps.fav.edit') });
              const label = favouriteSection
                ? t('ui.apps.fav.label', { name: a.name, n: pos + 1, total: favIds.length })
                : a.name;
              const hint = editing
                ? t(favouriteSection ? 'ui.apps.fav.hintEditRemove' : 'ui.apps.fav.hintEditAdd')
                : t('ui.apps.fav.hint');
              return (
                <TileCell key={a.id} index={index} animate={!entered.current.has(a.id)}>
                  <AppTile
                    app={a}
                    iconUri={icons[a.id]}
                    demoArt={snap.demo ? demoArtFor(a.id) : null}
                    onLaunch={onLaunch}
                    onTogglePin={onToggle}
                    onEnterEdit={() => {
                      if (!editing) setEdit(true);
                    }}
                    editing={editing}
                    badge={false}
                    onIconError={onIconError}
                    accessibilityLabel={label}
                    accessibilityHint={hint}
                    accessibilityActions={actions}
                    onAccessibilityAction={(name) => {
                      if (name === ACTION_EARLIER) onMove(a, -1);
                      else if (name === ACTION_LATER) onMove(a, 1);
                      else if (name === ACTION_TOGGLE) onToggle(a);
                      else if (name === ACTION_EDIT) setEdit(true);
                    }}
                  />
                  {editing ? (
                    <FavouriteControls
                      app={a}
                      favourite={favouriteSection}
                      canMoveEarlier={earlier}
                      canMoveLater={later}
                      canAdd={canAdd}
                      onMove={onMove}
                      onToggle={onToggle}
                    />
                  ) : null}
                </TileCell>
              );
            })}
            {Array.from({ length: COLS - row.length }, (_, k) => (
              <View key={`pad-${k}`} style={styles.filler} />
            ))}
          </View>
        ))}
      </View>
    );
  };

  let body: ReactElement;
  if (load === null) {
    body = <></>;
  } else if (emptyKind !== null) {
    const copy = appsEmptyCopy(emptyKind, load.kind === 'error' ? load.message : null);
    const action = copy.action
      ? {
          label: copy.action.label,
          onPress:
            copy.action.does === 'retry'
              ? () => setReloadTick((n) => n + 1)
              : () => router.navigate('/tvs'),
        }
      : undefined;
    body = (
      <FadeIn key={emptyKind}>
        <Card style={styles.empty}>
          <View
            style={[styles.emptyIcon, continuous, { backgroundColor: p.tintedFill }]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <RemoteIcon name="tv" size={30} color={p.tintedLabel} />
          </View>
          <View style={styles.emptyCopy} accessible accessibilityLiveRegion={emptyKind === 'error' ? 'polite' : 'none'}>
            <Text style={[textStyle('title3'), styles.center, { color: p.label }]} accessibilityRole="header">
              {copy.title}
            </Text>
            <Text style={[textStyle('subheadline'), styles.center, { color: p.secondaryLabel }]}>{copy.body}</Text>
          </View>
          {action ? <PillButton variant="tinted" label={action.label} onPress={action.onPress} style={styles.emptyPill} /> : null}
        </Card>
      </FadeIn>
    );
  } else {
    const favOnly = visibility.favouritesOnly && !editing;
    const showFavs = favourites.length > 0 || editing || favOnly;
    body = (
      <View style={styles.sections}>
        <View style={styles.toolbar}>
          <PillButton
            variant={favOnly ? 'tinted' : 'plain'}
            haptic="selection"
            label={t(visibility.favouritesOnly ? 'app.apps.vis.showingFavs' : 'app.apps.vis.favsOnly')}
            accessibilityHint={t('app.apps.vis.favsOnlyHint')}
            onPress={() => {
              const on = !visibility.favouritesOnly;
              animateNextLayout(reduce);
              updateVisibility((v) => setFavouritesOnly(v, on));
              say(t(on ? 'app.apps.vis.favsOnlyOn' : 'app.apps.vis.favsOnlyOff'));
            }}
          />
          <PillButton
            variant="plain"
            haptic="selection"
            label={t('app.apps.vis.choose')}
            accessibilityHint={t('app.apps.vis.chooseHint')}
            onPress={() => router.push('/choose-apps')}
          />
        </View>
        {showFavs ? (
          <View style={styles.section}>
            <View style={styles.sectionHd}>
              <Text style={[textStyle('title3'), styles.h3, { color: p.label }]} accessibilityRole="header">
                {t('app.apps.fav.title')}
              </Text>
              {editing ? (
                <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>
                  {t('app.apps.fav.count', { n: favourites.length, total: cap })}
                </Text>
              ) : null}
            </View>
            {favourites.length > 0 ? (
              renderGrid(favourites, 0, true)
            ) : (
              <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{t('app.apps.fav.empty')}</Text>
            )}
          </View>
        ) : null}
        {others.length > 0 ? (
          <View style={styles.section}>
            {showFavs ? (
              <Text style={[textStyle('title3'), styles.h3, { color: p.label }]} accessibilityRole="header">
                {t('app.apps.fav.allApps')}
              </Text>
            ) : null}
            {renderGrid(others, favourites.length, false)}
          </View>
        ) : null}
        {!editing && !favOnly && hiddenN > 0 ? (
          <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]}>
            {t('app.apps.vis.hiddenNote', { count: hiddenN })}
          </Text>
        ) : null}
        {/* Release standard 1: a filter that leaves nothing on screen offers a one-tap "Show all apps". */}
        {!editing && favourites.length === 0 && others.length === 0 && (favOnly || hiddenN > 0) ? (
          <PillButton
            variant="tinted"
            label={t('app.chooseApps.showAll')}
            onPress={() => {
              animateNextLayout(reduce);
              updateVisibility((v) => setFavouritesOnly(showAll(v), false));
              say(t('app.apps.vis.favsOnlyOff'));
            }}
            style={styles.emptyPill}
          />
        ) : null}
      </View>
    );
  }

  const skeleton = (
    <View style={styles.grid}>
      {chunk(Array.from({ length: SKELETON_TILES }, (_, k) => k), COLS).map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((k) => (
            <View
              key={k}
              style={[styles.cell, styles.skTile, continuous, { backgroundColor: p.card, boxShadow: boxShadow('low', p.scheme) }]}
            >
              <SkeletonBlock style={styles.skIcon} />
              <View style={styles.skCaption}>
                <SkeletonBlock style={styles.skName} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  const message = snap.lastError ?? status;
  // A failed app launch is spoken on iOS too (say() covers the status line; night 23 Oct).
  useAnnounce(snap.lastError);
  const canEdit = load !== null && emptyKind === null;

  return (
    <LargeTitleHeader
      title={t('app.apps.title')}
      subtitle={t('app.apps.onTv', { name: tvName })}
      trailing={
        canEdit ? (
          <PillButton
            variant={editing ? 'tinted' : 'plain'}
            haptic="selection"
            label={t(editing ? 'app.apps.fav.done' : 'app.apps.fav.edit')}
            accessibilityLabel={t(editing ? 'app.apps.fav.done' : 'app.apps.fav.edit')}
            accessibilityHint={t(editing ? 'app.apps.fav.doneHint' : 'app.apps.fav.editHint')}
            onPress={() => setEdit(!editing)}
          />
        ) : null
      }
    >
      <View style={styles.content}>
        <WithSkeleton loading={load === null} skeleton={skeleton}>
          {body}
        </WithSkeleton>
        {emptyKind === null ? (
          <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]}>
            {t(editing ? 'app.apps.fav.editingHint' : 'app.apps.fav.hintFooter')}
          </Text>
        ) : null}
        {message ? (
          <Text
            style={[textStyle('footnote'), styles.note, { color: snap.lastError ? p.warning : p.label }]}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Text>
        ) : null}
        {snap.demo ? (
          <View style={styles.note}>
            <DemoNote color={p.secondaryLabel} />
          </View>
        ) : null}
        {emptyKind === null ? (
          <Text style={[textStyle('caption2'), styles.note, { color: p.secondaryLabel }]}>{t('ui.apps.notAffiliated')}</Text>
        ) : null}
      </View>
    </LargeTitleHeader>
  );
}

/**
 * Grid cell. Whether it plays the staggered entrance is fixed when it mounts, so later renders
 * (icons arriving, pins) never swap the wrapper and remount the tile.
 */
function TileCell({ index, animate, children }: { index: number; animate: boolean; children: ReactNode }) {
  const [enter] = useState<boolean>(animate);
  if (!enter) return <View style={styles.cell}>{children}</View>;
  return (
    <FadeIn index={index} style={styles.cell}>
      {children}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: list.inset, gap: space.md },
  h3: { flexShrink: 1 },
  note: { paddingHorizontal: space.xs },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyIcon: { width: 56, height: 56, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { alignItems: 'center', gap: space.xs },
  emptyPill: { alignSelf: 'center' },
  center: { textAlign: 'center' },
  sections: { gap: space.xl },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { gap: space.sm },
  sectionHd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, minWidth: 0 },
  filler: { flex: 1 },
  // Mirrors AppTile's frame (4:3 artwork edge to edge, name below) so the skeleton sits exactly
  // where the tiles land.
  skTile: { borderRadius: radii.md, overflow: 'hidden' },
  skIcon: { width: '100%', aspectRatio: ICON_FRAME_ASPECT, borderRadius: 0 },
  skCaption: { paddingTop: 8, paddingBottom: 10, alignItems: 'center' },
  skName: { width: '60%', height: 11, minHeight: 11, borderRadius: 6, marginVertical: 3 },
});
