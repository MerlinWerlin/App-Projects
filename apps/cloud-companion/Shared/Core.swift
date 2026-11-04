import Foundation

enum CloudMood: String, Codable, CaseIterable {
    case sunny, cloudy, rainy, stormy, snowy, misty, windy, sleepy

    static func resolve(symbol: String, daylight: Bool) -> Self {
        // Hazardous weather takes precedence over the bedtime appearance.
        if symbol.contains("bolt") { return .stormy }
        if symbol.contains("snow") || symbol.contains("sleet") || symbol.contains("hail") { return .snowy }
        if symbol.contains("rain") || symbol.contains("drizzle") { return .rainy }
        if symbol.contains("fog") || symbol.contains("haze") || symbol.contains("smoke") || symbol.contains("dust") { return .misty }
        if symbol.contains("wind") || symbol.contains("tornado") || symbol.contains("hurricane") { return .windy }
        if !daylight { return .sleepy }
        return symbol.contains("cloud") ? .cloudy : .sunny
    }

    var greeting: String {
        switch self {
        case .sunny: return "A little sunshine for you."
        case .cloudy: return "I've got the sky covered."
        case .rainy: return "A good day for an umbrella."
        case .stormy: return "I'm feeling a little thunderous."
        case .snowy: return "Bundle up, little human."
        case .misty: return "The world is a little soft today."
        case .windy: return "Hold on to your hat."
        case .sleepy: return "Your sky is winding down."
        }
    }
}

struct Place: Codable, Equatable, Identifiable {
    var name: String
    var latitude: Double
    var longitude: Double
    var timeZoneIdentifier: String = TimeZone.current.identifier
    var id: String { "\(latitude),\(longitude)" }
    var isValid: Bool { latitude.isFinite && longitude.isFinite && (-90...90).contains(latitude) && (-180...180).contains(longitude) }
    func timeLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.timeZone = TimeZone(identifier: timeZoneIdentifier) ?? .current
        return formatter.string(from: date)
    }
    static let sydney = Place(name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZoneIdentifier: "Australia/Sydney")
    static let suggestions = [sydney,
        Place(name: "Melbourne", latitude: -37.8136, longitude: 144.9631, timeZoneIdentifier: "Australia/Melbourne"),
        Place(name: "Tokyo", latitude: 35.6762, longitude: 139.6503, timeZoneIdentifier: "Asia/Tokyo"),
        Place(name: "London", latitude: 51.5072, longitude: -0.1276, timeZoneIdentifier: "Europe/London"),
        Place(name: "New York", latitude: 40.7128, longitude: -74.006, timeZoneIdentifier: "America/New_York")]
}

enum TemperatureUnit: String, Codable, CaseIterable {
    case celsius, fahrenheit
    var label: String { self == .celsius ? "°C" : "°F" }
    func display(_ celsius: Double) -> String {
        let value = self == .celsius ? celsius : celsius * 9 / 5 + 32
        return "\(Int(value.rounded()))°"
    }
}

struct ForecastHour: Codable, Equatable, Identifiable {
    var date: Date
    var temperatureC: Double
    var rainChance: Double
    var symbol: String
    var daylight: Bool
    var id: Date { date }
    var mood: CloudMood { .resolve(symbol: symbol, daylight: daylight) }
}

struct Forecast: Codable, Equatable {
    var place: Place
    var fetchedAt: Date
    var observedAt: Date
    var temperatureC: Double
    var feelsLikeC: Double
    var highC: Double?
    var lowC: Double?
    var condition: String
    var symbol: String
    var daylight: Bool
    var hours: [ForecastHour]
    var attributionURL: URL
    var attributionMark: Data? = nil

    var mood: CloudMood { .resolve(symbol: symbol, daylight: daylight) }
    var isValid: Bool {
        place.isValid && temperatureC.isFinite && feelsLikeC.isFinite &&
        (highC?.isFinite ?? true) && (lowC?.isFinite ?? true) &&
        fetchedAt.timeIntervalSince1970.isFinite && observedAt.timeIntervalSince1970.isFinite &&
        attributionURL.scheme == "https" && zip(hours, hours.dropFirst()).allSatisfy { $0.date < $1.date } && hours.allSatisfy {
            $0.temperatureC.isFinite && $0.rainChance.isFinite && (0...1).contains($0.rainChance)
        }
    }

    func rainNote(at date: Date) -> String {
        guard let rain = hours.first(where: { $0.date >= date && $0.date < date.addingTimeInterval(6 * 3600) && $0.rainChance >= 0.4 }) else {
            return "Your next few hours, at a glance."
        }
        return "\(Int((rain.rainChance * 100).rounded()))% rain chance · \(place.timeLabel(rain.date))"
    }

