import SwiftUI
import WidgetKit

enum ThemeGalleryKind: String {
  case clock, battery, calendar

  var widgetID: String {
    switch self {
    case .clock: return "GlazeThemeClock"
    case .battery: return "GlazeThemeBattery"
    case .calendar: return "GlazeThemeCalendar"
    }
  }

  var title: LocalizedStringKey {
    switch self {
    case .clock: return "Theme Clock"
    case .battery: return "Battery"
    case .calendar: return "Calendar"
    }
  }

  var schedule: LiveArtSpec.Kind {
    switch self {
    case .clock: return .clock
    case .battery: return .battery
    case .calendar: return .date
    }
  }
}

private struct ThemeGalleryEntry: TimelineEntry {
  let date: Date
  let design: DesignedWidgetSpec
  var preview = false
}

private struct ThemeGalleryProvider: TimelineProvider {
  let kind: ThemeGalleryKind

  func placeholder(in context: Context) -> ThemeGalleryEntry {
    ThemeGalleryEntry(date: Date(), design: ThemeStore.loadGalleryDesign(kind: kind.rawValue), preview: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (ThemeGalleryEntry) -> Void) {
    completion(ThemeGalleryEntry(date: Date(), design: ThemeStore.loadGalleryDesign(kind: kind.rawValue), preview: context.isPreview))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ThemeGalleryEntry>) -> Void) {
    let design = ThemeStore.loadGalleryDesign(kind: kind.rawValue)
    let plan = LiveArtSchedule.plan(kind: kind.schedule, from: Date())
    completion(Timeline(entries: plan.dates.map { ThemeGalleryEntry(date: $0, design: design) }, policy: plan.policy))
  }
}

struct ThemeGalleryWidget: Widget {
  let kind: ThemeGalleryKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind.widgetID, provider: ThemeGalleryProvider(kind: kind)) { entry in
      DesignedWidgetContent(spec: entry.design, date: entry.date,
        readings: entry.preview ? .snapshot(focus: .idle, battery: 75) : .device)
        .containerBackground(for: .widget) {
          LinearGradient(colors: entry.design.background.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        .widgetURL(URL(string: "glaze://widgets"))
    }
    .configurationDisplayName(kind.title)
    .description("Matches the theme you choose in Glaze.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

extension WidgetConfiguration {
  /// Keep legacy Home Screen registrations and configurations. WidgetKit puts these in Other.
  @MainActor func legacyGlazeGallery() -> some WidgetConfiguration {
    disfavoredLocations([.homeScreen], for: [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
  }
}
