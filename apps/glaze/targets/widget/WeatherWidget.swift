// owner-1102b T281: Weather from Open-Meteo (free, no key; data CC BY 4.0, credited in the widget and
// on Glaze's widget-access screen). Location: the extension declares NSWidgetWantsLocation and reads
// the last known location when iOS allows it for widgets (isAuthorizedForWidgetUpdates); otherwise
// it uses the rounded coordinates the app stored in the App Group after the user allowed location on
// the widget-access screen. Coordinates are rounded to 2 decimals (about 1 km) and sent ONLY to
// api.open-meteo.com (WeatherCodes.swift). No location yet: a themed "Open Glaze to set weather"
// state. The last good result is cached in the App Group; a new timeline every 45 minutes.
import CoreLocation
import SwiftUI
import WidgetKit

struct GlazeWeatherHour: Codable, Hashable {
  let time: Date
  let temp: Double
  let code: Int
}

struct GlazeWeatherReport: Codable {
  let temp: Double
  let code: Int
  let isDay: Bool
  let high: Double
  let low: Double
  let hourly: [GlazeWeatherHour]
  let fahrenheit: Bool
  let fetchedAt: Date
}

struct WeatherEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// nil: no location yet (the "Open Glaze" state).
  let report: GlazeWeatherReport?
}

/// Open-Meteo response fields we ask for (WeatherCodes.swift `query`).
private struct GlazeOpenMeteoResponse: Decodable {
  struct Current: Decodable {
    let temperature_2m: Double
    let weather_code: Int
    let is_day: Int?
  }
  struct Hourly: Decodable {
    let time: [Double]
    let temperature_2m: [Double?]
    let weather_code: [Int?]
  }
  struct Daily: Decodable {
    let temperature_2m_max: [Double?]
    let temperature_2m_min: [Double?]
  }
  let current: Current
  let hourly: Hourly?
  let daily: Daily?
}

enum GlazeWeatherStore {
  static let cacheKey = "glaze.weather.cache.v1"
  /// Written by the app (modules/glaze-widget-bridge requestLocationAccess): "lat,lon", 2 decimals.
  static let coordsKey = "glaze.weather.coords.v1"
  static let accessURL = URL(string: "glaze://widget-access?kind=weather")

  static var usesFahrenheit: Bool {
    Locale.current.measurementSystem == .us
  }

  static func cached() -> GlazeWeatherReport? {
    guard let data = UserDefaults(suiteName: GlazeShared.appGroup)?.data(forKey: cacheKey) else { return nil }
    return try? JSONDecoder().decode(GlazeWeatherReport.self, from: data)
  }

  static func save(_ report: GlazeWeatherReport) {
    guard let data = try? JSONEncoder().encode(report) else { return }
    UserDefaults(suiteName: GlazeShared.appGroup)?.set(data, forKey: cacheKey)
  }

  /// The widget's own location when iOS allows it, else the app's stored (rounded) coordinates.
  static func coordinates() -> (lat: Double, lon: Double)? {
    let manager = CLLocationManager()
    if manager.isAuthorizedForWidgetUpdates, let loc = manager.location {
      return (loc.coordinate.latitude, loc.coordinate.longitude)
    }
    guard let raw = UserDefaults(suiteName: GlazeShared.appGroup)?.string(forKey: coordsKey) else { return nil }
    let parts = raw.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    guard parts.count == 2, abs(parts[0]) <= 90, abs(parts[1]) <= 180 else { return nil }
    return (parts[0], parts[1])
  }

  static func fetch(lat: Double, lon: Double, completion: @escaping (GlazeWeatherReport?) -> Void) {
    let fahrenheit = usesFahrenheit
    guard let url = GlazeWeatherCodes.url(lat: lat, lon: lon, fahrenheit: fahrenheit) else {
      completion(nil)
      return
    }
    var request = URLRequest(url: url)
    request.timeoutInterval = 15
    URLSession.shared.dataTask(with: request) { data, response, _ in
      guard let data = data,
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(GlazeOpenMeteoResponse.self, from: data) else {
        completion(nil)
        return
      }
      completion(report(from: decoded, fahrenheit: fahrenheit, now: Date()))
    }.resume()
  }

