// Entry point of the Glaze WidgetKit extension (docs/WIDGETS.md).
import SwiftUI
import WidgetKit

@main
struct GlazeWidgetsBundle: WidgetBundle {
  var body: some Widget {
    ClockWidget()
    DateWidget()
    QuoteWidget()
    PhotoWidget()
    LockAccessoryWidget()
    // T73: interactive habit widgets (Button(intent:), iOS 17+). The extension's deployment
    // target is 17.0 (expo-target.config.js), so no `if #available` is needed here; the types are
    // still marked @available(iOS 17.0, *) in case the target is ever lowered.
    HabitWaterWidget()
    HabitSleepWidget()
    HabitStepsWidget()
    HabitMoodWidget()
    // TODO(T10): "Live Lock" start/stop control. Needs an iOS 18 ControlWidget backed by an
    // App Intent that calls into the GlazeLivelock module (modules/glaze-livelock, reached from JS
    // via src/native/livelock.ts). The intent must run in the app process (openAppWhenRun or
    // a shared AppIntent target) because the extension can't drive the Lock Screen loop itself.
    // Add once T10's Swift module lands; gate with `if #available(iOS 18.0, *)`.
  }
}
