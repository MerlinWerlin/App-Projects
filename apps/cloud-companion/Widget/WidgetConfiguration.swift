import AppIntents
import MapKit

struct CloudCity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "City"
    static var defaultQuery = CloudCityQuery()
    var place: Place
    var id: String { place.widgetIdentifier }
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(place.name)") }
}

struct CloudCityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [CloudCity] {
        identifiers.compactMap { Place.from(widgetIdentifier: $0).map { CloudCity(place: $0) } }
    }
    func suggestedEntities() async throws -> [CloudCity] { Place.suggestions.map { CloudCity(place: $0) } }
    func defaultResult() async -> CloudCity? { CloudCity(place: .sydney) }
    func entities(matching string: String) async throws -> [CloudCity] {
        let query = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty { return try await suggestedEntities() }
        let request = MKLocalSearch.Request(); request.naturalLanguageQuery = query; request.resultTypes = .address
        let response = try await MKLocalSearch(request: request).start()
        var seen = Set<String>()
        return response.mapItems.compactMap { item in
            let name = [item.placemark.locality ?? item.name, item.placemark.country].compactMap { $0 }.joined(separator: ", ")
            let place = Place(name: name, latitude: item.placemark.coordinate.latitude,
                              longitude: item.placemark.coordinate.longitude,
                              timeZoneIdentifier: item.placemark.timeZone?.identifier ?? TimeZone.current.identifier)
            return place.isValid && seen.insert(place.id).inserted ? CloudCity(place: place) : nil
        }
    }
}

enum WidgetTemperature: String, AppEnum {
    case celsius, fahrenheit
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Temperature"
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [.celsius: "Celsius", .fahrenheit: "Fahrenheit"]
    var unit: TemperatureUnit { self == .celsius ? .celsius : .fahrenheit }
}

struct CloudWidgetSettings: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Cloud weather settings"
    static var description = IntentDescription("Choose a city and temperature unit for this widget.")
    @Parameter(title: "City") var city: CloudCity?
    @Parameter(title: "Temperature", default: .celsius) var unit: WidgetTemperature
}
