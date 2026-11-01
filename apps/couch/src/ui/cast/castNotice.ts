/**
 * Cast tab notice text (oversight D145-2): why casting is not reaching a real TV. Pure function so
 * tests can check every kind; the screen (app/(tabs)/cast.tsx) renders it. 'demo' shows DemoNote and
 * 'expoGo' shows app.cast.expoGoNote in the screen itself, so this returns null for those.
 */
import type { CastDelivery, CastNotice } from '../../core/cast/castController';
import type { MessageKey, Params } from '../../i18n/core';

export function castNoticeText(notice: CastNotice, t: (key: MessageKey, params?: Params) => string): string | null {
  switch (notice.kind) {
    case 'serverUnavailable':
      return t('ui.cast.serverUnavailable', { name: notice.tvName });
    case 'noReceiver':
      return (
        t('ui.cast.noReceiver', { name: notice.tvNames.join(', '), ports: notice.ports.join(', ') }) +
        ' ' +
        t(notice.searched ? 'ui.cast.noReceiverSearched' : 'ui.cast.noReceiverNoSearch')
      );
    case 'needsCastBuild':
      return t('ui.cast.needsCastBuild', { name: notice.tvNames.join(', ') });
    default:
      return null;
  }
}

/**
 * Where the current item went on a real TV (owner brief 25 Oct 2026: on TestFlight 1.0.1 the remote
 * connected but queued media never appeared). Shown while the TV has not confirmed it, or after an
 * error, so one screenshot of the Cast tab says which TV address took the request and where the TV
 * must fetch the file from.
 */
export function castDeliveryText(delivery: CastDelivery, t: (key: MessageKey, params?: Params) => string): string {
  const fileHost = (delivery.fileHost || '?') + (delivery.fileCheck ? ` (${delivery.fileCheck})` : '');
  const params = { tvHost: delivery.tvHost, fileHost };
  if (delivery.via === 'roku') return t('ui.cast.deliveryRoku', params);
  if (delivery.via === 'googlecast') return t('ui.cast.deliveryGcast', params);
  return t('ui.cast.deliveryDlna', params);
}
