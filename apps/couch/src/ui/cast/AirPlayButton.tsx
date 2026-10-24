import { useRef } from 'react';
import { useT } from '../../i18n/react';
import { showRoutePicker } from '../../native/routePicker';
import { RemoteIcon } from '../icons/RemoteIcon';
import { PillButton, useDesign } from '../v2';

export interface AirPlayButtonProps {
  /** Shows the Screen Mirroring guide (app/airplay.tsx) when the system picker can't open. */
  onShowGuide: () => void;
}

/**
 * "AirPlay / Screen Mirroring" shortcut (T92, cast-1024 phase B), free. A full-width secondary
 * (tinted) pill. Tap opens the system AirPlay route picker through src/native/routePicker; when that
 * is missing (Expo Go, Android) or fails, it calls onShowGuide instead. A second tap while the
 * picker is opening is ignored. Not tested on a device.
 */
export default function AirPlayButton({ onShowGuide }: AirPlayButtonProps) {
  const p = useDesign();
  const t = useT();
  const busy = useRef(false);

  const onPress = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const shown = await showRoutePicker();
      if (!shown) onShowGuide();
    } finally {
      busy.current = false;
    }
  };

  return (
    <PillButton
      stretch
      variant="tinted"
      label={t('ui.airplay.label')}
      accessibilityHint={t('ui.airplay.hint')}
      icon={<RemoteIcon name="screenMirror" size={22} color={p.tintedLabel} />}
      onPress={() => {
        void onPress();
      }}
    />
  );
}
