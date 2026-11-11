// owner-1102b T277: tonight's moon, worked out on the phone (MoonPhase.swift, no network).
// Small: drawn disc + phase name. Medium: + illumination and "Full moon in N days". Large: + the
// next seven nights. The disc is drawn here (not an SF Symbol) in the theme's accent and ink, on
// the theme background. Never shows the theme name.
import SwiftUI
import WidgetKit

/// The lit part of the moon for a cycle fraction (0 new, 0.5 full). Northern-hemisphere view:
/// waxing is lit on the right. The limb is a half circle; the terminator a half ellipse whose
/// width is cos(2π·fraction) of the radius.
struct GlazeMoonLitShape: Shape {
  var fraction: Double

  func path(in rect: CGRect) -> Path {
    let r = Double(min(rect.width, rect.height)) / 2
    let cx = Double(rect.midX)
    let cy = Double(rect.midY)
    let f = fraction - floor(fraction)
    let side: Double = f < 0.5 ? 1 : -1
    let k = cos(2 * Double.pi * f)
    let steps = 48
    var path = Path()
    // Limb: top to bottom on the lit side.
    for i in 0...steps {
      let a = Double.pi * Double(i) / Double(steps)
      let x = cx + side * r * sin(a)
      let y = cy - r * cos(a)
      if i == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
    }
    // Terminator: bottom back to top.
    for i in stride(from: steps, through: 0, by: -1) {
      let a = Double.pi * Double(i) / Double(steps)
      let x = cx + side * k * r * sin(a)
      let y = cy - r * cos(a)
      path.addLine(to: CGPoint(x: x, y: y))
    }
    path.closeSubpath()
    return path
  }
}

/// A themed moon disc: shadowed face in the theme surface, lit part in the accent, ink rim.
struct GlazeMoonDisc: View {
  let fraction: Double
  let theme: WidgetTheme
  var glow: Bool = true

