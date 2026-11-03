// The same v2 payload the editor writes. Foundation-only so its real decoder is testable off-device.
import Foundation

struct SavedWidgetDesign {
  let raw: [String: Any]
  let texts: [String: String]
  var kind: String { raw["kind"] as? String ?? "" }
  var regions: [[String: Any]] { raw["regions"] as? [[String: Any]] ?? [] }
  var width: Double { max(1, raw["width"] as? Double ?? 170) }
  var height: Double { max(1, raw["height"] as? Double ?? 170) }
  var background: [String: Any] { raw["background"] as? [String: Any] ?? [:] }
  var accent: String { raw["accent"] as? String ?? "#7A2E6B" }
  var textColour: String { regions.first(where: { $0["role"] as? String == "text" })?["colour"] as? String ?? "#1E1A1D" }
}

struct SavedWidgetPayload {
  let themeID: String
  let specs: [[String: Any]]
  let texts: [String: [String: String]]

  init?(data: Data) {
    guard data.count < 512 * 1024,
          let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          root["v"] as? Int == 2,
          let theme = root["theme"] as? [String: Any], let id = theme["themeId"] as? String,
          let base = root["specs"] as? [[String: Any]] else { return nil }
    themeID = id
    let catalogue = root["catalogue"] as? [String: Any] ?? [:]
    specs = base + (catalogue["specs"] as? [[String: Any]] ?? [])
    texts = (root["texts"] as? [String: [String: String]] ?? [:]).merging(
      catalogue["texts"] as? [String: [String: String]] ?? [:], uniquingKeysWith: { _, newer in newer })
  }

  func design(kind: String, size: String, activeThemeID: String) -> SavedWidgetDesign? {
    // A saved design from an old theme must never override the newly applied theme.
    guard themeID == activeThemeID,
          let spec = specs.first(where: { $0["kind"] as? String == kind && $0["size"] as? String == size }),
          let id = spec["id"] as? String,
          let regions = spec["regions"] as? [[String: Any]], regions.count <= 100 else { return nil }
    return SavedWidgetDesign(raw: spec, texts: texts[id] ?? [:])
  }
}

struct WidgetPeriod {
  let day: Int
  let total: Int
  // Matches calendarMaths.ts: includes today, with the current day highlighted separately.
  var completed: Int { day }
  var fraction: Double { Double(completed) / Double(max(1, total)) }
  static func at(_ date: Date, year: Bool, calendar: Calendar = .current) -> WidgetPeriod {
    let component: Calendar.Component = year ? .year : .month
    return WidgetPeriod(day: calendar.ordinality(of: .day, in: component, for: date) ?? 1,
                        total: calendar.range(of: .day, in: component, for: date)?.count ?? (year ? 365 : 31))
  }
}

/// A stored YYYY-MM-DD is a Gregorian civil day, even when the user displays another calendar.
/// Parse in the widget's time zone, not UTC; count calendar days rather than 24-hour intervals.
enum WidgetDay {
  static func parse(_ raw: String, timeZone: TimeZone = .current) -> Date? {
    guard raw.utf8.count == 10, raw.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil else { return nil }
    let parts = raw.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3, parts[0] >= 1, (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timeZone
    guard let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return nil }
    let back = calendar.dateComponents([.year, .month, .day], from: date)
    guard back.year == parts[0], back.month == parts[1], back.day == parts[2] else { return nil }
    return calendar.startOfDay(for: date)
  }

  static func remaining(to raw: String, from date: Date, calendar: Calendar = .current) -> Int? {
    distance(to: raw, from: date, calendar: calendar).map { max(0, $0) }
  }

  static func distance(to raw: String, from date: Date, calendar: Calendar = .current) -> Int? {
    guard let target = parse(raw, timeZone: calendar.timeZone) else { return nil }
    return calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: target)).day
  }
}
