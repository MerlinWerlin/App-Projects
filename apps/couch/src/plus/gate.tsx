/**
 * The Couch Plus gate (owner decision 7 Nov 2026): the single place where the remote and casting are stopped for
 * someone without access. Mounted once in app/_layout.tsx inside SessionProvider and CastProvider, it installs one
 * gate function on the RemoteSession (every key, the d-pad, touchpad, keyboard, voice, numbers, inputs and app
 * launches go through session.sendKey / sendText / launchApp / exec, src/core/session.ts) and on the CastController
 * (everything put on the TV goes through play, src/core/cast/castController.ts).
 *
 * With access (grandfathered, owned, an active trial, or still loading) the gate returns true and nothing changes.
 * Without it the gate returns false, so nothing is sent, and opens the paywall (app/plus.tsx). If the paywall can't
 * open yet it says so in a toast: never a silent dead button.
 * Adding and finding TVs, the TVs list, settings and themes never go through the gate.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { t } from '../i18n/core';
import { useCast } from '../state/cast';
import { useSession } from '../state/session';
import { showToast } from '../ui/Toast';
import { requestPaywall, setPaywallOpener } from './paywall';
import { plusAccess } from './usePlus';

/** True when the remote and casting may be used now; otherwise opens the paywall and returns false. */
export function controlsGate(): boolean {
  if (plusAccess().access().full) return true;
  if (requestPaywall() === 'failed') showToast(t('core.plus.locked'), 'warning');
  return false;
}

export function PlusGate(): null {
  const { session } = useSession();
  const { cast } = useCast();

  useEffect(() => {
    session.setGate(controlsGate);
    cast.setGate(controlsGate);
    return () => {
      session.setGate(null);
      cast.setGate(null);
    };
  }, [session, cast]);

  useEffect(() => {
    setPaywallOpener(() => router.push('/plus'));
    return () => setPaywallOpener(null);
  }, []);

  return null;
}
