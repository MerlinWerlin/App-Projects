import Foundation
import CoreLocation
import WeatherKit
import UIKit

struct WeatherClient {
    func fetch(for place: Place) async throws -> Forecast {
        guard place.isValid else { throw URLError(.badURL) }
        let location = CLLocation(latitude: place.latitude, longitude: place.longitude)
        let service = WeatherService.shared
        let (current, hourly, daily) = try await service.weather(for: location, including: .current, .hourly, .daily)
        let attribution = try await service.attribution
        let now = Date()
        let today = daily.forecast.first
        var forecast = Forecast(place: place, fetchedAt: now, observedAt: current.date,
            temperatureC: current.temperature.converted(to: .celsius).value,
            feelsLikeC: current.apparentTemperature.converted(to: .celsius).value,
            highC: today?.highTemperature.converted(to: .celsius).value,
            lowC: today?.lowTemperature.converted(to: .celsius).value,
            condition: current.condition.description, symbol: current.symbolName, daylight: current.isDaylight,
            hours: hourly.forecast.filter { $0.date >= now.addingTimeInterval(-3600) }.prefix(12).map {
                ForecastHour(date: $0.date, temperatureC: $0.temperature.converted(to: .celsius).value,
                             rainChance: $0.precipitationChance, symbol: $0.symbolName, daylight: $0.isDaylight)
            }, attributionURL: attribution.legalPageURL)
        // Cache Apple's official attribution artwork so the widget can render it offline.
        var request = URLRequest(url: attribution.combinedMarkDarkURL)
        request.timeoutInterval = 8
        if let (data, response) = try? await URLSession.shared.data(for: request),
           (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 256_000, UIImage(data: data) != nil {
            forecast.attributionMark = data
        }
        guard forecast.isValid else { throw URLError(.cannotParseResponse) }
        return forecast
    }
}
