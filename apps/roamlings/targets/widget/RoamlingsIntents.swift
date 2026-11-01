// App Intents behind the widget's Feed and Pet buttons (iOS 17 interactive widgets).
// perform() runs in the widget extension: it logs the tap for the app (which applies it with the
// real game rules next time it opens: src/core/widget.ts applyTaps) and bumps the widget's own copy
// of happiness so the pet reacts straight away. Gains and cooldowns mirror src/core/growth.ts.
import AppIntents
import Foundation
import WidgetKit

@available(iOS 17.0, *)
enum CareTap {
  static func record(_ action: String, gain: Double, cooldownMs: Double) {
    guard let defaults = UserDefaults(suiteName: RoamlingsShared.appGroup) else { return }
    let nowMs = Date().timeIntervalSince1970 * 1000
    guard var state = WidgetState.load(), state.hasPet else { return }
    let readyAt = action == "feed" ? state.feedReadyAt : state.petReadyAt
    guard nowMs >= readyAt else { return }

    // Append the tap for the app.
    var taps: [[String: Any]] = []
    if let raw = defaults.string(forKey: RoamlingsShared.tapsKey),
       let data = raw.data(using: .utf8),
       let arr = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] {
      taps = arr
    }
    taps.append(["action": action, "at": nowMs])
    if taps.count > 50 { taps = Array(taps.suffix(50)) }
    if let data = try? JSONSerialization.data(withJSONObject: taps), let json = String(data: data, encoding: .utf8) {
      defaults.set(json, forKey: RoamlingsShared.tapsKey)
    }

    // Optimistic update so the widget shows the happier pet now.
    let current = state.happiness(at: Date())
    state.happiness = min(100, current + gain)
    state.happinessAt = nowMs
    if action == "feed" { state.feedReadyAt = nowMs + cooldownMs } else { state.petReadyAt = nowMs + cooldownMs }
    state.save()
  }
}

@available(iOS 17.0, *)
struct FeedBuddyIntent: AppIntent {
  static var title: LocalizedStringResource = "Feed your buddy"
  static var isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    CareTap.record("feed", gain: 25, cooldownMs: 3 * 3_600_000)
    return .result()
  }
}

@available(iOS 17.0, *)
struct PetBuddyIntent: AppIntent {
  static var title: LocalizedStringResource = "Pet your buddy"
  static var isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    CareTap.record("pet", gain: 10, cooldownMs: 60_000)
    return .result()
  }
}
