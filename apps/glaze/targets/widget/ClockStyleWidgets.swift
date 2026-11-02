// owner-1102b T278: Word clock and Big clock, in the active theme's colours, font and background.
// Never shows the theme name. Word clock is English only (WordClock.supported); other languages
// get the big digital time in the same layout. Big clock is StandBy-friendly (systemSmall and
// systemLarge): when StandBy removes the container background the numerals switch to whichever
// theme colour reads best on black.
import SwiftUI
import WidgetKit

/// The theme colour (ink or accent) that reads best on black, for StandBy / removed backgrounds.
private func clockStyleBrightInk(_ t: WidgetTheme) -> Color {
  let ink = GlazeHex.luminance(t.ink)
  let accent = GlazeHex.luminance(t.accent)
  if max(ink, accent) < 0.18 { return .white }
  return ink >= accent ? t.inkColor : t.accentColor
}

// MARK: - Word clock

struct WordClockWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.showsWidgetContainerBackground) private var showsBackground
  let entry: GlazeEntry

  private var wordSize: CGFloat {
    switch family {
    case .systemLarge: return 46
    case .systemMedium: return 30
    default: return 24
    }
  }

  var body: some View {
    let t = entry.theme
    let ink = showsBackground ? t.inkColor : clockStyleBrightInk(t)
    Group {
      if WordClock.supported {
        let lines: [String] = WordClock.lines(at: entry.date)
        // The minute words (or O'CLOCK, the last line) carry the accent; the lead and hour are ink.
        let minuteLine: Int = lines.last == WordClock.minutes[0] ? 2 : 1
        VStack(alignment: .leading, spacing: family == .systemLarge ? 6 : 2) {
          Capsule()
            .fill(t.accentColor)
            .frame(width: 22, height: 5)
          Spacer(minLength: 0)
          ForEach(0..<lines.count, id: \.self) { i in
            Text(lines[i])
              .font(t.typeface(size: i == 0 ? wordSize * 0.6 : wordSize, weight: .heavy))
              .foregroundStyle(i == minuteLine ? t.accentColor : (i == 0 ? ink.opacity(0.7) : ink))
              .lineLimit(1)
              .minimumScaleFactor(0.4)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        GlazeClockStyleDigits(date: entry.date, theme: t, ink: ink, stacked: family == .systemLarge)
      }
    }
    .padding(16)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct WordClockWidget: Widget {
  let kind = "GlazeWordClock"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { entry in
      WordClockWidgetView(entry: entry)
    }
    .configurationDisplayName("Word clock")
    .description("The time in words, in your Glaze theme.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

// MARK: - Big clock

/// Huge hour and minute numerals. Stacked (hour over minute) for tall layouts.
struct GlazeClockStyleDigits: View {
  let date: Date
  let theme: WidgetTheme
  let ink: Color
  let stacked: Bool

  var body: some View {
    let cal = Calendar.current
    let c = cal.dateComponents([.hour, .minute], from: date)
    let m = c.minute ?? 0
    let minute = m < 10 ? "0\(m)" : "\(m)"
    if stacked {
      VStack(alignment: .leading, spacing: -24) {
        Text(date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)))
          .font(theme.typeface(size: 150, weight: .heavy))
          .foregroundStyle(ink)
        Text(minute)
          .font(theme.typeface(size: 150, weight: .heavy))
          .foregroundStyle(theme.accentColor)
      }
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.3)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    } else {
      HStack(alignment: .firstTextBaseline, spacing: 0) {
        Text(date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)))
          .foregroundStyle(ink)
        Text(":")
          .foregroundStyle(theme.accentColor)
        Text(minute)
          .foregroundStyle(ink)
      }
      .font(theme.typeface(size: 96, weight: .heavy))
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.25)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
  }
}

struct BigClockWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.showsWidgetContainerBackground) private var showsBackground
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let ink = showsBackground ? t.inkColor : clockStyleBrightInk(t)
    VStack(spacing: 2) {
      GlazeClockStyleDigits(date: entry.date, theme: t, ink: ink, stacked: family == .systemLarge)
      if family != .systemSmall {
        Text(entry.date, format: .dateTime.weekday(.wide).day().month(.wide))
          .font(t.typeface(size: 16, weight: .semibold))
          .foregroundStyle(t.accentColor)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
    }
    .padding(family == .systemSmall ? 10 : 16)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct BigClockWidget: Widget {
  let kind = "GlazeBigClock"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { entry in
      BigClockWidgetView(entry: entry)
    }
    .configurationDisplayName("Big clock")
    .description("Big, bold numerals in your Glaze theme. Made for StandBy.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
