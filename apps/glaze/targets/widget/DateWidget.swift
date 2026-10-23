// Date: day number large, weekday + month. Medium adds a seven-day strip.
import SwiftUI
import WidgetKit

struct DateWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    HStack(alignment: .bottom, spacing: 16) {
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.date, format: .dateTime.weekday(.wide))
          .font(t.typeface(size: 13, weight: .bold))
          .foregroundStyle(t.accentColor)
        Spacer(minLength: 0)
        Text(entry.date, format: .dateTime.day())
          .font(t.typeface(size: 56, weight: .bold))
          .foregroundStyle(t.inkColor)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
        Text(entry.date, format: .dateTime.month(.wide))
          .font(t.typeface(size: 14, weight: .medium))
          .foregroundStyle(t.inkColor.opacity(0.7))
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

      if family == .systemMedium {
        WeekStrip(date: entry.date, theme: t)
      }
    }
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

private struct WeekStrip: View {
  let date: Date
  let theme: WidgetTheme

  var body: some View {
    let cal = Calendar.current
    let start = cal.dateInterval(of: .weekOfYear, for: date)?.start ?? date
    let days = (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    HStack(spacing: 6) {
      ForEach(days, id: \.self) { d in
        let today = cal.isDate(d, inSameDayAs: date)
        VStack(spacing: 4) {
          Text(d, format: .dateTime.weekday(.narrow))
            .font(theme.typeface(size: 10, weight: .medium))
            .foregroundStyle(theme.inkColor.opacity(0.6))
          Text(d, format: .dateTime.day())
            .font(theme.typeface(size: 13, weight: today ? .bold : .regular))
            .foregroundStyle(today ? theme.surfaceColor : theme.inkColor)
            .frame(width: 22, height: 22)
            .background(Circle().fill(today ? theme.accentColor : .clear))
        }
      }
    }
    .frame(maxHeight: .infinity, alignment: .bottom)
  }
}

struct DateWidget: Widget {
  let kind = "GlazeDate"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider()) { entry in
      DateWidgetView(entry: entry)
    }
    .configurationDisplayName("Date")
    .description("Today's date, in your Glaze theme.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
