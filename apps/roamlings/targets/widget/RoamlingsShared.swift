// Shared model for the Roamlings widget: reads what the app wrote into the App Group.
// Mirrors src/core/widget.ts (WidgetState, WIDGET_* keys). Not compiled in the cloud (no Xcode):
// VERIFY on the first production-native TestFlight build.
import Foundation
import UIKit

enum RoamlingsShared {
  static let appGroup = "group.com.jared797.roamlings"
  static let stateKey = "roamlings.widget.state.v1"
  static let tapsKey = "roamlings.widget.taps.v1"
}

struct WidgetLabels: Codable {
  var feed: String
  var pet: String
  var egg: String
  var eggsReady: String
  var spark: String
  var hatch: String
}

struct WidgetState: Codable {
  var v: Int
  var hasPet: Bool
  var name: String
  var rarity: String
  var imageKey: String
  var happiness: Double
  var happinessAt: Double
  var decayPerHour: Double
  var floor: Double
  var eggSpark: Double
  var eggCost: Double
  var eggsReady: Int
  var sparkToday: Double
  var steps: Double
  var streak: Int
  var feedReadyAt: Double
  var petReadyAt: Double
  var labels: WidgetLabels

  static func load() -> WidgetState? {
    guard let defaults = UserDefaults(suiteName: RoamlingsShared.appGroup),
          let json = defaults.string(forKey: RoamlingsShared.stateKey),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetState.self, from: data)
  }

  func save() {
    guard let defaults = UserDefaults(suiteName: RoamlingsShared.appGroup),
          let data = try? JSONEncoder().encode(self),
          let json = String(data: data, encoding: .utf8) else { return }
    defaults.set(json, forKey: RoamlingsShared.stateKey)
  }

  /// Happiness at a moment, with the same decay rule as src/core/growth.ts.
  func happiness(at date: Date) -> Double {
    let nowMs = date.timeIntervalSince1970 * 1000
    let hours = max(0, nowMs - happinessAt) / 3_600_000
    return min(100, max(floor, happiness - hours * decayPerHour))
  }

  /// Image file for the mood at that moment (buddy-joyful / buddy-happy / buddy-sleepy).
  func imageName(at date: Date) -> String {
    let h = happiness(at: date)
    if h >= 85 { return "buddy-joyful.png" }
    if h >= 35 { return "buddy-happy.png" }
    return "buddy-sleepy.png"
  }

  var eggProgress: Double { eggCost > 0 ? min(1, max(0, eggSpark / eggCost)) : 0 }
}

enum BuddyImages {
  static func image(named name: String) -> UIImage? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: RoamlingsShared.appGroup) else { return nil }
    let url = container.appendingPathComponent(name)
    return UIImage(contentsOfFile: url.path)
  }
}
