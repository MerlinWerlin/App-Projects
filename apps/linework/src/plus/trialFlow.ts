// "Start free trial" (guideline 3.1.1, docs/OWNER_1024.md), shared by the Plus screen and the Home offer card.
// Never fails silently: says when the store isn't there, when the trial was already used, or when it went wrong.
import { Alert } from 'react-native';
import { t } from '../i18n';
import { select, success } from '../native/haptics';
import { TRIAL_DAYS, accessFor } from './access';
import type { UsePlus } from './usePlus';

export async function startTrialWithAlerts(plus: Pick<UsePlus, 'startTrial'>): Promise<void> {
  select();
  const r = await plus.startTrial();
  if (r.status === 'cancelled') return;
  if (r.status === 'unavailable') {
    Alert.alert(t('plus.trialFailedTitle'), t('plus.trialNotReady'));
    return;
  }
  if (r.status === 'failed' || r.start === null) {
    Alert.alert(t('plus.trialFailedTitle'), t('plus.trialFailed'));
    return;
  }
  // A reinstall finds the trial already owned: its original date counts, so it may already have ended.
  if (accessFor(false, r.start, Date.now()).reason === 'expired') {
    Alert.alert(t('plus.trialUsedTitle'), t('plus.trialUsedBody', { days: TRIAL_DAYS }));
    return;
  }
  success();
}
