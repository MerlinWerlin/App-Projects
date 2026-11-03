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
    var countdownChecks = 0
    func verify(_ ok: Bool) { precondition(ok); countdownChecks += 1 }
    for invalid in ["2026-02-29","2026-04-31","0000-01-01","2026--11-02","2026-11-02\n","2026-1-02","2026-11-00","2026-13-01"] {
      verify(WidgetDay.parse(invalid) == nil)
    }
    verify(WidgetDay.parse("2024-02-29") != nil)
    for (zone, target, year, month, day, expected, interval) in [
      ("America/New_York","2026-03-09",2026,3,7,2,47),
      ("America/New_York","2026-11-02",2026,11,1,1,25),
      ("Australia/Sydney","2026-10-05",2026,10,4,1,23),
      ("Australia/Sydney","2026-04-06",2026,4,5,1,25),
      ("Pacific/Kiritimati","2026-11-02",2026,11,1,1,24)
    ] {
      var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: zone)!
      let begin = c.date(from: DateComponents(year: year,month: month,day: day))!
      let end = WidgetDay.parse(target,timeZone: c.timeZone)!
      verify(end.timeIntervalSince(begin) == Double(interval * 3600))
      verify(WidgetDay.distance(to: target,from: begin,calendar: c) == expected)
      var buddhist = Calendar(identifier: .buddhist); buddhist.timeZone = c.timeZone
      verify(WidgetDay.distance(to: target,from: begin,calendar: buddhist) == expected)
      verify(WidgetDay.distance(to: target,from: end.addingTimeInterval(12*3600),calendar: c) == 0)
    }
    print("Swift editor-payload/calendar contract plus \(countdownChecks) strict civil-day, alternate-calendar and DST assertions passed")
  }
}
