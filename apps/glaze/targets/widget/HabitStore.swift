// Habit trackers for the interactive habit widgets (T73, docs/WIDGETS.md "Interactive habit widgets").
//
// Two App Group keys, one writer each:
//   glaze.habits.v1    written by the APP (src/native/widgets.ts syncHabits): trackers + `applied` mark.
//   glaze.habitLog.v1  written HERE (button taps): { v, logId, seq, events: [{seq, kind, op, amount, at, off}] }.
// This file mirrors src/core/habitLog.ts (habitLogEventFor, appendHabitLog, habitTodayValue) and the
// value rules of src/core/habits.ts. Keep the numbers below in sync with HABIT_DEFS.
// Decoding is tolerant (JSONSerialization + type checks): bad data reads as "nothing logged".
// T86: a tracker's `goal` is the person's own daily goal (app › Habit goals, src/core/habitGoals.ts);
// names, units and labels come from HabitText (Localizable.strings in targets/widget/<lang>.lproj).
import Foundation

enum HabitKindID: String, CaseIterable {
  case water, mood, sleep, steps
}

struct HabitDef {
  enum Mode { case count, scale }
  let kind: HabitKindID
  let mode: Mode
  let step: Double
  let max: Double
  /// Default daily goal. The person's own goal (app › Habit goals, T86) arrives in the tracker JSON.
  let goal: Double?
  let decimals: Int

  /// Short unit after a number, in the phone's language (Localizable.strings, T86).
  var unit: String { HabitText.unit(kind) }
  var name: String { HabitText.name(kind) }

  static func of(_ kind: HabitKindID) -> HabitDef {
    switch kind {
    case .water: return HabitDef(kind: kind, mode: .count, step: 150, max: 10_000, goal: 2000, decimals: 0)
    case .sleep: return HabitDef(kind: kind, mode: .count, step: 1, max: 24, goal: 8, decimals: 1)
    case .steps: return HabitDef(kind: kind, mode: .count, step: 500, max: 200_000, goal: 8000, decimals: 0)
    case .mood: return HabitDef(kind: kind, mode: .scale, step: 1, max: 5, goal: nil, decimals: 0)
    }
  }
}

/// Habit widget copy (T86). Looked up in the extension's own Localizable.strings
/// (targets/widget/<lang>.lproj, the same 11 languages as the app; docs/I18N.md "Widget extension").
/// `defaultValue` is the English text, shown when a key is missing. Formats use positional
/// arguments (%1$@ %2$@) so a language can reorder them.
/// VERIFY on a dev build: String(localized:defaultValue:) applies the interpolated arguments to the
/// translated format (iOS 16+ API; the extension targets 17.0).
enum HabitText {
  static func name(_ kind: HabitKindID) -> String {
    switch kind {
    case .water: return String(localized: "habit.name.water", defaultValue: "Water")
    case .sleep: return String(localized: "habit.name.sleep", defaultValue: "Sleep")
    case .steps: return String(localized: "habit.name.steps", defaultValue: "Steps")
    case .mood: return String(localized: "habit.name.mood", defaultValue: "Mood")
    }
  }

  static func unit(_ kind: HabitKindID) -> String {
    switch kind {
    case .water: return String(localized: "habit.unit.ml", defaultValue: "ml")
    case .sleep: return String(localized: "habit.unit.hours", defaultValue: "h")
    case .steps: return String(localized: "habit.unit.steps", defaultValue: "steps")
    case .mood: return ""
    }
  }

  /// Widget gallery description.
  static func description(_ kind: HabitKindID) -> String {
    switch kind {
    case .water: return String(localized: "habit.desc.water", defaultValue: "Tap +150 ml as you drink. Resets at midnight.")
    case .sleep: return String(localized: "habit.desc.sleep", defaultValue: "Log your sleep an hour at a time.")
    case .steps: return String(localized: "habit.desc.steps", defaultValue: "Count steps by hand in blocks of 500.")
    case .mood: return String(localized: "habit.desc.mood", defaultValue: "Pick how today feels.")
    }
  }

