// Stubs added by T24 (see ../README.md). Hand-written from the published API of
// @react-native-community/datetimepicker 8.x (src/index.d.ts / types.d.ts). Only the members Satchel uses, plus the
// common props so a misspelt prop is caught. Unverified offline: the PC's `npx tsc --noEmit` is authoritative.
declare module '@react-native-community/datetimepicker' {
  import type * as React from 'react';
  import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

  export type EvtTypes = 'set' | 'dismissed' | 'neutralButtonPressed';
  export type DateTimePickerEvent = {
    type: EvtTypes;
    nativeEvent: { timestamp: number; utcOffset?: number };
  };

  export type IOSMode = 'date' | 'time' | 'datetime' | 'countdown';
  export type AndroidMode = 'date' | 'time';
  export type Display = 'default' | 'spinner' | 'compact' | 'inline' | 'clock' | 'calendar';

  type ButtonType = { label?: string; textColor?: ColorValue };

  export type DateTimePickerProps = {
    value: Date;
    mode?: IOSMode | AndroidMode;
    display?: Display;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    is24Hour?: boolean;
    minimumDate?: Date;
    maximumDate?: Date;
    themeVariant?: 'dark' | 'light';
    locale?: string;
    textColor?: string;
    accentColor?: string;
    minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
    timeZoneName?: string;
    timeZoneOffsetInMinutes?: number;
    positiveButton?: ButtonType;
    negativeButton?: ButtonType;
    neutralButton?: ButtonType;
    disabled?: boolean;
    testID?: string;
    style?: StyleProp<ViewStyle>;
  };

  /** v9 name for the iOS prop set (DateTimePickerProps is no longer exported by the real package). */
  export type IOSNativeProps = DateTimePickerProps;
  const RNDateTimePicker: React.FC<DateTimePickerProps>;
  export default RNDateTimePicker;

  export const DateTimePickerAndroid: {
    open: (props: DateTimePickerProps) => void;
    dismiss: (mode: AndroidMode) => Promise<boolean>;
  };
}
