/** Matches the actual WidgetKit configurations, not the larger design-preview catalogue. */
export const NATIVE_WIDGET_SIZES: Readonly<Record<string, readonly string[]>> = {
  clock: ['small', 'medium', 'large'], date: ['small', 'medium', 'large'],
  quote: ['small', 'medium', 'large'], photo: ['small', 'medium', 'large'],
  analogClock: ['small', 'large', 'standby', 'accessoryCircular'],
  monthCalendar: ['medium', 'large', 'standby'],
  countdown: ['small', 'medium', 'standby', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  yearProgress: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  monthProgress: ['small', 'medium', 'accessoryCircular', 'accessoryInline'],
  habitWater: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  habitMood: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular'],
  habitSleep: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
  habitSteps: ['small', 'medium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'],
};

export function nativeWidgetSupported(kind: string, size: string): boolean {
  return NATIVE_WIDGET_SIZES[kind]?.includes(size) ?? false;
}

/** Capability versions describe the installed binary, independently of the v2 editor payload. */
export function requiredNativeWidgetVersion(kind: string, size: string): number {
  return kind.startsWith('habit') && size.startsWith('accessory') ? 3 : 2;
}
