import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { t, tx } from '../i18n';
import { flushProgress } from '../store/progress';
import { flushSettings } from '../store/settings';
import { space, type as ty, useColors } from '../theme/tokens';
import { Button, Card } from './kit';

type Status = 'idle' | 'checking' | 'downloading' | 'current' | 'ready' | 'applying' | 'error' | 'saveError';

/** Only shown in Settings: an update never interrupts a colouring session. */
export function UpdateCard() {
  const { c } = useColors();
  const updates = Updates.useUpdates();
  const [status, setStatus] = useState<Status>('idle');
  const busy = useRef(false);
  const ready = status === 'ready' || updates.isUpdatePending;
  const working = status === 'checking' || status === 'downloading' || status === 'applying' || updates.isChecking || updates.isDownloading;
  async function check() {
    if (busy.current) return;
    busy.current = true; setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable || result.isRollBackToEmbedded) {
        setStatus('downloading');
        const fetched = await Updates.fetchUpdateAsync();
        setStatus(fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'current');
      } else setStatus('current');
    } catch { setStatus('error'); }
    finally { busy.current = false; }
  }
  async function apply() {
    if (busy.current) return;
    busy.current = true; setStatus('applying');
    try { await Promise.all([flushProgress(), flushSettings()]); }
    catch { setStatus('saveError'); busy.current = false; return; }
    try { await Updates.reloadAsync(); }
    catch { setStatus('error'); busy.current = false; }
  }
  const message = !Updates.isEnabled ? 'disabled' : working ? (status === 'applying' ? 'applying' : updates.isDownloading || status === 'downloading' ? 'downloading' : 'checking') : status === 'saveError' || status === 'error' ? status : ready ? 'ready' : status;
  return (
    <Card style={{ gap: space.md }}>
      <Text style={[ty.bodyBold, { color: c.ink }]}>{t('updates.title')}</Text>
      <Text accessibilityLiveRegion="polite" style={[ty.body, { color: c.ink2 }]}>{tx(`updates.${message}`)}</Text>
      {Updates.isEnabled ? <Button label={ready ? t('updates.apply') : t('updates.check')} disabled={working} onPress={() => { void (ready ? apply() : check()); }} /> : null}
    </Card>
  );
}
