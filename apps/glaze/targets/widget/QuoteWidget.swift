// Quote: a short line that changes every hour. All lines are original to Glaze.
import SwiftUI
import WidgetKit

enum GlazeLines {
  static let all: [String] = [
    "Slow is a speed too.",
    "Fire turns clay into something that lasts.",
    "Make one small thing well today.",
    "The glaze always looks different after the kiln.",
    "Rest is part of the work.",
    "Good things are often a little uneven.",
    "Start with the shape. The shine comes later.",
    "Every pot was once a lump.",
    "Leave a little room for surprise.",
    "Breathe in. Centre. Begin again.",
    "Today counts, even the quiet parts.",
    "Keep your hands busy and your mind kind.",
    "Fingerprints are part of the finish.",
    "You don't have to finish it all today.",
    "A steady wheel makes a true bowl.",
    "Notice one beautiful thing before noon.",
    "Small layers, deep colour.",
    "Let it cool before you judge it.",
    "Done is a lovely colour.",
    "Warm hands, open heart.",
    "Trim what you don't need.",
    "Even the kiln takes its time.",
    "Your pace is the right pace.",
    "End the day softer than you started it.",
  ]

  /// Stable per hour of the year, so all widgets on the screen agree.
  static func line(for date: Date) -> String {
    let cal = Calendar.current
    let day = cal.ordinality(of: .day, in: .year, for: date) ?? 1
    let hour = cal.component(.hour, from: date)
    return all[(day * 24 + hour) % all.count]
  }
}

struct QuoteWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: "quote.opening")
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(t.accentColor)
      Text(GlazeLines.line(for: entry.date))
        .font(t.typeface(size: family == .systemLarge ? 28 : (family == .systemMedium ? 20 : 16), weight: .semibold))
        .foregroundStyle(t.inkColor)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct QuoteWidget: Widget {
  let kind = "GlazeQuote"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HourProvider()) { entry in
      GlazeDesignedWidget(kind: "quote", entry: entry) { QuoteWidgetView(entry: entry) }
    }
    .configurationDisplayName("Little Line")
    .description("A short, gentle line that changes every hour.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
