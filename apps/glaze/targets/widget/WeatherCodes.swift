// owner-1102b T281: WMO weather codes to SF Symbols and the Open-Meteo request.
// Mirrors src/core/weatherCodes.ts row for row (src/core/weatherCodes.test.ts checks it).
import Foundation

enum GlazeWeatherCodes {
  /// (WMO code, day symbol, night symbol).
  static let table: [(Int, String, String)] = [
    (0, "sun.max.fill", "moon.stars.fill"),
    (1, "sun.max.fill", "moon.stars.fill"),
    (2, "cloud.sun.fill", "cloud.moon.fill"),
    (3, "cloud.fill", "cloud.fill"),
    (45, "cloud.fog.fill", "cloud.fog.fill"),
    (48, "cloud.fog.fill", "cloud.fog.fill"),
    (51, "cloud.drizzle.fill", "cloud.drizzle.fill"),
    (53, "cloud.drizzle.fill", "cloud.drizzle.fill"),
    (55, "cloud.drizzle.fill", "cloud.drizzle.fill"),
    (56, "cloud.sleet.fill", "cloud.sleet.fill"),
    (57, "cloud.sleet.fill", "cloud.sleet.fill"),
    (61, "cloud.rain.fill", "cloud.rain.fill"),
    (63, "cloud.rain.fill", "cloud.rain.fill"),
    (65, "cloud.heavyrain.fill", "cloud.heavyrain.fill"),
    (66, "cloud.sleet.fill", "cloud.sleet.fill"),
    (67, "cloud.sleet.fill", "cloud.sleet.fill"),
    (71, "cloud.snow.fill", "cloud.snow.fill"),
    (73, "cloud.snow.fill", "cloud.snow.fill"),
    (75, "snowflake", "snowflake"),
    (77, "snowflake", "snowflake"),
    (80, "cloud.sun.rain.fill", "cloud.moon.rain.fill"),
    (81, "cloud.rain.fill", "cloud.rain.fill"),
    (82, "cloud.heavyrain.fill", "cloud.heavyrain.fill"),
    (85, "cloud.snow.fill", "cloud.snow.fill"),
    (86, "cloud.snow.fill", "cloud.snow.fill"),
    (95, "cloud.bolt.rain.fill", "cloud.bolt.rain.fill"),
    (96, "cloud.hail.fill", "cloud.hail.fill"),
    (99, "cloud.hail.fill", "cloud.hail.fill"),
  ]

  static let unknownSymbol = "cloud.fill"

  static func symbol(code: Int, isDay: Bool) -> String {
    guard let row = table.first(where: { $0.0 == code }) else { return unknownSymbol }
    return isDay ? row.1 : row.2
  }

  static let endpoint = "https://api.open-meteo.com/v1/forecast"
  static let query = "current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto&timeformat=unixtime"

  /// Same rounding as roundCoordinate in weatherCodes.ts: 2 decimals (about 1 km).
  static func rounded(_ value: Double) -> String {
    guard value.isFinite else { return "0.00" }
    let r = (value * 100).rounded() / 100
    return String(format: "%.2f", r == 0 ? 0 : r)
  }

  static func url(lat: Double, lon: Double, fahrenheit: Bool) -> URL? {
    let unit = fahrenheit ? "&temperature_unit=fahrenheit" : ""
    return URL(string: "\(endpoint)?latitude=\(rounded(lat))&longitude=\(rounded(lon))&\(query)\(unit)")
  }
}
