import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PLATFORM_LABEL } from '../../src/core/types';
import { canWake, wakeTv } from '../../src/core/wol';
import { useT } from '../../src/i18n/react';
import { loadPhoneIp } from '../../src/native/network';
import { loadUdpFactory } from '../../src/native/udp';
import { setDemoMode, useSession } from '../../src/state/session';
import { continuous, list, radii, space, textStyle } from '../../src/theme/design';
import { useReducedMotion } from '../../src/theme/useReducedMotion';
import { RemoteIcon } from '../../src/ui/icons/RemoteIcon';
import { FadeIn, animateNextLayout } from '../../src/ui/motion/FadeIn';
import { DemoNote } from '../../src/ui/Screen';
import { showToast } from '../../src/ui/Toast';
import { Text } from '../../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../../src/ui/v2';

function safeLoad<T>(load: () => T | null): T | null {
  try {
    return load();
  } catch {
    return null;
  }
}

/**
 * TV list (multi-TV switcher) + demo mode toggle, design v2 (market-1018 M3, docs/DESIGN_V2.md):
 * "Your TVs" large title with an add pill, saved TVs as an inset-grouped list (TV icon tile, name,
 * room · model · platform; the TV in use shows a check, the others a chevron). Tapping a TV selects it
 * and opens the remote ("Now controlling <name>" toast). A saved TV with a MAC gets a "Wake" row under
 * it when a UDP sender exists (dev builds with react-native-udp; never in Expo Go): it broadcasts the
 * Wake-on-LAN magic packet (src/core/wol.ts). Never throws; the outcome shows as a short note under the
 * list. The empty state is a card with a filled "Add a TV" pill.
 */
