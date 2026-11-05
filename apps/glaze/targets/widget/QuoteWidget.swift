// Little Line (T283): one short, gentle line a day. Every line is original to Glaze, written for
// the app: no famous quotes and nothing attributed to a real person (src/core/dailyLines.test.ts
// checks the list). The pick is deterministic by the local day of the year (GlazeLines.index), so
// every Little Line widget on the screen agrees and the line changes at midnight (DayProvider).
// Theme colours, typeface and background in every size; the theme's name is never shown.
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
    "A cracked cup still holds the morning.",
    "Water the plant, then water yourself.",
    "One tidy shelf can change a whole room.",
    "You are allowed to begin halfway.",
    "Pick one thing and give it your full hands.",
    "The second coat is where the colour lives.",
    "Some days are for sketching, not finishing.",
    "Kindness to yourself is still kindness.",
    "Open a window. Let the day in.",
    "A wobble is just a shape deciding.",
    "Quiet work still leaves a mark.",
    "Make it plain. Make it good. Then make it yours.",
    "Not every bowl needs a pattern.",
    "Be the steady hand today.",
    "Little by little, the shelf fills up.",
    "A walk counts as thinking.",
    "Mistakes are just drafts with feelings.",
    "Let today be ordinary and good.",
    "Your best work may still be wet.",
    "Unclench your shoulders. There you go.",
    "Choose the gentle version of the plan.",
    "Light finds the curve, not the corner.",
    "Clean the brush. Begin the next thing.",
    "A full cup starts with one pour.",
    "Make room on the table for something new.",
    "You can hold a lot. You don't have to.",
    "Every colour looks brave next to grey.",
    "Today, make the useful thing beautiful.",
    "Slow mornings make kind afternoons.",
    "Good enough is a finish line too.",
    "Leave the edge a little rough. It's honest.",
    "The best colours are mixed, not found.",
    "Look up from the screen for one cloud.",
    "Small rituals hold big days together.",
    "Keep one corner of the day just for you.",
    "Patience is the glaze nobody sees.",
    "The kiln can't be rushed, and neither can you.",
    "Shape the day. Don't let it shape you.",
    "Drink some water. Future you says thanks.",
    "Tomorrow gets a fresh lump of clay.",
  ]

  /// Index of the day's line: the local day of the year, offset by the year so the same date
  /// doesn't land on the same line every year. Mirrored by dailyLineIndex in dailyLines.test.ts.
  static func index(year: Int, dayOfYear: Int, count: Int) -> Int {
    guard count > 0 else { return 0 }
    let raw = (year * 7 + dayOfYear - 1) % count
    return raw < 0 ? raw + count : raw
  }

  /// Stable for the whole local day, so every widget on the screen agrees.
  static func line(for date: Date) -> String {
    let cal = Calendar.current
    let day = cal.ordinality(of: .day, in: .year, for: date) ?? 1
    let year = cal.component(.year, from: date)
    let i = index(year: year, dayOfYear: day, count: all.count)
    return all.indices.contains(i) ? all[i] : (all.first ?? "")
  }
}

struct QuoteWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  private var textSize: CGFloat {
    switch family {
    case .systemLarge: return 30
    case .systemMedium: return 21
    default: return 16
    }
  }

  var body: some View {
    let t = entry.theme
    VStack(alignment: .leading, spacing: family == .systemLarge ? 14 : 8) {
      Image(systemName: "quote.opening")
        .font(.system(size: family == .systemLarge ? 26 : (family == .systemMedium ? 18 : 14), weight: .bold))
        .foregroundStyle(t.accentColor)
        .accessibilityHidden(true)
      Text(GlazeLines.line(for: entry.date))
        .font(t.typeface(size: textSize, weight: .semibold))
        .foregroundStyle(t.inkColor)
        .minimumScaleFactor(0.55)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: family == .systemSmall ? .topLeading : .leading)
      if family != .systemSmall {
        HStack(spacing: 6) {
          Capsule()
            .fill(t.accentColor)
            .frame(width: family == .systemLarge ? 28 : 18, height: 3)
          Text(entry.date, format: .dateTime.weekday(.wide).day().month(.wide))
            .font(t.typeface(size: family == .systemLarge ? 14 : 11, weight: .medium))
            .foregroundStyle(t.inkColor.opacity(0.7))
            .lineLimit(1)
        }
        .accessibilityHidden(true)
      }
    }
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct QuoteWidget: Widget {
  let kind = "GlazeQuote"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { entry in
      GlazeDesignedWidget(kind: "quote", entry: entry) { QuoteWidgetView(entry: entry) }
    }
    .configurationDisplayName("Little Line")
    .description("A short, gentle line that changes every day.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .legacyGlazeGallery()
  }
}
