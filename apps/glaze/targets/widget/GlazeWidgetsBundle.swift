// Entry point of the Glaze WidgetKit extension (docs/WIDGETS.md).
import SwiftUI
import WidgetKit

// T136: WidgetBundleBuilder takes a fixed number of widgets per block (its buildBlock overloads
// have a parameter limit; the last compiled build had 9 entries). The four habit widgets sit in
// their own nested bundle, included through `.body` (the nested-bundle pattern Apple engineers
// suggest on the Developer Forums, thread 652897), so this block stays at 7 entries.
// Add new widgets to a nested bundle rather than growing this list past 9.
@main
struct GlazeWidgetsBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    ClockWidget()
    DateWidget()
    QuoteWidget()
    PhotoWidget()
    // T131: wallpaper-matched background + hero art (written by the bridge's setSeamless).
    SeamlessWidget()
    LockAccessoryWidget()
    GlazeHabitWidgetsBundle().body
    GlazeCatalogueWidgetsBundle().body
    // TODO(T10): "Live Lock" start/stop control. Needs an iOS 18 ControlWidget backed by an
    // App Intent that calls into the GlazeLivelock module (modules/glaze-livelock, reached from JS
    // via src/native/livelock.ts). The intent must run in the app process (openAppWhenRun or
    // a shared AppIntent target) because the extension can't drive the Lock Screen loop itself.
    // Add once T10's Swift module lands; gate with `if #available(iOS 18.0, *)`.
  }
}

/// T73: interactive habit widgets (Button(intent:), iOS 17+). The extension's deployment target is
/// 17.0 (expo-target.config.js), so no `if #available` is needed here; the widget types are still
/// marked @available(iOS 17.0, *) in case the target is ever lowered.
@available(iOS 17.0, *)
struct GlazeHabitWidgetsBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    HabitWaterWidget()
    HabitSleepWidget()
    HabitStepsWidget()
    HabitMoodWidget()
  }
}

struct GlazeCatalogueWidgetsBundle: WidgetBundle {
  var body: some Widget {
    MonthProgressWidget()
    YearProgressWidget()
    AnalogClockWidget()
    MonthCalendarWidget()
    CountdownWidget()
  }
}
