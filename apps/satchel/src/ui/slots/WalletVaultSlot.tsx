// Slot on the Wallet tab, owned by T06: entry to the document vault (counts and expiry status only, never document
// content). Also the vault's shared UI pieces (lock gate, expiry text and badge, kind icons) used by /vault,
// /doc/[id] and /doc-edit, so all three show the same lock and the same wording.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { deviceZone, todayIn } from '../../core/format.ts';
import type { DocKind } from '../../core/model.ts';
import { formatExpiry, vaultSummary, type Expiry, type TripWarning } from '../../core/vault.ts';
import type { T } from '../../i18n/core.ts';
import type { Key } from '../../i18n/en.ts';
import { authenticate, authMethod, CANNOT_LOCK, type AuthFailure, type AuthMethod } from '../../native/auth.ts';
import { useApp } from '../../state/app.tsx';
import { useTrips } from '../../state/trips.tsx';
import { dispatchLock, useVaultDocs, useVaultLock } from '../../state/vaultLock.ts';
import { fonts, radius, space } from '../../theme/tokens.ts';
import { Body, Button, Card, Label, PressableScale, Screen, Title, Warning } from '../kit.tsx';
import { PermissionNotice } from '../PermissionNotice.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const DOC_ICON: Record<DocKind, IconName> = {
  passport: 'book-outline',
  visa: 'document-attach-outline',
  licence: 'card-outline',
  insurance: 'medkit-outline',
  other: 'document-text-outline',
};

export const docKindKey = (k: DocKind): Key => `doc.kind.${k}` as Key;

/** "Expires in 40 days · 3 Dec 2026" etc. The same text is used visually and for screen readers. */
export function expiryText(t: T, e: Expiry, expires: string | undefined, lang: string): string {
  const date = expires ? formatExpiry(expires, lang) : '';
  switch (e.status) {
    case 'expired':
      return t('doc.status.expired', { date });
    case 'soon':
      if (e.days === 0) return t('doc.status.today');
      if (e.days === 1) return t('doc.status.tomorrow');
      return t('doc.status.soon', { n: e.days ?? 0, date });
    case 'ok':
      return t('doc.status.ok', { date });
    default:
      return t('doc.status.none');
  }
}

export function tripWarningText(t: T, w: TripWarning, docLabel: string, lang: string): string {
  const vars = { doc: docLabel, date: formatExpiry(w.expires, lang), trip: w.tripName };
  return w.kind === 'during-trip' ? t('doc.warn.duringTrip', vars) : t('doc.warn.sixMonths', vars);
}

/** Small outlined pill for expired / expiring documents (nothing for ok / none). */
export function ExpiryBadge({ status }: { status: Expiry['status'] }) {
  const { t, theme } = useApp();
  if (status !== 'expired' && status !== 'soon') return null;
  const colour = status === 'expired' ? theme.danger : theme.warn;
  return (
    <View style={{ borderWidth: 1, borderColor: colour, borderRadius: radius.l, paddingHorizontal: space.s, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colour }}>{status === 'expired' ? t('doc.badge.expired') : t('doc.badge.soon')}</Text>
    </View>
  );
}

const UNLOCK_LABEL: Record<AuthMethod, Key> = {
  face: 'vault.unlock.face',
  fingerprint: 'vault.unlock.fingerprint',
  passcode: 'vault.unlock.passcode',
  none: 'vault.unlock.passcode',
};

/**
 * Locked screen shared by every vault route. Shows no document details. Tapping Unlock asks the system
 * (Face ID / Touch ID, device passcode as fallback). Cancelled or failed: stays locked with Try again.
 * Only when the phone cannot lock at all (no hardware, nothing enrolled, unavailable) does it offer
 * "Open without lock this time", with a plain warning that the vault is then unprotected.
 */
