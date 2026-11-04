// owner-1102b T278: the Word clock phrase ("IT'S HALF PAST TEN"). Mirrors src/core/wordClock.ts:
// the two word tables are copied verbatim and src/core/wordClock.test.ts checks they stay identical
// (and that the rounding and next-hour rules below match the TS that the fixture table pins).
import Foundation

enum WordClock {
  /// Hour words, index = hour % 12 (0 is TWELVE).
  static let hours: [String] = ["TWELVE", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN"]

  /// Minute words, index = rounded minute / 5. 0 goes after the hour; 1-6 say PAST; 7-11 say TO.
  static let minutes: [String] = ["O'CLOCK", "FIVE PAST", "TEN PAST", "QUARTER PAST", "TWENTY PAST", "TWENTY-FIVE PAST", "HALF PAST", "TWENTY-FIVE TO", "TWENTY TO", "QUARTER TO", "TEN TO", "FIVE TO"]

  static let lead = "IT'S"

  /// Display lines for an hour (0-23) and minute (0-59).
  static func lines(hour: Int, minute: Int) -> [String] {
    let m = min(59, max(0, minute))
    var step = (m + 2) / 5
    var base = ((hour % 24) + 24) % 24
    if step == 12 {
      step = 0
      base += 1
    }
    let shown = step >= 7 ? base + 1 : base
    let hourWord = hours[shown % 12]
    if step == 0 { return [lead, hourWord, minutes[0]] }
    return [lead, minutes[step], hourWord]
  }

  static func lines(at date: Date, calendar: Calendar = .current) -> [String] {
    let c = calendar.dateComponents([.hour, .minute], from: date)
    return lines(hour: c.hour ?? 0, minute: c.minute ?? 0)
  }

  static func text(hour: Int, minute: Int) -> String {
    lines(hour: hour, minute: minute).joined(separator: " ")
  }

  /// English only; any other language shows the big digital time instead (wordClockSupported in TS).
  static var supported: Bool {
    let tag = Bundle.main.preferredLocalizations.first ?? Locale.preferredLanguages.first ?? "en"
    return supports(languageTag: tag)
  }

  static func supports(languageTag: String) -> Bool {
    let t = languageTag.trimmingCharacters(in: .whitespaces).lowercased()
    return t == "en" || t.hasPrefix("en-") || t.hasPrefix("en_")
  }
}
