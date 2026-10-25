// One permission notice for every feature (T19): a small icon, a heading, the plain reason, then the actions the
// state allows (src/core/permissions.ts): Open Settings, Try again, and a fallback path where one exists.
// Contract other tasks rely on: kind, reason, onRetry?, fallbackLabel?, onFallback? (state defaults to 'blocked').
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { fallbackKey, permissionActions, reasonKey, titleKey, type PermissionAction, type PermissionKind, type PermissionState } from '../core/permissions.ts';
import type { Key } from '../i18n/en.ts';
import { openSettings } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { Body, Button, Card } from './kit.tsx';

export type { PermissionKind, PermissionState } from '../core/permissions.ts';

export type PermissionNoticeProps = {
  kind: PermissionKind;
  /** Plain-words reason shown to the user (already translated). Defaults to the catalogue reason for kind + state. */
  reason?: string;
  /** Which state to explain. Defaults to 'blocked' (refused, only Settings can change it). */
  state?: Exclude<PermissionState, 'granted'>;
  /** Heading (already translated). Defaults to the catalogue heading for kind + state. */
  title?: string;
  onRetry?: () => void;
  /** Label for the other way to get it done. Defaults to permissions.<kind>.fallback when onFallback is set. */
  fallbackLabel?: string;
  /** Screen-reader hint for the fallback button (already translated). */
  fallbackHint?: string;
  onFallback?: () => void;
};

const ICON: Record<PermissionKind, string> = {
  location: 'location-outline',
  photos: 'images-outline',
  faceid: 'scan-outline',
  contacts: 'people-outline',
  files: 'folder-open-outline',
};

export function PermissionNotice({ kind, reason, state = 'blocked', title, onRetry, fallbackLabel, fallbackHint, onFallback }: PermissionNoticeProps) {
  const { t, theme } = useApp();
  const heading = title ?? t(titleKey(kind, state) as Key);
  const body = reason ?? t(reasonKey(kind, state) as Key);
  const actions = permissionActions(kind, state, { hasRetry: !!onRetry, hasFallback: !!onFallback });
  const button = (a: PermissionAction, i: number) => {
    const style = i === 0 ? 'primary' : 'quiet';
    if (a === 'settings') return <Button key={a} label={t('common.openSettings')} hint={t('permissions.openSettingsHint')} kind={style} onPress={openSettings} />;
    if (a === 'retry' && onRetry) return <Button key={a} label={t('common.tryAgain')} hint={t('permissions.retryHint')} kind={style} onPress={onRetry} />;
    if (a === 'fallback' && onFallback) return <Button key={a} label={fallbackLabel ?? t(fallbackKey(kind) as Key)} hint={fallbackHint} kind={style} onPress={onFallback} />;
    return null;
  };
  return (
    <Card>
      <View accessibilityLiveRegion="polite" style={{ gap: space.s }}>
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={t('permissions.a11y', { title: heading, reason: body })}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 36, height: 36, borderRadius: radius.s, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={ICON[kind]} size={20} color={theme.accent} />
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{heading}</Text>
            <Body>{body}</Body>
          </View>
        </View>
        {actions.length ? <View style={{ gap: space.s, marginTop: space.xs }}>{actions.map(button)}</View> : null}
      </View>
    </Card>
  );
}