  private static func report(from r: GlazeOpenMeteoResponse, fahrenheit: Bool, now: Date) -> GlazeWeatherReport {
    var hours: [GlazeWeatherHour] = []
    if let h = r.hourly {
      let n = min(h.time.count, h.temperature_2m.count, h.weather_code.count)
      for i in 0..<n {
        let t = Date(timeIntervalSince1970: h.time[i])
        guard t > now, let temp = h.temperature_2m[i], let code = h.weather_code[i] else { continue }
        hours.append(GlazeWeatherHour(time: t, temp: temp, code: code))
        if hours.count == 6 { break }
      }
    }
    let high = r.daily?.temperature_2m_max.first.flatMap { $0 } ?? r.current.temperature_2m
    let low = r.daily?.temperature_2m_min.first.flatMap { $0 } ?? r.current.temperature_2m
    return GlazeWeatherReport(
      temp: r.current.temperature_2m,
      code: r.current.weather_code,
      isDay: (r.current.is_day ?? 1) == 1,
      high: high,
      low: low,
      hourly: hours,
      fahrenheit: fahrenheit,
      fetchedAt: now
    )
  }

  /// Gallery / placeholder: sample weather in the theme.
  static func sample(now: Date) -> GlazeWeatherReport {
    let f = usesFahrenheit
    let base: Double = f ? 66 : 19
    let hours = (1...6).map { i in
      GlazeWeatherHour(time: now.addingTimeInterval(Double(i) * 3600), temp: base + Double(i % 3), code: i < 4 ? 2 : 1)
    }
    return GlazeWeatherReport(temp: base, code: 2, isDay: true, high: base + 4, low: base - 6, hourly: hours, fahrenheit: f, fetchedAt: now)
  }
}

struct WeatherProvider: TimelineProvider {
  func placeholder(in context: Context) -> WeatherEntry {
    WeatherEntry(date: Date(), theme: GallerySample.theme(3), report: GlazeWeatherStore.sample(now: Date()))
  }

  func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
    let now = Date()
    let report = context.isPreview ? nil : GlazeWeatherStore.cached()
    completion(WeatherEntry(date: now, theme: context.isPreview ? GallerySample.theme(3) : ThemeStore.load(), report: report ?? GlazeWeatherStore.sample(now: now)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
    let now = Date()
    let theme = ThemeStore.load()
    let next = now.addingTimeInterval(45 * 60)
    guard let coords = GlazeWeatherStore.coordinates() else {
      completion(Timeline(entries: [WeatherEntry(date: now, theme: theme, report: nil)], policy: .after(next)))
      return
    }
    GlazeWeatherStore.fetch(lat: coords.lat, lon: coords.lon) { fresh in
      if let fresh = fresh { GlazeWeatherStore.save(fresh) }
      // Offline / error: the last good result (any age; the "Updated" time tells how old it is).
      let report = fresh ?? GlazeWeatherStore.cached()
      // Failed with nothing cached: try again sooner.
      let policy: TimelineReloadPolicy = report == nil ? .after(now.addingTimeInterval(15 * 60)) : .after(next)
      completion(Timeline(entries: [WeatherEntry(date: now, theme: theme, report: report ?? GlazeWeatherStore.sample(now: now))], policy: policy))
    }
  }
}

// MARK: - Views

private func glazeDegrees(_ value: Double) -> String {
  "\(Int(value.rounded()))°"
}

struct WeatherWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: WeatherEntry

