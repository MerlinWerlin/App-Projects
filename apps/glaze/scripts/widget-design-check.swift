import Foundation

@main struct WidgetDesignCheck {
  static func main() throws {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let payload = SavedWidgetPayload(data: data)!
    let dots = payload.design(kind: "monthProgress", size: "small", activeThemeID: payload.themeID)!
    precondition(dots.background["kind"] as? String == "gradient")
    precondition(dots.background["from"] as? String == "#AABBCC")
    precondition(dots.regions.contains { $0["role"] as? String == "dots" })
    let quote = payload.design(kind: "quote", size: "small", activeThemeID: payload.themeID)!
    precondition(quote.background["from"] as? String == "#112233")
    precondition(quote.texts.values.contains("Keep my words"))
    precondition(payload.design(kind: "monthProgress", size: "small", activeThemeID: "another-theme") == nil)
    precondition(payload.design(kind: "monthProgress", size: "large", activeThemeID: payload.themeID) == nil)
    precondition(SavedWidgetPayload(data: Data("{\"v\":3}".utf8)) == nil)
    precondition(SavedWidgetPayload(data: Data("broken".utf8)) == nil)
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Australia/Sydney")!
    for (year, month, day, total) in [(2024,2,29,29), (2026,2,1,28), (2026,10,26,31), (2026,11,30,30)] {
      let date = cal.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
      let p = WidgetPeriod.at(date, year: false, calendar: cal)
      precondition(p.total == total && p.day == day && p.fraction == Double(day) / Double(total))
    }
    print("Swift editor-payload contract and calendar cases passed")
  }
}
