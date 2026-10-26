import SwiftUI
import WidgetKit

/// Keep the existing installed widget kinds, with the editor's saved design taking precedence.
struct GlazeDesignedWidget<Fallback: View>: View {
  @Environment(\.widgetFamily) private var family
  let kind: String
  let entry: GlazeEntry
  @ViewBuilder let fallback: () -> Fallback
  var body: some View {
    if let design = ThemeStore.savedDesign(kind: kind, family: family, theme: entry.theme) {
      SavedWidgetView(design: design, date: entry.date)
    } else {
      fallback().padding(kind == "photo" ? 0 : 16)
    }
  }
}

struct CatalogueWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let kind: String
  let entry: GlazeEntry
  var body: some View {
    let design = ThemeStore.savedDesign(kind: kind, family: family, theme: entry.theme) ?? defaultDesign
    SavedWidgetView(design: design, date: entry.date)
  }

  private var defaultDesign: SavedWidgetDesign {
    let t = entry.theme
    let accessory = family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
    let foreground = accessory ? "#FFFFFF" : t.ink
    func text(_ id: String, _ source: String, _ frame: [Double], _ size: Double) -> [String: Any] {
      ["id": id, "role": "text", "colour": foreground,
       "frame": ["x": frame[0], "y": frame[1], "w": frame[2], "h": frame[3]],
       "text": ["source": source, "sizePt": size, "weight": "bold", "align": "start", "font": t.font.rawValue]]
    }
    var regions: [[String: Any]] = []
    if kind == "monthProgress" || kind == "yearProgress" {
      regions = [text("label", kind, [0.08, 0.04, 0.54, 0.16], 14), text("percent", "progressPercent", [0.65, 0.04, 0.30, 0.16], 14),
                 ["id": "dots", "role": "dots", "colour": foreground,
                  "frame": ["x": 0.08, "y": 0.26, "w": 0.84, "h": 0.65],
                  "dots": ["source": kind == "yearProgress" ? "year" : "month", "columns": kind == "yearProgress" ? 20 : 7, "track": t.surface, "today": t.accent]]]
      if accessory { regions = [text("percent", "progressPercent", [0.05, 0.1, 0.9, 0.8], 24)] }
    } else if kind == "analogClock" {
      regions = [["id": "dial", "role": "dial", "colour": foreground, "frame": ["x": 0.08, "y": 0.08, "w": 0.84, "h": 0.84]]]
    } else if kind == "monthCalendar" {
      regions = [text("month", "month", [0.08, 0.04, 0.84, 0.16], 18), text("grid", "monthGrid", [0.08, 0.24, 0.84, 0.70], 14)]
    } else {
      regions = [text("label", "text", [0.08, 0.08, 0.84, 0.2], 14), text("days", "countdown", [0.08, 0.35, 0.84, 0.5], 40)]
    }
    return SavedWidgetDesign(raw: ["kind": kind, "width": 170.0, "height": 170.0,
      "accent": t.accent, "regions": regions,
      "background": ["kind": "gradient", "from": t.backgroundHexes[0], "to": t.backgroundHexes[1], "angle": 135.0]],
      texts: ["label": String(localized: "Choose a date in Glaze")])
  }
}

struct MonthProgressWidget: Widget {
  let kind = "GlazeMonthProgress"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { CatalogueWidgetView(kind: "monthProgress", entry: $0) }
      .configurationDisplayName("Month progress").description("This month in dots and a percentage, in your chosen colours.")
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline]).contentMarginsDisabled()
  }
}
struct YearProgressWidget: Widget {
  let kind = "GlazeYearProgress"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { CatalogueWidgetView(kind: "yearProgress", entry: $0) }
      .configurationDisplayName("Year progress").description("The year in dots and a percentage.")
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]).contentMarginsDisabled()
  }
}
struct AnalogClockWidget: Widget {
  let kind = "GlazeAnalogClock"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { CatalogueWidgetView(kind: "analogClock", entry: $0) }
      .configurationDisplayName("Analog clock").description("Clock hands in your Glaze colours.")
      .supportedFamilies([.systemSmall, .systemLarge, .accessoryCircular]).contentMarginsDisabled()
  }
}
struct MonthCalendarWidget: Widget {
  let kind = "GlazeMonthCalendar"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { CatalogueWidgetView(kind: "monthCalendar", entry: $0) }
      .configurationDisplayName("Month calendar").description("The month with today highlighted.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge]).contentMarginsDisabled()
  }
}
struct CountdownWidget: Widget {
  let kind = "GlazeCountdown"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { CatalogueWidgetView(kind: "countdown", entry: $0) }
      .configurationDisplayName("Countdown").description("Days until the date you choose in Glaze.")
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]).contentMarginsDisabled()
  }
}
