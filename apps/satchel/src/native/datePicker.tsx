// System date / time picker adapter (@react-native-community/datetimepicker, included in Expo Go). The module is
// required lazily inside try/catch and rendered behind an error boundary, so a build without it (or a picker that
// throws) reports `false` / calls onFail and the form falls back to typed YYYY-MM-DD and HH:MM fields instead of
// crashing. Wall-clock conversion lives in src/core/wallpicker.ts; never pass timeZoneName here, the booking's own
// zone is handled by showing its wall-clock fields as phone-local fields.
import { Component, type ReactNode } from 'react';
import type { DateTimePickerEvent, DateTimePickerProps } from '@react-native-community/datetimepicker';

type PickerModule = typeof import('@react-native-community/datetimepicker');
export type { DateTimePickerEvent };

let cached: PickerModule['default'] | null | undefined;
function load(): PickerModule['default'] | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/datetimepicker') as PickerModule & { default?: unknown };
    const C = mod?.default ?? (mod as unknown);
    cached = typeof C === 'function' || (typeof C === 'object' && C !== null) ? (C as PickerModule['default']) : null;
  } catch {
    cached = null;
  }
  return cached;
}

let failed = false;

/** True when the system picker can be shown on this build (and has not failed this session). */
export const systemPickerAvailable = () => !failed && load() !== null;

class Boundary extends Component<{ children: ReactNode; onFail: () => void }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    failed = true;
    this.props.onFail();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

/** The system picker, or nothing (and `onFail`) when it is missing or throws. */
export function SystemPicker(props: DateTimePickerProps & { onFail: () => void }) {
  const Picker = load();
  const { onFail, ...rest } = props;
  if (!Picker || failed) return null;
  return (
    <Boundary onFail={onFail}>
      <Picker {...rest} />
    </Boundary>
  );
}