export default function TvsScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { session, snap } = useSession();
  const reduce = useReducedMotion();
  const [udp] = useState(() => safeLoad(loadUdpFactory));
  const [phoneIp] = useState(() => safeLoad(loadPhoneIp));
  const [wakeNote, setWakeNote] = useState<{ id: string; note: string } | null>(null);
  const [waking, setWaking] = useState<string | null>(null);
  const alive = useRef<boolean>(true);
  // TVs added, removed or replaced (add-TV flow, demo toggle): glide the list into its new layout
  // before React commits the change (LayoutAnimation; no-op with Reduce Motion).
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  useEffect(() => {
    let tvs = session.getSnapshot().tvs;
    return session.subscribe(() => {
      const next = session.getSnapshot().tvs;
      if (next === tvs) return;
      tvs = next;
      animateNextLayout(reduceRef.current);
    });
  }, [session]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const wake = (id: string, mac: string | undefined): void => {
    if (waking) return;
    setWaking(id);
    setWakeNote(null);
    const ipP: Promise<string | null> = phoneIp ? phoneIp().catch(() => null) : Promise.resolve(null);
    ipP
      .then((ip) => wakeTv(udp, mac, { phoneIp: ip }))
      .catch(() => ({ ok: false, note: t('app.tvs.wakeFailed') }))
      .then((r) => {
        if (!alive.current) return;
        setWaking(null);
        setWakeNote({ id, note: r.note });
      });
  };

  const addTv = () => router.push('/add-tv');
  const noteTv = wakeNote ? snap.tvs.find((tv) => tv.id === wakeNote.id) : undefined;

  return (
    <LargeTitleHeader
      title={t('app.tvs.title')}
      trailing={
        snap.tvs.length > 0 ? (
          <PillButton
            variant="plain"
            label={t('app.tvs.add')}
            accessibilityLabel={t('app.tvs.addTv')}
            icon={<RemoteIcon name="plus" size={18} color={p.tintLabel} />}
            onPress={addTv}
          />
        ) : null
      }
    >
      {snap.tvs.length === 0 ? (
        <FadeIn style={styles.emptyWrap}>
          <Card style={styles.empty}>
            <View style={[styles.emptyIcon, continuous, { backgroundColor: p.tintedFill }]}>
              <RemoteIcon name="tv" size={30} color={p.tintedLabel} />
            </View>
            <Text style={[textStyle('title3'), styles.center, { color: p.label }]} accessibilityRole="header">
              {t('app.tvs.emptyTitle')}
            </Text>
            <Text style={[textStyle('subheadline'), styles.center, { color: p.secondaryLabel }]}>{t('app.tvs.emptyBody')}</Text>
            <PillButton label={t('app.tvs.addTv')} onPress={addTv} style={styles.emptyPill} />
            <Text style={[textStyle('footnote'), styles.center, { color: p.secondaryLabel }]}>{t('app.tvs.emptyDemo')}</Text>
          </Card>
          <Text style={[textStyle('footnote'), styles.emptyNote, { color: p.secondaryLabel }]}>{t('app.tvs.sameWifi')}</Text>
        </FadeIn>
      ) : (
        <InsetGroupedList footer={t('app.tvs.sameWifi')}>
          {snap.tvs.flatMap((tv) => {
            const inUse = tv.id === snap.activeId;
            const showWake = !snap.demo && canWake(tv, udp !== null);
            const detail = tv.room ? t('app.tvs.roomModel', { room: tv.room, model: tv.model }) : tv.model;
            const rows = [
              <Row
                key={tv.id}
                title={inUse ? t('app.tvs.nameInUse', { name: tv.name }) : tv.name}
                subtitle={
                  tv.castOnly
                    ? t('app.tvs.detailCastOnly', { detail, platform: PLATFORM_LABEL[tv.platform] })
                    : t('app.tvs.detailPlatform', { detail, platform: PLATFORM_LABEL[tv.platform] })
                }
                icon={<RemoteIcon name="tv" size={20} color={p.tintInk} />}
                iconBackground={p.tint}
                accessory={inUse ? { type: 'check', checked: true } : { type: 'chevron' }}
                accessibilityLabel={
                  tv.room
                    ? t(inUse ? 'app.tvs.tvLabelRoomInUse' : 'app.tvs.tvLabelRoom', { name: tv.name, room: tv.room, model: tv.model })
                    : t(inUse ? 'app.tvs.tvLabelInUse' : 'app.tvs.tvLabel', { name: tv.name, model: tv.model })
                }
                onPress={() => {
                  if (!inUse) showToast(t('app.tvs.nowControlling', { name: tv.name }));
                  session.select(tv.id);
                  router.navigate('/remote');
                }}
              />,
            ];
            if (showWake) {
              rows.push(
                <Row
                  key={`${tv.id}-wake`}
                  title={waking === tv.id ? t('app.tvs.waking') : t('app.tvs.wake')}
                  icon={<RemoteIcon name="power" size={18} color={p.tintLabel} />}
                  iconBackground={p.tintedFill}
                  accessory={{ type: 'none' }}
                  accessibilityLabel={t('app.tvs.wakeLabel', { name: tv.name })}
                  disabled={waking !== null}
                  onPress={() => wake(tv.id, tv.mac)}
                />,
              );
            }
            return rows;
          })}
        </InsetGroupedList>
      )}
      {wakeNote && noteTv ? (
        <Text style={[textStyle('footnote'), styles.note, { color: p.secondaryLabel }]} accessibilityLiveRegion="polite">
          {wakeNote.note}
        </Text>
      ) : null}

      <InsetGroupedList>
        <Row
          title={t('app.tvs.demoMode')}
          subtitle={t('app.tvs.demoBody')}
          accessibilityLabel={t('app.tvs.demoMode')}
          accessibilityHint={t('app.tvs.demoBody')}
          accessory={{
            type: 'switch',
            value: snap.demo,
            onValueChange: (on) => {
              setDemoMode(session, on).catch(() => {});
            },
          }}
        />
      </InsetGroupedList>

      <InsetGroupedList>
        <Row
          title={t('app.tvs.settings')}
          icon={<RemoteIcon name="settings" size={20} color={p.tintInk} />}
          iconBackground={p.tint}
          accessory={{ type: 'chevron' }}
          accessibilityLabel={t('app.tvs.settings')}
          onPress={() => router.push('/settings')}
        />
      </InsetGroupedList>
      {snap.demo ? (
        <View style={styles.noteWrap}>
          <DemoNote color={p.secondaryLabel} />
        </View>
      ) : null}
    </LargeTitleHeader>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { marginHorizontal: list.inset, marginBottom: list.groupGap, gap: space.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyIcon: { width: 56, height: 56, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  emptyNote: { paddingHorizontal: list.rowPadding },
  emptyPill: { alignSelf: 'center' },
  center: { textAlign: 'center' },
  note: { paddingHorizontal: list.inset + list.rowPadding, marginTop: -space.lg, marginBottom: list.groupGap },
  noteWrap: { paddingHorizontal: list.inset + list.rowPadding },
});
