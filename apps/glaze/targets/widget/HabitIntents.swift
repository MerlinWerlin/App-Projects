// App Intents behind the habit widget buttons (T73; iOS 17 interactive widgets).
// Button(intent:) runs `perform()` in this widget extension's process: it appends one tap to
// glaze.habitLog.v1 in the App Group (HabitStore.record) and reloads the habit timelines.
// The app folds the taps into its trackers the next time it opens (src/native/widgets.ts syncHabits).
// Intent ids mirror WIDGET_INTENTS in src/core/habits.ts (glaze.habit.increment / decrement / set).
//
// T86: the titles below stay string literals (the App Intents metadata extractor wants constants);
// as LocalizedStringResource they use the English text as the key, translated in the extension's
// Localizable.strings ("Log a habit", "Log mood", "Habit", "Direction", "Level").
//
// Not run on a device or compiled yet: no Xcode in the build environment. VERIFY on a dev build.
import AppIntents
import Foundation
import WidgetKit

/// +step / -step on a count tracker (water +150 ml, sleep +1 h, steps +500), or mood up / down a level.
@available(iOS 17.0, *)
struct StepHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Log a habit"
  /// Only meaningful from the widget's buttons; keep it out of Shortcuts and Spotlight.
  static var isDiscoverable: Bool = false

  @Parameter(title: "Habit")
  var habit: String

  /// +1 adds one step, -1 takes one off.
  @Parameter(title: "Direction", default: 1)
  var direction: Int

  init() {}

  init(habit: HabitKindID, direction: Int) {
    self.habit = habit.rawValue
    self.direction = direction
  }

  func perform() async throws -> some IntentResult {
    if let kind = HabitKindID(rawValue: habit) {
      HabitStore.record(kind, direction: direction >= 0 ? 1 : -1)
      HabitWidgetKinds.reload(kind)
    }
    return .result()
  }
}

/// Pick a mood face (1–5).
@available(iOS 17.0, *)
struct SetMoodIntent: AppIntent {
  static var title: LocalizedStringResource = "Log mood"
  static var isDiscoverable: Bool = false

  @Parameter(title: "Level", default: 3)
  var level: Int

  init() {}

  init(level: Int) {
    self.level = level
  }

  func perform() async throws -> some IntentResult {
    HabitStore.record(.mood, setTo: Double(min(5, max(1, level))))
    HabitWidgetKinds.reload(.mood)
    return .result()
  }
}

enum HabitWidgetKinds {
  static func kind(for habit: HabitKindID) -> String {
    switch habit {
    case .water: return "GlazeHabitWater"
    case .mood: return "GlazeHabitMood"
    case .sleep: return "GlazeHabitSleep"
    case .steps: return "GlazeHabitSteps"
    }
  }

  /// WidgetKit reloads the tapped widget after perform() anyway; this also refreshes other
  /// widgets of the same tracker (for example a small and a medium water widget).
  static func reload(_ habit: HabitKindID) {
    WidgetCenter.shared.reloadTimelines(ofKind: kind(for: habit))
  }
}