export function VaultLockGate({ autoPrompt = false }: { autoPrompt?: boolean }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'busy' | AuthFailure>('idle');
  const [method, setMethod] = useState<AuthMethod>('passcode');
  const alive = useRef(true);
  const prompted = useRef(false);

  const unlock = async () => {
    setPhase('busy');
    const r = await authenticate(t('vault.unlock.prompt'), t('common.cancel'), t('vault.unlock.fallback'));
    if (!alive.current) return;
    if (r.ok) {
      setPhase('idle');
      dispatchLock({ type: 'unlocked' });
    } else setPhase(r.reason);
  };

  useEffect(() => {
    alive.current = true;
    authMethod().then((m) => alive.current && setMethod(m));
    if (autoPrompt && !prompted.current) {
      prompted.current = true;
      unlock();
    }
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cannotLock = phase !== 'idle' && phase !== 'busy' && CANNOT_LOCK.includes(phase);
  const failed = phase === 'cancelled' || phase === 'error';

  return (
    <Screen>
      <Title>{t('vault.title')}</Title>
      <Body muted>{t('vault.privacy')}</Body>
      <Card style={{ alignItems: 'center', gap: space.m, paddingVertical: space.xl }}>
        <Ionicons name="lock-closed-outline" size={44} color={theme.ink} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
          {phase === 'busy' ? t('vault.unlocking') : t('vault.locked')}
        </Text>
        <View accessibilityLiveRegion="polite" style={{ alignSelf: 'stretch', gap: space.s }}>
          {phase === 'busy' ? <Body muted>{t('vault.unlockingBody')}</Body> : null}
          {phase === 'idle' ? <Body muted>{t('vault.lockedBody')}</Body> : null}
          {failed ? (
            <View accessibilityRole="alert" style={{ gap: space.xs }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.danger }}>{t('vault.err.unlock')}</Text>
              <Body>{t('vault.err.unlockBody')}</Body>
            </View>
          ) : null}
        </View>
      </Card>
      {phase === 'idle' || failed ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('vault.unlock.a11y')}
          accessibilityHint={t('vault.unlock.hint')}
          onPress={unlock}
          style={{ backgroundColor: theme.accent, borderRadius: radius.m, paddingHorizontal: space.l, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.onAccent }}>{failed ? t('common.tryAgain') : t(UNLOCK_LABEL[method])}</Text>
        </PressableScale>
      ) : null}
      {cannotLock ? (
        <View style={{ gap: space.s }}>
          {/* The phone can't lock at all: Open Settings, Try again, and the existing "open without lock" rule. */}
          <PermissionNotice
            kind="faceid"
            state="unavailable"
            title={t('vault.err.noLock')}
            reason={t('vault.err.noLockBody')}
            onRetry={unlock}
            fallbackLabel={t('vault.openUnlocked')}
            fallbackHint={t('vault.openUnlockedHint')}
            onFallback={() => dispatchLock({ type: 'unlocked', unprotected: true })}
          />
          <Body muted>{t('vault.openUnlockedHint')}</Body>
        </View>
      ) : null}
      {phase !== 'busy' && router.canGoBack() ? <Button label={t('common.cancel')} kind="quiet" onPress={() => router.back()} /> : null}
    </Screen>
  );
}

export function WalletVaultSlot() {
  const { t, theme } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [docs] = useVaultDocs();
  const lock = useVaultLock();
  const s = vaultSummary(docs, trips, todayIn(deviceZone()));
  const one = s.total === 1;
  const count = !s.total
    ? t('vault.slot.none')
    : lock.unlocked
      ? one
        ? t('vault.slot.countOpenOne')
        : t('vault.slot.countOpen', { n: s.total })
      : one
        ? t('vault.slot.countOne')
        : t('vault.slot.count', { n: s.total });
  const status = !s.total
    ? null
    : s.expired
      ? { text: s.expired === 1 ? t('vault.slot.expiredOne') : t('vault.slot.expired', { n: s.expired }), colour: theme.danger }
      : s.soon
        ? { text: s.soon === 1 ? t('vault.slot.soonOne') : t('vault.slot.soon', { n: s.soon }), colour: theme.warn }
        : s.tripWarnings
          ? { text: t('vault.slot.trip'), colour: theme.warn }
          : { text: t('vault.slot.ok'), colour: theme.ok };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[t('vault.slot.title'), count, status?.text].filter(Boolean).join(', ')}
      accessibilityHint={t('vault.slot.hint')}
      onPress={() => router.push('/vault')}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name={lock.unlocked ? 'lock-open-outline' : 'lock-closed-outline'} size={22} color={theme.ink} />
          <Text style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink, flex: 1 }}>{t('vault.slot.title')}</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </View>
        {s.total ? <Label>{count}</Label> : <Body muted>{count}</Body>}
        {status ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: status.colour }}>{status.text}</Text> : null}
      </Card>
    </PressableScale>
  );
}

/** Banner shown inside the vault when it was opened without a lock. */
export function UnprotectedBanner() {
  const { t } = useApp();
  const lock = useVaultLock();
  return lock.unprotected ? <Warning text={t('vault.unprotected')} /> : null;
}
