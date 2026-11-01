// T237 (owner-1101g #2): the focus timer behind focus art on the Glaze "Seamless" widget (e.g.
// Indigo Current's "Harbour focus", '25:00 FOCUS' painted in). Tapping the widget's Start button
// runs a 25 minute session; tapping again pauses, then resumes. The state lives in the App Group's
// UserDefaults so the widget (LiveArtOverlay.swift) and every copy of it agree. No Live Activity
// (removed earlier); the widget shows Text(timerInterval:) while a session runs and its timeline
// ends at the session's end, so it flips back to "25:00 · Start" by itself.
// Keep FocusStore.minutes in sync with FOCUS_MINUTES (src/core/liveArt.ts).
//
// iOS 17+ (Button(intent:), AppIntent in the widget extension), like HabitIntents.swift. The
// literal titles are localised (English text = key in targets/widget/<lang>.lproj/Localizable.strings).
// Not compiled here (no Xcode in the build environment). VERIFY on a dev build.
import AppIntents
import Foundation
import WidgetKit

/// Where a focus session is. (Not named FocusState: SwiftUI already has a type with that name.)
enum GlazeFocusPhase {
  case idle
  case running(end: Date)
  case paused(remaining: TimeInterval)
}

enum FocusStore {
  static let minutes: Double = 25
  static var length: TimeInterval { minutes * 60 }

  private static let endKey = "glaze.focus.v1.end"
  private static let remainingKey = "glaze.focus.v1.remaining"
  private static var defaults: UserDefaults? { UserDefaults(suiteName: GlazeShared.appGroup) }

  /// The phase at `now`. A session whose end has passed is over (idle again).
  static func phase(at now: Date) -> GlazeFocusPhase {
    guard let d = defaults else { return .idle }
    let end = d.double(forKey: endKey)
    if end > now.timeIntervalSince1970 {
      return .running(end: Date(timeIntervalSince1970: end))
    }
    let remaining = d.double(forKey: remainingKey)
    if remaining > 0 && remaining <= length {
      return .paused(remaining: remaining)
    }
    return .idle
  }

  /// Start (idle), pause (running) or resume (paused).
  static func toggle(now: Date) {
    guard let d = defaults else { return }
    switch phase(at: now) {
    case .idle:
      d.set(now.addingTimeInterval(length).timeIntervalSince1970, forKey: endKey)
      d.removeObject(forKey: remainingKey)
    case .running(let end):
      d.set(max(1, end.timeIntervalSince(now)), forKey: remainingKey)
      d.removeObject(forKey: endKey)
    case .paused(let remaining):
      d.set(now.addingTimeInterval(remaining).timeIntervalSince1970, forKey: endKey)
      d.removeObject(forKey: remainingKey)
    }
  }

  /// "mm:ss" for a paused or idle session (digits only, no words).
  static func clock(_ seconds: TimeInterval) -> String {
    let s = max(0, Int(seconds.rounded(.up)))
    return String(format: "%d:%02d", s / 60, s % 60)
  }
}

@available(iOS 17.0, *)
struct ToggleFocusIntent: AppIntent {
  static var title: LocalizedStringResource = "Start or pause focus"
  static var isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    FocusStore.toggle(now: Date())
    // WidgetKit reloads the tapped widget after perform(); this also refreshes other Seamless widgets.
    WidgetCenter.shared.reloadTimelines(ofKind: "GlazeSeamless")
    return .result()
  }
}