  var body: some View {
    let t = entry.theme
    Group {
      if let r = entry.report {
        switch family {
        case .systemSmall:
          WeatherNowBlock(report: r, theme: t, tempSize: 40)
        case .systemMedium:
          HStack(alignment: .top, spacing: 12) {
            WeatherNowBlock(report: r, theme: t, tempSize: 44)
            VStack(alignment: .trailing, spacing: 4) {
              Image(systemName: GlazeWeatherCodes.symbol(code: r.code, isDay: r.isDay))
                .symbolRenderingMode(.hierarchical)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(t.accentColor)
              Spacer(minLength: 0)
              WeatherFooter(report: r, theme: t)
            }
          }
        default:
          VStack(alignment: .leading, spacing: 14) {
            WeatherNowBlock(report: r, theme: t, tempSize: 56)
            if !r.hourly.isEmpty {
              Rectangle().fill(t.inkColor.opacity(0.15)).frame(height: 1)
              WeatherHourRow(hours: Array(r.hourly.prefix(6)), theme: t)
            }
            Spacer(minLength: 0)
            WeatherFooter(report: r, theme: t)
          }
        }
      } else {
        WeatherAccessNeededView(theme: t)
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(GlazeWeatherStore.accessURL)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

private struct WeatherNowBlock: View {
  @Environment(\.widgetFamily) private var family
  let report: GlazeWeatherReport
  let theme: WidgetTheme
  let tempSize: CGFloat

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if family == .systemSmall || family == .systemLarge {
        Image(systemName: GlazeWeatherCodes.symbol(code: report.code, isDay: report.isDay))
          .symbolRenderingMode(.hierarchical)
          .font(.system(size: 24, weight: .semibold))
          .foregroundStyle(theme.accentColor)
      } else {
        Text("Weather")
          .font(theme.typeface(size: 12, weight: .bold))
          .foregroundStyle(theme.inkColor.opacity(0.7))
      }
      Spacer(minLength: 0)
      Text(glazeDegrees(report.temp))
        .font(theme.typeface(size: tempSize, weight: .bold))
        .foregroundStyle(theme.inkColor)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text("H:\(glazeDegrees(report.high)) L:\(glazeDegrees(report.low))")
        .font(theme.typeface(size: 13, weight: .medium))
        .foregroundStyle(theme.inkColor.opacity(0.75))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct WeatherHourRow: View {
  let hours: [GlazeWeatherHour]
  let theme: WidgetTheme

  var body: some View {
    HStack(spacing: 0) {
      ForEach(hours, id: \.self) { h in
        VStack(spacing: 6) {
          Text(h.time, format: .dateTime.hour())
            .font(theme.typeface(size: 11, weight: .medium))
            .foregroundStyle(theme.inkColor.opacity(0.7))
          Image(systemName: GlazeWeatherCodes.symbol(code: h.code, isDay: true))
            .symbolRenderingMode(.hierarchical)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(theme.accentColor)
            .frame(height: 22)
          Text(glazeDegrees(h.temp))
            .font(theme.typeface(size: 14, weight: .semibold))
            .foregroundStyle(theme.inkColor)
        }
        .frame(maxWidth: .infinity)
      }
    }
  }
}

/// "Updated 14:05" and the CC BY 4.0 credit (required by Open-Meteo).
private struct WeatherFooter: View {
  let report: GlazeWeatherReport
  let theme: WidgetTheme

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      Text("Updated \(report.fetchedAt.formatted(date: .omitted, time: .shortened))")
        .font(theme.typeface(size: 10, weight: .medium))
        .foregroundStyle(theme.inkColor.opacity(0.6))
        .lineLimit(1)
      Text("Weather data by Open-Meteo.com")
        .font(theme.typeface(size: 9, weight: .regular))
        .foregroundStyle(theme.inkColor.opacity(0.55))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
  }
}

private struct WeatherAccessNeededView: View {
  let theme: WidgetTheme

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: "location.circle.fill")
        .symbolRenderingMode(.hierarchical)
        .font(.system(size: 24, weight: .semibold))
        .foregroundStyle(theme.accentColor)
      Spacer(minLength: 0)
      Text("Open Glaze to set weather")
        .font(theme.typeface(size: 15, weight: .semibold))
        .foregroundStyle(theme.inkColor)
        .lineLimit(3)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct WeatherWidget: Widget {
  let kind = "GlazeWeather"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
      WeatherWidgetView(entry: entry)
    }
    .configurationDisplayName("Weather")
    .description("The weather where you are, in your Glaze theme.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .legacyGlazeGallery()
  }
}
