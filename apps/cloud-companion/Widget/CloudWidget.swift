import SwiftUI
import WidgetKit
import AppIntents

struct RefreshCloudWeather: AppIntent {
    static var title: LocalizedStringResource = "Refresh cloud weather"
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        let store = SkyStore.shared
        if let place = store.preferences.place {
            let forecast = try await WeatherClient().fetch(for: place)
            store.save(forecast)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "CloudCompanionWeather")
        return .result()
    }
}

struct CloudEntry: TimelineEntry {
    var date: Date
    var moment: SkyMoment
    var preferences: Preferences
}

struct CloudProvider: TimelineProvider {
    func placeholder(in context: Context) -> CloudEntry {
        let now = Date()
        return CloudEntry(date: now, moment: SkyMoment(date: now, forecast: nil, hour: nil, freshness: nil),
                          preferences: Preferences())
    }
    func getSnapshot(in context: Context, completion: @escaping (CloudEntry) -> Void) {
        let store = SkyStore.shared
        let prefs = store.preferences
        let now = Date()
        let cached = prefs.place.flatMap { store.cached(for: $0) }
        let entry = TimelinePolicy.entries(forecast: cached, place: prefs.place, now: now)[0]
        completion(CloudEntry(date: now, moment: entry, preferences: prefs))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<CloudEntry>) -> Void) {
        // This code runs in the extension's process, even if the app has not been opened.
        Task {
            let store = SkyStore.shared
            let initial = store.preferences
            var forecast = initial.place.flatMap { store.cached(for: $0) }
            var failed = false
            if let place = initial.place, forecast == nil || Date().timeIntervalSince(forecast!.fetchedAt) >= 15 * 60 {
                do {
                    let updated = try await WeatherClient().fetch(for: place)
                    store.save(updated)
                    forecast = updated
                } catch { failed = true }
            }
            let latest = store.preferences
            if latest.place != initial.place {
                forecast = latest.place.flatMap { store.cached(for: $0) }
            }
            let now = Date()
            let entries = TimelinePolicy.entries(forecast: forecast, place: latest.place, now: now)
                .map { CloudEntry(date: $0.date, moment: $0, preferences: latest) }
            completion(Timeline(entries: entries, policy: .after(TimelinePolicy.refreshDate(now: now, failed: failed))))
        }
    }
}

struct CloudWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: CloudEntry
    var body: some View {
        WidgetCard(moment: entry.moment, place: entry.preferences.place, unit: entry.preferences.unit, medium: family == .systemMedium,
                   refreshAction: entry.preferences.place == nil ? nil : AnyView(Button(intent: RefreshCloudWeather()) {
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
        StaticConfiguration(kind: kind, provider: CloudProvider()) { CloudWidgetView(entry: $0) }
            .configurationDisplayName("Your little sky")
            .description("A cloud companion and the weather for your saved city.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
