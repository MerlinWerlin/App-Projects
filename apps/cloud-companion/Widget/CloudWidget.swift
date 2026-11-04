import SwiftUI
import WidgetKit
import AppIntents

struct RefreshCloudWeather: AppIntent {
    static var title: LocalizedStringResource = "Refresh cloud weather"
    static var openAppWhenRun = false
    @Parameter(title: "City") var city: CloudCity?
    init() {}
    init(place: Place) { city = CloudCity(place: place) }
    func perform() async throws -> some IntentResult {
        let store = SkyStore.shared
        let place = city?.place ?? .sydney
        let forecast = try await WeatherClient().fetch(for: place)
        store.save(forecast, requireSelectedPlace: false)
        WidgetCenter.shared.reloadTimelines(ofKind: "CloudCompanionWeather")
        return .result()
    }
}

struct CloudEntry: TimelineEntry {
    var date: Date
    var moment: SkyMoment
    var preferences: Preferences
}

struct CloudProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CloudEntry {
        let now = Date()
        return CloudEntry(date: now, moment: SkyMoment(date: now, forecast: nil, hour: nil, freshness: nil), preferences: Preferences(place: .sydney))
    }
    func snapshot(for configuration: CloudWidgetSettings, in context: Context) async -> CloudEntry {
        let place = configuration.city?.place ?? .sydney
        let now = Date()
        let cached = SkyStore.shared.cached(for: place)
        let moment = TimelinePolicy.entries(forecast: cached, place: place, now: now)[0]
        return CloudEntry(date: now, moment: moment, preferences: Preferences(place: place, unit: configuration.unit.unit))
    }
    func timeline(for configuration: CloudWidgetSettings, in context: Context) async -> Timeline<CloudEntry> {
        // Each widget owns its city/units and fetches directly in the extension.
        let place = configuration.city?.place ?? .sydney
        let store = SkyStore.shared
        var forecast = store.cached(for: place)
        var failed = false
        if forecast == nil || Date().timeIntervalSince(forecast!.fetchedAt) >= 15 * 60 {
            do {
                let updated = try await WeatherClient().fetch(for: place)
                store.save(updated, requireSelectedPlace: false)
                forecast = updated
            } catch { failed = true }
        }
        let now = Date()
        let preferences = Preferences(place: place, unit: configuration.unit.unit)
        let entries = TimelinePolicy.entries(forecast: forecast, place: place, now: now)
            .map { CloudEntry(date: $0.date, moment: $0, preferences: preferences) }
        return Timeline(entries: entries, policy: .after(TimelinePolicy.refreshDate(now: now, failed: failed)))
    }
}

struct CloudWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: CloudEntry
    var body: some View {
        WidgetCard(moment: entry.moment, place: entry.preferences.place, unit: entry.preferences.unit, medium: family == .systemMedium,
                   refreshAction: entry.preferences.place == nil ? nil : AnyView(Button(intent: RefreshCloudWeather(place: entry.preferences.place ?? .sydney)) {
                       Image(systemName: "arrow.clockwise").font(.system(size: 11, weight: .semibold)).frame(width: 28, height: 25)
                   }.buttonStyle(.plain).accessibilityLabel("Refresh weather without opening the app")))
            .containerBackground(SkyPalette.sky(entry.moment.mood), for: .widget)
            .widgetURL(URL(string: "cloudcompanion://weather"))
    }
}

@main
struct CloudWidget: Widget {
    let kind = "CloudCompanionWeather"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: CloudWidgetSettings.self, provider: CloudProvider()) { CloudWidgetView(entry: $0) }
            .configurationDisplayName("Your little sky")
            .description("A cloud companion with its own city and temperature settings.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
