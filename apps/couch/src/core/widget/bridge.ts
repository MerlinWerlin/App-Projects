/**
 * WidgetBridge port (T77). The real bridge is a native module that only exists in a dev build
 * (src/native/widgetBridge.ts over modules/widget-bridge). In Expo Go, web and tests the app gets
 * UNAVAILABLE_WIDGET_BRIDGE, which quietly does nothing: there is simply no widget to update.
 */
export interface WidgetBridge {
  /** false without the native module: setSnapshot / reloadTimelines are no-ops. */
  readonly available: boolean;
  /** Stores the snapshot JSON where the widget extension can read it. */
  setSnapshot(json: string): Promise<void>;
  /** Asks the system to redraw the widgets (WidgetCenter.reloadAllTimelines on iOS). */
  reloadTimelines(): Promise<void>;
}

export const UNAVAILABLE_WIDGET_BRIDGE: WidgetBridge = Object.freeze({
  available: false,
  setSnapshot: async (): Promise<void> => {},
  reloadTimelines: async (): Promise<void> => {},
});