  var body: some View {
    ZStack {
      Circle().fill(theme.surfaceColor.opacity(0.85))
      Circle().fill(theme.inkColor.opacity(0.08))
      GlazeMoonLitShape(fraction: fraction)
        .fill(
          LinearGradient(
            colors: [theme.accentColor, theme.accentColor.opacity(0.8)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
      Circle().strokeBorder(theme.inkColor.opacity(0.25), lineWidth: 1)
    }
    .aspectRatio(1, contentMode: .fit)
    .shadow(color: glow ? theme.accentColor.opacity(0.35) : .clear, radius: glow ? 10 : 0)
    .accessibilityHidden(true)
  }
}

enum GlazeMoonText {
  static func name(_ phase: MoonPhaseName) -> String {
    switch phase {
    case .new: return String(localized: "widgets.moon.new", defaultValue: "New moon")
    case .waxingCrescent: return String(localized: "widgets.moon.waxingCrescent", defaultValue: "Waxing crescent")
    case .firstQuarter: return String(localized: "widgets.moon.firstQuarter", defaultValue: "First quarter")
    case .waxingGibbous: return String(localized: "widgets.moon.waxingGibbous", defaultValue: "Waxing gibbous")
    case .full: return String(localized: "widgets.moon.full", defaultValue: "Full moon")
    case .waningGibbous: return String(localized: "widgets.moon.waningGibbous", defaultValue: "Waning gibbous")
    case .lastQuarter: return String(localized: "widgets.moon.lastQuarter", defaultValue: "Last quarter")
    case .waningCrescent: return String(localized: "widgets.moon.waningCrescent", defaultValue: "Waning crescent")
    }
  }

  static func lit(_ illumination: Double) -> String {
    let pct = "\(Int((max(0, min(1, illumination)) * 100).rounded()))%"
    return String(localized: "widgets.moon.lit", defaultValue: "\(pct) lit")
  }

  static func untilFull(_ days: Int) -> String {
    if days <= 0 || days >= 29 { return String(localized: "widgets.moon.fullTonight", defaultValue: "Full moon tonight") }
    if days == 1 { return String(localized: "widgets.moon.fullTomorrow", defaultValue: "Full moon tomorrow") }
    let n = "\(days)"
    return String(localized: "widgets.moon.fullIn", defaultValue: "Full moon in \(n) days")
  }

  static var nextNights: String { String(localized: "widgets.moon.nextNights", defaultValue: "Next 7 nights") }
}

struct MoonWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let info = MoonPhase.info(at: entry.date)
    let name = GlazeMoonText.name(info.phase)
    Group {
      switch family {
      case .systemSmall:
        VStack(spacing: 8) {
          GlazeMoonDisc(fraction: info.fraction, theme: t)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          Text(name)
            .font(t.typeface(size: 14, weight: .bold))
            .foregroundStyle(t.inkColor)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        }
      case .systemMedium:
        HStack(spacing: 16) {
          GlazeMoonDisc(fraction: info.fraction, theme: t)
          GlazeMoonDetails(entry: entry, info: info, name: name, nameSize: 20)
        }
      default:
        VStack(alignment: .leading, spacing: 14) {
          HStack(spacing: 16) {
            GlazeMoonDisc(fraction: info.fraction, theme: t)
              .frame(maxHeight: 150)
            GlazeMoonDetails(entry: entry, info: info, name: name, nameSize: 24)
          }
          .frame(maxHeight: .infinity)
          GlazeMoonNightsRow(date: entry.date, theme: t)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(16)
    .containerBackground(for: .widget) { GlazeBackground(theme: t) }
  }
}

private struct GlazeMoonDetails: View {
  let entry: GlazeEntry
  let info: MoonInfo
  let name: String
  let nameSize: CGFloat

  var body: some View {
    let t = entry.theme
    VStack(alignment: .leading, spacing: 4) {
      Capsule()
        .fill(t.accentColor)
        .frame(width: 22, height: 5)
      Spacer(minLength: 0)
      Text(name)
        .font(t.typeface(size: nameSize, weight: .bold))
        .foregroundStyle(t.inkColor)
        .lineLimit(2)
        .minimumScaleFactor(0.6)
      Text(GlazeMoonText.lit(info.illumination))
        .font(t.typeface(size: 14, weight: .semibold))
        .foregroundStyle(t.accentColor)
      Text(GlazeMoonText.untilFull(MoonPhase.daysToFull(at: entry.date)))
        .font(t.typeface(size: 13, weight: .medium))
        .foregroundStyle(t.inkColor.opacity(0.75))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

/// The next seven nights at 22:00 local time: weekday initial over a small disc.
private struct GlazeMoonNightsRow: View {
  let date: Date
  let theme: WidgetTheme

  var body: some View {
    let cal = Calendar.current
    let today = cal.startOfDay(for: date)
    let nights: [Date] = (1...7).compactMap { (i: Int) -> Date? in
      guard let day = cal.date(byAdding: .day, value: i, to: today) else { return nil }
      return cal.date(byAdding: .hour, value: 22, to: day)
    }
    VStack(alignment: .leading, spacing: 6) {
      Text(GlazeMoonText.nextNights)
        .font(theme.typeface(size: 12, weight: .bold))
        .foregroundStyle(theme.inkColor.opacity(0.7))
      HStack(spacing: 0) {
        ForEach(nights, id: \.self) { night in
          VStack(spacing: 4) {
            Text(night, format: .dateTime.weekday(.narrow))
              .font(theme.typeface(size: 11, weight: .semibold))
              .foregroundStyle(theme.inkColor.opacity(0.75))
            GlazeMoonDisc(fraction: MoonPhase.info(at: night).fraction, theme: theme, glow: false)
              .frame(width: 24, height: 24)
          }
          .frame(maxWidth: .infinity)
        }
      }
    }
  }
}

struct MoonWidget: Widget {
  let kind = "GlazeMoon"

  var body: some WidgetConfiguration {
    // Hourly, so the lit percentage keeps up through the day; the phase changes far slower.
    StaticConfiguration(kind: kind, provider: HourProvider(sample: 0)) { entry in
      MoonWidgetView(entry: entry)
    }
    .configurationDisplayName("Moon")
    .description("Tonight's moon phase, worked out on your phone, in your Glaze theme.")
    .contentMarginsDisabled()
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .legacyGlazeGallery()
  }
}

/// owner-1102b: moon, word clock and big clock, included from GlazeWidgetsBundle as `.body`.
struct GlazeExtraWidgetsBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    MoonWidget()
    WordClockWidget()
    BigClockWidget()
  }
}
