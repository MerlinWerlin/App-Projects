/**
 * Widget wiring for the app (T77): handles couch://widget/... links and keeps the widget snapshot
 * current. Mount once inside <SessionProvider> with <WidgetLinkHost /> (docs/WIDGET.md has the line
 * for app/_layout.tsx).
 *
 * - Links: every link that parses sends its key, Plus or not (every TV control is free).
 * - Snapshot: Plus is read here, only through src/plus, and only decides whether the widget gets
 *   buttons or just an "Open Couch" tile with a hint. In Expo Go the bridge is unavailable and
 *   nothing is written.
 */
import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
import { useLocale } from '../../i18n/react';
import { usePlus } from '../../plus/state';
import { useSession } from '../../state/session';
import { loadWidgetBridge } from '../../native/widgetBridge';
import { createWidgetLinkHandler } from './linkHandler';
import { createWidgetSnapshotSync } from './snapshotSync';

/** The launch URL is handled once per app process, even if the host remounts. */
let initialUrlHandled = false;

export function useWidgetLinks(): void {
  const { session, snap } = useSession();
  const { canUse, loaded } = usePlus();
  const plus = loaded && canUse('widgets');
  // Snapshot labels are translated when built, so a language change rebuilds it.
  const locale = useLocale();

  const handler = useMemo(
    () =>
      createWidgetLinkHandler({
        tvIds: () => session.getSnapshot().tvs.map((tv) => tv.id),
        activeId: () => session.getSnapshot().activeId,
        isDemo: () => session.getSnapshot().demo,
        select: (id) => session.select(id),
        sendKey: (key) => session.sendKey(key),
      }),
    [session],
  );
  const sync = useMemo(() => createWidgetSnapshotSync(loadWidgetBridge()), []);

  useEffect(() => {
    const onUrl = (url: string | null): void => {
      void handler.handle(url).catch(() => undefined);
    };
    if (!initialUrlHandled) {
      initialUrlHandled = true;
      Linking.getInitialURL().then(onUrl, () => undefined);
    }
    const sub = Linking.addEventListener('url', (e: { url: string }) => onUrl(e.url));
    return () => sub.remove();
  }, [handler]);

  // A link that arrived before the saved TVs loaded is sent once they are in the session.
  useEffect(() => {
    if (handler.hasPending()) void handler.retryPending().catch(() => undefined);
  }, [handler, snap.tvs, snap.demo]);

  const active = snap.demo ? null : (snap.tvs.find((tv) => tv.id === snap.activeId) ?? null);
  useEffect(() => {
    if (!loaded) return;
    void sync.update({
      tv: active ? { id: active.id, name: active.name || active.model } : null,
      state: snap.state,
      reconnecting: snap.reconnecting,
      plus,
      now: Date.now(),
    });
  }, [sync, loaded, plus, active, snap.state, snap.reconnecting, locale]);
}

/** Renders nothing; mounts useWidgetLinks() where a component is easier to place than a hook. */
export function WidgetLinkHost(): null {
  useWidgetLinks();
  return null;
}
