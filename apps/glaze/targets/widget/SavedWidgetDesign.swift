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
