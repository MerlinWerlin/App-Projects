/** Matches the actual WidgetKit configurations, not the larger design-preview catalogue. */
export const NATIVE_WIDGET_SIZES: Readonly<Record<string, readonly string[]>> = {
  clock: ['small', 'medium', 'large'], date: ['small', 'medium', 'large'],
  quote: ['small', 'medium', 'large'], photo: ['small', 'medium', 'large'],
  analogClock: ['small', 'large', 'standby', 'accessoryCircular'],
  monthCalendar: ['medium', 'large', 'standby'],
  countdown: ['small', 'medium', 'standby', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  yearProgress: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  monthProgress: ['small', 'medium', 'accessoryCircular', 'accessoryInline'],
  habitWater: ['small', 'medium'], habitMood: ['small', 'medium'],
  habitSleep: ['small', 'medium'], habitSteps: ['small', 'medium'],
};

export function nativeWidgetSupported(kind: string, size: string): boolean {
  return NATIVE_WIDGET_SIZES[kind]?.includes(size) ?? false;
}
