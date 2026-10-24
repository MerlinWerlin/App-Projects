/**
 * route-picker: opens the system AirPlay route picker (the same sheet as the AirPlay button in
 * Control Centre) from a plain JS call. iOS only; there is no native view to place.
 *
 * UNVERIFIED: not compiled yet (needs a dev build). See README.md.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface RoutePickerNativeModule {
  /**
   * Shows the AirPlay route picker. Resolves true when the picker's button was found and tapped
   * (the system sheet should be on screen), false when it could not be shown. Never rejects.
   */
  show(): Promise<boolean>;
  /** True when the module is compiled in (always true on iOS builds that include it). */
  isAvailable(): boolean;
}

/** The native module, or null in Expo Go / Android / web / tests where it is not compiled in. */
const RoutePicker = requireOptionalNativeModule<RoutePickerNativeModule>('RoutePicker');

export default RoutePicker;

export function isRoutePickerAvailable(): boolean {
  return RoutePicker !== null;
}
