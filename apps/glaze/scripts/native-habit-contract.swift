import Foundation

// Standalone test host only. Production gets GlazeShared from ThemeStore.swift.
enum GlazeShared { static let appGroup = "com.glaze.habit-contract.unused.\(UUID().uuidString)" }

@main struct NativeHabitContract {
  static func main() throws {
    let source = URL(fileURLWithPath: CommandLine.arguments[1])
    let root = try JSONSerialization.jsonObject(with: Data(contentsOf: source)) as! [String: Any]
    let cases = root["cases"] as! [[String: Any]]
    var checks = 0
    var failures: [String] = []
    func check(_ good: Bool, _ label: String) { checks += 1; if !good { failures.append(label) } }
    func same(_ actual: Any, _ expected: Any, _ label: String) {
      check(NSDictionary(dictionary: ["v": actual]).isEqual(NSDictionary(dictionary: ["v": expected])), label)
    }
    let familySupport = root["familySupport"] as! [String: [String]]
    for kind in HabitKindID.allCases {
      check(kind.nativeSizes == familySupport[kind.rawValue], "\(kind.rawValue): actual native family contract matches app delivery")
    }
    func logObject(_ log: HabitStore.Log?) -> Any {
      guard let log else { return NSNull() }
      return ["logId": log.logId, "seq": log.seq, "events": log.events.map { e -> [String: Any] in
        ["seq": e.seq, "kind": e.kind.rawValue, "op": e.op, "amount": e.amount, "at": NSNumber(value: e.at), "off": e.off]
      }] as [String: Any]
    }
    let name = "com.glaze.habit-contract.\(UUID().uuidString)"
    let store = UserDefaults(suiteName: name)!
    defer { store.removePersistentDomain(forName: name); UserDefaults(suiteName: GlazeShared.appGroup)?.removePersistentDomain(forName: GlazeShared.appGroup) }
    for c in cases {
      store.removePersistentDomain(forName: name)
      let label = c["name"] as! String
      if let h = c["habitsRaw"] as? String { store.set(h, forKey: HabitStore.habitsKey) }
      if let l = c["logRaw"] as? String { store.set(l, forKey: HabitStore.logKey) }
      let (trackers, mark) = HabitStore.readTrackers(in: store)
      var actual: [String: Any] = [:]
      for (kind, t) in trackers {
        actual[kind.rawValue] = ["day": t.day, "value": t.value, "step": t.step, "goal": t.goal as Any? ?? NSNull(), "history": t.history] as [String: Any]
      }
      same(actual, c["expectedTrackers"]!, label + ": parsed trackers match app")
      let markObject: Any
      if let mark { markObject = ["logId": mark.logId, "seq": mark.seq] as [String: Any] }
      else { markObject = NSNull() }
      same(markObject, c["expectedMark"]!, label + ": applied mark matches app")
      same(logObject(HabitStore.readLog(in: store)), c["expectedLog"]!, label + ": tap log matches app")
      let now = Date(timeIntervalSince1970: (c["now"] as! NSNumber).doubleValue / 1000)
      let offset = (c["offset"] as! NSNumber).intValue
      let expected = c["expectedValues"] as! [String: NSNumber]
      for kind in HabitKindID.allCases {
        check(HabitStore.todayValue(kind, now: now, in: store, offsetMinutes: offset) == expected[kind.rawValue]!.doubleValue, label + ": today's \(kind.rawValue) matches app")
      }
    }

    store.removePersistentDomain(forName: name)
    let now = Date(timeIntervalSince1970: 1793620800)
    check(HabitStore.record(.water, now: now, in: store), "first native water tap")
    check(HabitStore.todayValue(.water, now: now, in: store) == 150, "water increment persisted")
    let reopened = UserDefaults(suiteName: name)!
    check(HabitStore.todayValue(.water, now: now, in: reopened) == 150, "fresh handle sees native tap")
    check(HabitStore.record(.water, direction: -1, now: now, in: store), "native decrement")
    check(HabitStore.todayValue(.water, now: now, in: store) == 0, "water floor zero")
    check(HabitStore.record(.mood, setTo: 4, now: now, in: store), "set mood")
    check(HabitStore.record(.mood, now: now, in: store), "raise mood")
    check(HabitStore.todayValue(.mood, now: now, in: store) == 5, "mood cap")
    check(!HabitStore.record(.mood, setTo: .nan, now: now, in: store), "reject NaN before serialization")
    check(!HabitStore.record(.water, now: Date(timeIntervalSince1970: .nan), in: store), "reject corrupt date before Int64 conversion")

    // All app-written tracker bytes must survive native tap writes unchanged.
    let appOwned = "{\"v\":1,\"habits\":[]}"
    store.set(appOwned, forKey: HabitStore.habitsKey)
    check(HabitStore.record(.sleep, now: now, in: store), "sleep tap")
    check(store.string(forKey: HabitStore.habitsKey) == appOwned, "native writer never rewrites app trackers")
    let previous = HabitStore.readLog(in: store)!
    let acknowledgement: [String: Any] = ["v": 1, "habits": [], "applied": ["logId": previous.logId, "seq": previous.seq]]
    store.set(String(data: try JSONSerialization.data(withJSONObject: acknowledgement), encoding: .utf8), forKey: HabitStore.habitsKey)
    check(HabitStore.record(.steps, now: now, in: store), "tap after app acknowledgement")
    check(HabitStore.readLog(in: store)?.events.count == 1, "acknowledged taps pruned")

    store.removePersistentDomain(forName: name)
    DispatchQueue.concurrentPerform(iterations: 200) { _ in _ = HabitStore.record(.steps, now: now, in: store) }
    let concurrent = HabitStore.readLog(in: store)!
    check(concurrent.seq == 200 && concurrent.events.count == 200, "200 concurrent same-process taps retained")
    check(Set(concurrent.events.map(\.seq)).count == 200, "concurrent sequence ids unique")
    check(HabitStore.todayValue(.steps, now: now, in: store) == 100000, "concurrent tap total")
    check(HabitStore.todayValue(.steps, now: now.addingTimeInterval(86400), in: store) == 0, "next local day resets visible value")
    for _ in 0..<250 { _ = HabitStore.record(.steps, now: now, in: store) }
    check(HabitStore.readLog(in: store)?.events.count == 400, "native log bounded at400")
    check(HabitStore.readLog(in: store)?.seq == 450, "pruning does not reuse sequence ids")

    check(HabitColours.rgb(" #abc ") == HabitColours.rgb("#AABBCC"), "short and whitespace hex matches SwiftUI colour parser")
    check(HabitColours.resolve("#fff", stops: ["#000"], secondary: true) == "#FFFFFF", "short white resolves without losing theme colour")
    check(HabitColours.rgb("invalid") == HabitColours.rgb("#17201D"), "invalid colour safely falls back")
    let savedCases = root["savedCases"] as? [[String: Any]] ?? []
    check(savedCases.count == 48, "48 real editor saved-design cases supplied")
    var savedColours: [[String: Any]] = []
    for c in savedCases {
      let design = SavedWidgetDesign(raw: c["raw"] as! [String: Any], texts: c["texts"] as! [String: String])
      check(design.habitTitle == (c["expectedTitle"] as? String), "\(c["id"]!): native title matches actual editor payload")
      let fill = design.background
      let stops: [String] = fill["kind"] as? String == "gradient"
        ? [fill["from"] as! String, fill["to"] as! String]
        : [fill["colour"] as! String, fill["colour"] as! String]
      let ink = HabitColours.resolve(design.textColour, stops: stops, secondary: true)
      let accent = HabitColours.resolve(design.accent, stops: stops, secondary: false)
      let backgrounds = HabitColours.samples(stops)
      check(HabitColours.inkScore(ink, backgrounds: backgrounds) >= 4.5, "\(c["id"]!): saved text/button/mood ink readable")
      check(HabitColours.accentScore(accent, backgrounds: backgrounds) >= 4.5, "\(c["id"]!): saved title/mood accent readable")
      savedColours.append(["theme": c["id"]!, "ink": ink, "accent": accent, "stops": stops, "preferredInk": design.textColour, "preferredAccent": design.accent])
    }
    func title(_ text: Any?, role: String = "text", resolved: String? = nil) -> String? {
      let region: [String: Any] = ["id": "name", "role": role, "text": ["userText": text ?? NSNull()]]
      return SavedWidgetDesign(raw: ["regions": [region]], texts: resolved.map { ["name": $0] } ?? [:]).habitTitle
    }
    check(title(nil, resolved: "Hydration") == "Hydration", "resolved editor translation used without custom title")
    check(title("Drink up", resolved: "Water") == "Drink up", "user title takes precedence over saved translation")
    check(title("   ", resolved: "Water") == nil, "empty explicit title falls back to native localized name")
    check(title(123, resolved: "Water") == "Water", "malformed user title falls back to resolved translation")
    check(title("  Drink\nwater  ") == "Drink water", "multiline corrupt title becomes a single trimmed line")
    check(title("x", role: "photo") == nil, "non-text name region ignored")
    check(title(String(repeating: "a", count: 100))?.count == 40, "corrupt unbounded title is capped")
    check(title("水分補給 💧") == "水分補給 💧", "Unicode title survives decoding")
    var colours: [[String: Any]] = []
    for p in root["palettes"] as? [[String: Any]] ?? [] {
      let id=p["id"] as! String,stops=p["stops"] as! [String]
      let preferredInk=p["ink"] as! String,preferredAccent=p["accent"] as! String
      let ink=HabitColours.resolve(preferredInk,stops:stops,secondary:true)
      let accent=HabitColours.resolve(preferredAccent,stops:stops,secondary:false)
      let backgrounds=HabitColours.samples(stops)
      check(HabitColours.inkScore(ink,backgrounds:backgrounds)>=4.5,id+": readable primary/secondary/button ink")
      check(HabitColours.accentScore(accent,backgrounds:backgrounds)>=4.5,id+": readable title and mood accent")
      check(HabitColours.resolve(preferredInk,stops:stops,secondary:true)==ink,id+": cached ink stable")
      colours.append(["theme":id,"ink":ink,"accent":accent,"stops":stops,"preferredInk":preferredInk,"preferredAccent":preferredAccent])
    }
    let result: [String: Any] = ["schema": "GLAZE_NATIVE_HABIT_CONTRACT_V1", "sourceSHA": ProcessInfo.processInfo.environment["GITHUB_SHA"] ?? "local", "fixtureCases": cases.count, "savedDesignCases": savedCases.count, "savedPalettes": savedColours, "palettes": colours, "checks": checks, "failures": failures, "sameProcessConcurrency": 200, "realAppGroupTouched": false, "physicalDeviceTest": false, "installedWidgetTapTest": false]
    try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
    for failure in failures { print("FAIL: \(failure)") }
    print("Native habit contract: \(checks) assertions / \(cases.count) cross-language cases / \(failures.count) failures")
    if !failures.isEmpty { exit(1) }
  }
}