    static func demo(at date: Date = Date()) -> Self {
        let start = Calendar.current.dateInterval(of: .hour, for: date)!.start
        return Forecast(place: .sydney, fetchedAt: date, observedAt: date,
            temperatureC: 23, feelsLikeC: 24, highC: 25, lowC: 17,
            condition: "Partly cloudy", symbol: "cloud.sun.fill", daylight: true,
            hours: (1...8).map { n in ForecastHour(date: start.addingTimeInterval(Double(n) * 3600),
                temperatureC: Double(25 - n), rainChance: n >= 4 ? 0.6 : 0.1,
                symbol: n >= 4 ? "cloud.rain.fill" : "cloud.sun.fill", daylight: n < 7) },
            attributionURL: URL(string: "https://weatherkit.apple.com/legal-attribution.html")!)
    }
}

enum Freshness: Equatable {
    case fresh, cached, expired
    static func evaluate(_ forecast: Forecast, at date: Date) -> Self {
        let fetchAge = date.timeIntervalSince(forecast.fetchedAt)
        let observationAge = date.timeIntervalSince(forecast.observedAt)
        // A bad device clock or very old observation must never appear current.
        guard fetchAge >= -300, observationAge >= -300 else { return .expired }
        let age = max(fetchAge, observationAge)
        if age >= 24 * 3600 { return .expired }
        return age >= 90 * 60 ? .cached : .fresh
    }
}

struct SkyMoment: Equatable {
    var date: Date
    var forecast: Forecast?
    var hour: ForecastHour?
    var freshness: Freshness?
    var isPrediction: Bool { hour != nil }
    var mood: CloudMood { hour?.mood ?? forecast?.mood ?? .cloudy }
    var temperatureC: Double? { hour?.temperatureC ?? forecast?.temperatureC }
}

enum TimelinePolicy {
    static func entries(forecast: Forecast?, place: Place?, now: Date) -> [SkyMoment] {
        guard let forecast, forecast.isValid, forecast.place == place,
              Freshness.evaluate(forecast, at: now) != .expired else {
            return [SkyMoment(date: now, forecast: nil, hour: nil, freshness: nil)]
        }
        // Even after refresh fails, advance to explicitly labelled predictions.
        let currentHour = forecast.hours.last { $0.date > forecast.fetchedAt && $0.date <= now && now.timeIntervalSince($0.date) < 3600 }
        let current = SkyMoment(date: now, forecast: forecast, hour: currentHour,
                                freshness: Freshness.evaluate(forecast, at: now))
        let future = forecast.hours.filter { $0.date > now && $0.date <= now.addingTimeInterval(6 * 3600) }
            .map { SkyMoment(date: $0.date, forecast: forecast, hour: $0, freshness: Freshness.evaluate(forecast, at: $0.date)) }
        // Once the forecast's cache expires, explicitly clear all old temperatures.
        let expires = min(forecast.fetchedAt, forecast.observedAt).addingTimeInterval(24 * 3600)
        return ([current] + future.filter { $0.date < expires } + [SkyMoment(date: expires, forecast: nil, hour: nil, freshness: nil)])
            .sorted { $0.date < $1.date }
    }

    static func refreshDate(now: Date, failed: Bool) -> Date {
        now.addingTimeInterval(failed ? 60 * 60 : 30 * 60)
    }
}

struct Preferences: Codable, Equatable {
    var place: Place?
    var unit: TemperatureUnit = .celsius
}

final class SkyStore {
    static let group = "group.com.jared797.cloudcompanion"
    private let defaults: UserDefaults
    init(defaults: UserDefaults) { self.defaults = defaults }
    static var shared: SkyStore { SkyStore(defaults: UserDefaults(suiteName: group) ?? .standard) }
    var preferences: Preferences {
        get { decode(Preferences.self, key: "preferences.v1") ?? Preferences() }
        set { encode(newValue, key: "preferences.v1") }
    }
    func cached(for place: Place) -> Forecast? {
        guard let data = decode(Forecast.self, key: "forecast.v1"), data.place == place, data.isValid else { return nil }
        return data
    }
    func save(_ forecast: Forecast) {
        // A late response for a previously selected city cannot replace the active cache.
        guard forecast.isValid, preferences.place == forecast.place else { return }
        if let existing = cached(for: forecast.place), existing.fetchedAt > forecast.fetchedAt { return }
        encode(forecast, key: "forecast.v1")
    }
    private func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    private func encode<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}