  /// "of 2,000 ml" under the value.
  static func goalOf(_ goal: String, unit: String) -> String {
    String(localized: "habit.goalOf", defaultValue: "of \(goal) \(unit)")
  }

  /// Accessibility label of the + button: "Add 150 ml".
  static func add(_ amount: String, unit: String) -> String {
    String(localized: "habit.a11y.add", defaultValue: "Add \(amount) \(unit)")
  }

  /// Accessibility label of the − button: "Take off 150 ml".
  static func remove(_ amount: String, unit: String) -> String {
    String(localized: "habit.a11y.remove", defaultValue: "Take off \(amount) \(unit)")
  }

  static var moodDown: String { String(localized: "habit.a11y.moodDown", defaultValue: "Lower mood") }
  static var moodUp: String { String(localized: "habit.a11y.moodUp", defaultValue: "Raise mood") }

  /// Mood level name; 0 = not logged yet.
  static func mood(_ level: Int) -> String {
    switch level {
    case 1: return String(localized: "habit.mood.1", defaultValue: "Awful")
    case 2: return String(localized: "habit.mood.2", defaultValue: "Low")
    case 3: return String(localized: "habit.mood.3", defaultValue: "Okay")
    case 4: return String(localized: "habit.mood.4", defaultValue: "Good")
    case 5: return String(localized: "habit.mood.5", defaultValue: "Great")
    default: return String(localized: "habit.mood.0", defaultValue: "Not logged")
    }
  }

  /// Accessibility label of a mood face button: "Log mood: good".
  static func logMood(_ level: Int) -> String {
    switch level {
    case 1: return String(localized: "habit.a11y.mood1", defaultValue: "Log mood: awful")
    case 2: return String(localized: "habit.a11y.mood2", defaultValue: "Log mood: low")
    case 3: return String(localized: "habit.a11y.mood3", defaultValue: "Log mood: okay")
    case 4: return String(localized: "habit.a11y.mood4", defaultValue: "Log mood: good")
    default: return String(localized: "habit.a11y.mood5", defaultValue: "Log mood: great")
    }
  }
}

enum HabitStore {
  static let habitsKey = "glaze.habits.v1"
  static let logKey = "glaze.habitLog.v1"
  static let maxEvents = 400
  static let historyDays = 400
  private static let maxOffsetMinutes = 14 * 60
  /// Taps can arrive back to back; serialise read-modify-write of the log inside this process.
  private static let lock = NSLock()

  struct Tracker {
    var day: String
    var value: Double
    var step: Double
    var goal: Double?
    var history: [String: Double]
  }

  struct Mark {
    let logId: String
    let seq: Int
  }

  struct Event {
    let seq: Int
    let kind: HabitKindID
    let op: String // "add" | "set"
    let amount: Double
    let at: Int64 // epoch ms
    let off: Int // minutes east of UTC at tap time
  }

  struct Log {
    var logId: String
    var seq: Int
    var events: [Event]
  }

  // MARK: Days

  static func offsetMinutes(at date: Date) -> Int {
    TimeZone.current.secondsFromGMT(for: date) / 60
  }

  /// `YYYY-MM-DD` of `date` at a fixed UTC offset (same as localDayKey in src/core/calendarMaths.ts).
  static func dayKey(_ date: Date, offsetMinutes: Int) -> String {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(secondsFromGMT: offsetMinutes * 60) ?? TimeZone(identifier: "UTC") ?? .current
    let c = cal.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
  }

  // MARK: Reading

  private static var defaults: UserDefaults? { UserDefaults(suiteName: GlazeShared.appGroup) }

