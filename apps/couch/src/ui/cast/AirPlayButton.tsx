import { useT } from '../../i18n/react';
import { RemoteIcon } from '../icons/RemoteIcon';
import { PillButton, useDesign } from '../v2';

export interface AirPlayButtonProps {
  /** Shows the Screen Mirroring guide (app/airplay.tsx). */
  onShowGuide: () => void;
}

/**
 * "AirPlay / Screen Mirroring" shortcut (T92, cast-1024 phase B), free. A full-width secondary
 * (tinted) pill that opens the Screen Mirroring guide (app/airplay.tsx).
 * It used to open the system AirPlay route picker directly. Picking the TV there switched the TV to its
 * AirPlay screen, but Couch had nothing playing to send, so the TV just waited (owner TestFlight
 * feedback 1 Nov 2026). Screen Mirroring from Control Centre is what actually puts the phone on the
 * TV, so the button now walks through that instead.
 */
export default function AirPlayButton({ onShowGuide }: AirPlayButtonProps) {
  const p = useDesign();
  const t = useT();
  return (
    <PillButton
      stretch
      variant="tinted"
      label={t('ui.airplay.label')}
      accessibilityHint={t('ui.airplay.hint')}
      icon={<RemoteIcon name="screenMirror" size={22} color={p.tintedLabel} />}
      onPress={onShowGuide}
    />
  );
}
