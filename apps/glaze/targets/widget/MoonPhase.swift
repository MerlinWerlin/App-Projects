// owner-1102b T277: moon phase maths shared by the Moon widget and the Lock Screen moon.
// Mirrors src/core/moonPhase.ts (same constants and buckets; moonPhase.test.ts checks them).
import Foundation

enum MoonPhaseName: String, CaseIterable {
  case new, waxingCrescent, firstQuarter, waxingGibbous, full, waningGibbous, lastQuarter, waningCrescent

  /// SF Symbol for the phase (all exist since iOS 14).
  var symbol: String {
    switch self {
    case .new: return "moonphase.new.moon"
    case .waxingCrescent: return "moonphase.waxing.crescent"
    case .firstQuarter: return "moonphase.first.quarter"
    case .waxingGibbous: return "moonphase.waxing.gibbous"
    case .full: return "moonphase.full.moon"
    case .waningGibbous: return "moonphase.waning.gibbous"
    case .lastQuarter: return "moonphase.last.quarter"
    case .waningCrescent: return "moonphase.waning.crescent"
    }
  }

  /// Localizable.strings key, e.g. "widgets.moon.full".
  var labelKey: String { "widgets.moon.\(rawValue)" }
}

struct MoonInfo {
  let age: Double
  let fraction: Double
  let illumination: Double
  let phase: MoonPhaseName
  var waxing: Bool { fraction < 0.5 }
}

enum MoonPhase {
  static let synodicDays = 29.530588853
  /// 2000-01-06 18:14 UTC, a new moon (Unix seconds).
  static let referenceNewMoon: TimeInterval = 947182440

  static func info(at date: Date) -> MoonInfo {
    let days = (date.timeIntervalSince1970 - referenceNewMoon) / 86_400
    var age = days.truncatingRemainder(dividingBy: synodicDays)
    if age < 0 { age += synodicDays }
    let fraction = age / synodicDays
    let illumination = (1 - cos(2 * Double.pi * fraction)) / 2
    let idx = Int(floor(fraction * 8 + 0.5)) % 8
    let phase = MoonPhaseName.allCases[idx]
    return MoonInfo(age: age, fraction: fraction, illumination: illumination, phase: phase)
  }

  static func daysToFull(at date: Date) -> Int {
    let age = info(at: date).age
    let half = synodicDays / 2
    let d = age <= half ? half - age : synodicDays - age + half
    return Int(d.rounded())
  }
}
