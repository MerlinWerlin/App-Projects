// Lock Screen accessory: time, date and a small theme glyph.
// Accessory widgets are drawn by the system in vibrant/tinted modes, so colour is mostly ignored;
// the theme supplies the name and font choice.
import SwiftUI
import WidgetKit

struct LockAccessoryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Image(systemName: "drop.fill")
            .font(.system(size: 10, weight: .bold))
            .widgetAccentable()
          Text(entry.date, format: .dateTime.hour().minute())
            .font(t.typeface(size: 13, weight: .bold))
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
        .padding(4)
      }
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      // Inline widgets show one line of text plus at most one image. VERIFY: custom fonts ignored.
      Label {
        Text(entry.date, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
      } icon: {
        Image(systemName: "drop.fill")
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      HStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 0) {
          Text(entry.date, format: .dateTime.hour().minute())
            .font(t.typeface(size: 26, weight: .bold))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Text(entry.date, format: .dateTime.weekday(.wide).day().month(.abbreviated))
            .font(t.typeface(size: 12, weight: .medium))
            .lineLimit(1)
        }
        Spacer(minLength: 0)
        VStack(spacing: 2) {
          Image(systemName: "drop.fill")
            .font(.system(size: 16, weight: .bold))
            .widgetAccentable()
          Text(t.name)
            .font(.system(size: 9, weight: .semibold))
            .lineLimit(1)
        }
      }
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockAccessoryWidget: Widget {
  let kind = "GlazeLockAccessory"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider()) { entry in
      LockAccessoryView(entry: entry)
    }
    .configurationDisplayName("Glaze Lock")
    .description("Time and date for your Lock Screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}