  private static func object(forKey key: String) -> [String: Any]? {
    guard
      let json = defaults?.string(forKey: key),
      let data = json.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data),
      let dict = obj as? [String: Any]
    else { return nil }
    return dict
  }

  private static func number(_ any: Any?) -> Double? {
    guard let n = any as? NSNumber else { return nil }
    // JSONSerialization hands booleans over as NSNumber too; refuse them.
    if CFGetTypeID(n) == CFBooleanGetTypeID() { return nil }
    let d = n.doubleValue
    return d.isFinite ? d : nil
  }

  /// Whole number in a safe range (Int(Double) traps outside Int's range).
  private static func int(_ any: Any?) -> Int? {
    guard let d = number(any), d >= -9_000_000_000_000_000, d <= 9_000_000_000_000_000 else { return nil }
    return Int(d.rounded(.towardZero))
  }

  private static func validLogId(_ any: Any?) -> String? {
    guard let s = any as? String, !s.isEmpty, s.count <= 64 else { return nil }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
    return s.unicodeScalars.allSatisfy { allowed.contains($0) && $0.isASCII } ? s : nil
  }

  /// The app's trackers (by kind) and how far into the log it has applied.
  static func readTrackers() -> (trackers: [HabitKindID: Tracker], mark: Mark?) {
    guard let root = object(forKey: habitsKey), number(root["v"]) == 1 else { return ([:], nil) }
    var out: [HabitKindID: Tracker] = [:]
    for item in (root["habits"] as? [Any]) ?? [] {
      guard
        let o = item as? [String: Any],
        let kind = (o["kind"] as? String).flatMap(HabitKindID.init(rawValue:)),
        let day = o["day"] as? String, day.count == 10,
        out[kind] == nil
      else { continue }
      let def = HabitDef.of(kind)
      var history: [String: Double] = [:]
      for (k, v) in (o["history"] as? [String: Any]) ?? [:] {
        if let n = number(v), k.count == 10 { history[k] = n }
      }
      let step = number(o["step"]).flatMap { $0 > 0 ? min($0, def.max) : nil } ?? def.step
      out[kind] = Tracker(day: day, value: number(o["value"]) ?? 0, step: step, goal: number(o["goal"]) ?? def.goal, history: history)
    }
    var mark: Mark?
    if let m = root["applied"] as? [String: Any], let id = validLogId(m["logId"]), let seq = int(m["seq"]), seq >= 0 {
      mark = Mark(logId: id, seq: seq)
    }
    return (out, mark)
  }

  static func readLog() -> Log? {
    guard let root = object(forKey: logKey), number(root["v"]) == 1, let logId = validLogId(root["logId"]) else { return nil }
    var events: [Event] = []
    var seen = Set<Int>()
    for item in (root["events"] as? [Any]) ?? [] {
      guard
        let o = item as? [String: Any],
        let seq = int(o["seq"]), seq >= 1,
        let kind = (o["kind"] as? String).flatMap(HabitKindID.init(rawValue:)),
        let op = o["op"] as? String, op == "add" || op == "set",
        let amount = number(o["amount"]),
        let at = int(o["at"]), at >= 0
      else { continue }
      if seen.contains(seq) { continue }
      seen.insert(seq)
      let rawOff = int(o["off"]) ?? 0
      let off = abs(rawOff) <= maxOffsetMinutes ? rawOff : 0
      events.append(Event(seq: seq, kind: kind, op: op, amount: amount, at: Int64(at), off: off))
    }
    events.sort { $0.seq < $1.seq }
    let top = events.last?.seq ?? 0
    return Log(logId: logId, seq: max(int(root["seq"]) ?? 0, top), events: events)
  }

  private static func pending(_ log: Log?, _ mark: Mark?) -> [Event] {
    guard let log = log else { return [] }
    let done = (mark?.logId == log.logId) ? (mark?.seq ?? 0) : 0
    return log.events.filter { $0.seq > done }
  }

  // MARK: Value rules (habits.ts clampValue / increment / decrement / set)

  private static func round2(_ v: Double) -> Double { (v * 100).rounded() / 100 }

  static func apply(_ kind: HabitKindID, value: Double, op: String, amount: Double) -> Double {
    let def = HabitDef.of(kind)
    switch def.mode {
    case .scale:
      if op == "set" {
        let r = amount.rounded()
        return r < 1 ? 0 : min(def.max, r)
      }
      if amount > 0 { return value == 0 ? 1 : min(def.max, value + 1) }
      let r = value - 1
      return r < 1 ? 0 : r
    case .count:
      let next = op == "set" ? amount : value + amount
      return round2(min(def.max, max(0, next)))
    }
  }

  /// Today's value as the widget shows it: the app's value for today plus today's pending taps.
  static func todayValue(_ kind: HabitKindID, now: Date) -> Double {
    let off = offsetMinutes(at: now)
    let today = dayKey(now, offsetMinutes: off)
    let (trackers, mark) = readTrackers()
    var value: Double = 0
    if let t = trackers[kind] {
      value = t.day == today ? t.value : (t.history[today] ?? 0)
    }
    value = apply(kind, value: 0, op: "set", amount: value) // clamp whatever was stored
    for e in pending(readLog(), mark) where e.kind == kind {
      let day = dayKey(Date(timeIntervalSince1970: TimeInterval(e.at) / 1000), offsetMinutes: e.off)
      if day == today { value = apply(kind, value: value, op: e.op, amount: e.amount) }
    }
    return value
  }

  /// One tap's step: the app's tracker step, else the default (+150 ml, +1 h, +500 steps).
  static func step(_ kind: HabitKindID) -> Double {
    readTrackers().trackers[kind]?.step ?? HabitDef.of(kind).step
  }

  static func goal(_ kind: HabitKindID) -> Double? {
    let def = HabitDef.of(kind)
    guard def.mode == .count else { return nil }
    return readTrackers().trackers[kind]?.goal ?? def.goal
  }

  // MARK: Writing (button taps)

  /// Append one tap to the log. `direction` +1 / -1 for count and mood steps; `setTo` picks a mood face.
  @discardableResult
  static func record(_ kind: HabitKindID, direction: Int = 1, setTo: Double? = nil, now: Date = Date()) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard let defaults = defaults else { return false }
    let def = HabitDef.of(kind)
    let (trackers, mark) = readTrackers()
    let op: String
    var amount: Double
    if let v = setTo {
      op = "set"
      amount = apply(kind, value: 0, op: "set", amount: v)
    } else {
      op = "add"
      let size = def.mode == .scale ? 1 : min(def.max, trackers[kind]?.step ?? def.step)
      amount = direction >= 0 ? size : -size
      if amount == 0 { return false }
    }
    amount = round2(amount)
    var log = readLog() ?? Log(logId: UUID().uuidString, seq: 0, events: [])
    let seq = log.seq + 1
    let off = offsetMinutes(at: now)
    let at = Int64((now.timeIntervalSince1970 * 1000).rounded())
    log.events.append(Event(seq: seq, kind: kind, op: op, amount: amount, at: at, off: abs(off) <= maxOffsetMinutes ? off : 0))
    log.seq = seq
    // Prune: what the app already applied, anything older than the history window, then the oldest.
    let done = (mark?.logId == log.logId) ? (mark?.seq ?? 0) : 0
    let cutoff = at - Int64(historyDays + 1) * 86_400_000
    var kept = log.events.filter { $0.seq > done && $0.at >= cutoff }
    if kept.count > maxEvents { kept = Array(kept.suffix(maxEvents)) }
    log.events = kept

    let json: [String: Any] = [
      "v": 1,
      "logId": log.logId,
      "seq": log.seq,
      "events": log.events.map { e -> [String: Any] in
        ["seq": e.seq, "kind": e.kind.rawValue, "op": e.op, "amount": e.amount, "at": NSNumber(value: e.at), "off": e.off]
      },
    ]
    guard
      let data = try? JSONSerialization.data(withJSONObject: json),
      let text = String(data: data, encoding: .utf8)
    else { return false }
    defaults.set(text, forKey: logKey)
    return true
  }

  // MARK: Formatting

  static func format(_ value: Double, decimals: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.minimumFractionDigits = 0
    f.maximumFractionDigits = decimals
    return f.string(from: NSNumber(value: value)) ?? String(value)
  }
}
