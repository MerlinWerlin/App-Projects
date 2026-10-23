// Clock: big time, weekday underneath. Small + medium.
import SwiftUI
import WidgetKit

struct ClockWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    VStack(alignment: .leading, spacing: 4) {
      Text(t.name.uppercased())
        .font(t.typeface(size: 10, weight: .bold))
        .foregroundStyle(t.accentColor)
        .lineLimit(1)
      Spacer(minLength: 0)
      // Each timeline entry is on a minute boundary, so a static time string stays correct.
      Text(entry.date, format: .dateTime.hour().minute())
        .font(t.typeface(size: family == .systemMedium ? 54 : 40, weight: .bold))
        .foregroundStyle(t.inkColor)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      Text(entry.date, format: .dateTime.weekday(.wide))
        .font(t.typeface(size: 14, weight: .medium))
        .foregroundStyle(t.inkColor.opacity(0.7))
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct ClockWidget: Widget {
  let kind = "GlazeClock"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { entry in
      ClockWidgetView(entry: entry)
    }
    .configurationDisplayName("Clock")
    .description("The time, in your Glaze theme.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
