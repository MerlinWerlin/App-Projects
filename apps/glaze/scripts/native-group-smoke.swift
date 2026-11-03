import SwiftUI
import Foundation

@main struct NativeGroupSmokeApp: App {
  var body: some Scene { WindowGroup { Text("Glaze shared habit storage check").task { await NativeGroupSmoke.run() } } }
}

@MainActor enum NativeGroupSmoke {
  static var started = false
  static func run() async {
    guard !started else { return }; started = true
    let mode = ProcessInfo.processInfo.arguments.last ?? "clock"
    let fm = FileManager.default
    let folder = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("GlazeGroupSmoke")
    do {
      try fm.createDirectory(at: folder, withIntermediateDirectories: true)
      guard let container = fm.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup),
            let store = UserDefaults(suiteName: GlazeShared.appGroup),
            let runID = Bundle.main.object(forInfoDictionaryKey: "ReviewRunID") as? String else { throw failure("Shared App Group unavailable in installed simulator host") }
      var result: [String: Any] = ["mode": mode, "runID": runID, "appGroup": GlazeShared.appGroup,
        "groupContainer": container.path, "bundleID": Bundle.main.bundleIdentifier ?? "unknown",
        "sourceSHA": Bundle.main.object(forInfoDictionaryKey: "ReviewSourceSHA") as? String ?? "unknown",
        "physicalDeviceTest": false, "productionAppUsed": false, "installedWidgetInstance": false]
      if mode == "clock" {
        let now = Date()
        result["now"] = Int64(now.timeIntervalSince1970 * 1000)
        result["offsetMinutes"] = TimeZone.current.secondsFromGMT(for: now) / 60
      } else if mode == "write" {
        // Never overwrite an existing Glaze tracker/log. These hosts run only on a fresh CI simulator.
        guard store.string(forKey: HabitStore.habitsKey) == nil, store.string(forKey: HabitStore.logKey) == nil else { throw failure("Refusing existing simulator habit data") }
        let input = fm.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("group-fixture.json")
        let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: input)) as! [String: Any]
        let habits = raw["habitsRaw"] as! String
        store.set(runID, forKey: "glaze.groupSmoke.runID")
        store.set(habits, forKey: HabitStore.habitsKey)
        result["habitsRaw"] = habits
      } else {
        guard store.string(forKey: "glaze.groupSmoke.runID") == runID else { throw failure("Independent process could not read writer marker") }
        if mode == "intents" {
          _ = try await StepHabitIntent(habit: .water, direction: 1).perform()
          _ = try await StepHabitIntent(habit: .sleep, direction: 1).perform()
          _ = try await StepHabitIntent(habit: .steps, direction: -1).perform()
          _ = try await SetMoodIntent(level: 5).perform()
          result["actualIntentMethodsCalled"] = 4
        } else if mode != "read" { throw failure("Unknown test stage") }
        let now = Date()
        result["now"] = Int64(now.timeIntervalSince1970 * 1000)
        result["offsetMinutes"] = TimeZone.current.secondsFromGMT(for: now) / 60
        result["habitsRaw"] = store.string(forKey: HabitStore.habitsKey) ?? ""
        result["logRaw"] = store.string(forKey: HabitStore.logKey) ?? ""
        result["todayValues"] = Dictionary(uniqueKeysWithValues: HabitKindID.allCases.map { ($0.rawValue, HabitStore.todayValue($0, now: now)) })
      }
      // No synchronize() call: exercise the production UserDefaults write/read path.
      try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: folder.appendingPathComponent(mode + ".json"), options: .atomic)
    } catch {
      try? JSONSerialization.data(withJSONObject: ["mode": mode, "error": String(describing: error)], options: [.prettyPrinted]).write(to: folder.appendingPathComponent("_ERROR.json"))
    }
  }
  static func failure(_ text: String) -> NSError { NSError(domain: "GlazeGroupSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
}
