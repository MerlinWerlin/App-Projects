// Clock: big time, weekday underneath. Small, medium and large.
// T125: no theme name; an accent bar is the theme touch above the time.
import SwiftUI
import WidgetKit

struct ClockWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  private var timeSize: CGFloat {
    switch family {
    case .systemLarge: return 84
    case .systemMedium: return 54
    default: return 40
    }
  }

  var body: some View {
    let t = entry.theme
    VStack(alignment: .leading, spacing: 4) {
      Capsule()
        .fill(t.accentColor)
        .frame(width: 22, height: 5)
      Spacer(minLength: 0)
      // Each timeline entry is on a minute boundary, so a static time string stays correct.
      Text(entry.date, format: .dateTime.hour().minute())
        .font(t.typeface(size: timeSize, weight: .bold))
        .foregroundStyle(t.inkColor)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      Text(entry.date, format: .dateTime.weekday(.wide))
        .font(t.typeface(size: family == .systemLarge ? 20 : 14, weight: .medium))
        .foregroundStyle(t.inkColor.opacity(0.75))
      if family == .systemLarge {
        Text(entry.date, format: .dateTime.day().month(.wide))
          .font(t.typeface(size: 16, weight: .semibold))
          .foregroundStyle(t.accentColor)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

struct ClockWidget: Widget {
  let kind = "GlazeClock"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { entry in
      GlazeDesignedWidget(kind: "clock", entry: entry) { ClockWidgetView(entry: entry) }
    }
    .configurationDisplayName("Clock")
    .description("The time, in your Glaze theme.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
