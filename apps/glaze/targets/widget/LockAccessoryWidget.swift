// Lock Screen accessories (T279, owner-1102b Part B): clock, date, battery, countdown and moon.
// Accessory widgets are drawn by the system in vibrant/tinted modes, so colour is mostly ignored;
// the theme supplies the font choice. T125: the theme name is never shown.
//
// Kinds: GlazeLockAccessory (the original time + date widget; kept so placed widgets stay),
// GlazeLockDate, GlazeLockBattery, GlazeLockCountdown, GlazeLockMoon. They sit in the nested
// GlazeLockWidgetsBundle below, included from GlazeWidgetsBundle.swift through `.body`.
//
// Data (never a made-up number):
//   battery    LiveBattery.percent() (LiveArtOverlay.swift, UIDevice with monitoring on), read
//              when the timeline is built, every 15 min. The app writes no battery value to the
//              App Group, so when iOS reports no level (-1) the widget shows a dash.
//   countdown  the `countdownTo` day ("YYYY-MM-DD") of the Countdown widget design the app saves
//              (widgets.json, ThemeStore.savedDesign kind "countdown"); without one, a prompt to
//              choose a date in Glaze.
//   moon       MoonPhase.info(at:) / daysToFull(at:) (MoonPhase.swift).
//
// Not compiled here (no Xcode in the build environment). VERIFY on a dev build.
import SwiftUI
import WidgetKit

// MARK: - Clock (GlazeLockAccessory)

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
        Image(systemName: "drop.fill")
          .font(.system(size: 16, weight: .bold))
          .widgetAccentable()
      }
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockAccessoryWidget: Widget {
  let kind = "GlazeLockAccessory"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MinuteProvider(sample: 0)) { entry in
      LockAccessoryView(entry: entry)
    }
    .configurationDisplayName("Glaze Lock")
    .description("Time and date for your Lock Screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

// MARK: - Shared copy

/// Lock Screen copy (Localizable.strings in every targets/widget/<lang>.lproj). Numbers are
/// formatted first and passed as strings, so the translated formats take %1$@.
enum LockText {
  static var battery: String { String(localized: "lock.battery", defaultValue: "Battery") }
  static var moon: String { String(localized: "lock.moon", defaultValue: "Moon") }
  static var fullToday: String { String(localized: "lock.moon.fullToday", defaultValue: "Full moon today") }

  static func days(_ n: Int) -> String {
    let count = n.formatted()
    return String(localized: "lock.countdown.days", defaultValue: "\(count) days")
  }

  static func fullIn(_ n: Int) -> String {
    let count = n.formatted()
    return String(localized: "lock.moon.fullIn", defaultValue: "Full in \(count) days")
  }

  static func lit(_ fraction: Double) -> String {
    let pct = fraction.formatted(.percent.precision(.fractionLength(0)))
    return String(localized: "lock.moon.lit", defaultValue: "\(pct) lit")
  }
}

// MARK: - Date (GlazeLockDate)

struct LockDateView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: -2) {
          Text(verbatim: entry.date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
            .font(t.typeface(size: 10, weight: .semibold))
            .widgetAccentable()
          Text(verbatim: entry.date.formatted(.dateTime.day()))
            .font(t.typeface(size: 24, weight: .bold))
            .monospacedDigit()
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .padding(4)
      }
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      Label {
        Text(entry.date, format: .dateTime.weekday(.wide).day().month(.wide))
      } icon: {
        Image(systemName: "calendar")
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: .leading, spacing: 0) {
        Text(entry.date, format: .dateTime.weekday(.wide))
          .font(t.typeface(size: 15, weight: .bold))
          .widgetAccentable()
        Text(entry.date, format: .dateTime.day().month(.wide))
          .font(t.typeface(size: 22, weight: .bold))
        Text(entry.date, format: .dateTime.year())
          .font(t.typeface(size: 12, weight: .medium))
          .foregroundStyle(.secondary)
      }
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockDateWidget: Widget {
  let kind = "GlazeLockDate"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider(sample: 0)) { entry in
      LockDateView(entry: entry)
    }
    .configurationDisplayName("Lock Screen date")
    .description("The weekday and date for your Lock Screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

// MARK: - Battery (GlazeLockBattery)

struct LockBatteryEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// 0-100, or nil when iOS reports no level.
  let percent: Int?
}

struct LockBatteryProvider: TimelineProvider {
  func placeholder(in context: Context) -> LockBatteryEntry {
    LockBatteryEntry(date: Date(), theme: GallerySample.theme(0), percent: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (LockBatteryEntry) -> Void) {
    if context.isPreview { return completion(LockBatteryEntry(date: Date(), theme: GallerySample.theme(0), percent: 75)) }
    completion(LockBatteryEntry(date: Date(), theme: ThemeStore.load(), percent: LiveBattery.percent()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<LockBatteryEntry>) -> Void) {
    let now = Date()
    let entry = LockBatteryEntry(date: now, theme: ThemeStore.load(), percent: LiveBattery.percent())
    completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(15 * 60))))
  }
}

struct LockBatteryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: LockBatteryEntry

  private var valueText: String {
    guard let pct = entry.percent else { return "–" }
    return "\(pct)%"
  }

  private var symbol: String {
    guard let pct = entry.percent else { return "battery.0" }
    switch pct {
    case 88...: return "battery.100"
    case 63..<88: return "battery.75"
    case 38..<63: return "battery.50"
    case 13..<38: return "battery.25"
    default: return "battery.0"
    }
  }

  var body: some View {
    let t = entry.theme
    switch family {
    case .accessoryCircular:
      if let pct = entry.percent {
        Gauge(value: Double(pct), in: 0...100) {
          Image(systemName: "bolt.fill")
        } currentValueLabel: {
          Text(verbatim: "\(pct)")
            .font(t.typeface(size: 16, weight: .bold))
            .monospacedDigit()
        }
        .gaugeStyle(.accessoryCircular)
        .widgetAccentable()
        .containerBackground(for: .widget) { Color.clear }
      } else {
        ZStack {
          AccessoryWidgetBackground()
          VStack(spacing: 0) {
            Image(systemName: "bolt.fill")
              .font(.system(size: 10, weight: .bold))
              .widgetAccentable()
            Text(verbatim: "–")
              .font(t.typeface(size: 18, weight: .bold))
          }
        }
        .containerBackground(for: .widget) { Color.clear }
      }
    case .accessoryInline:
      Label {
        Text(verbatim: valueText)
      } icon: {
        Image(systemName: symbol)
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 4) {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .semibold))
          Text(verbatim: LockText.battery)
            .font(t.typeface(size: 13, weight: .semibold))
        }
        .widgetAccentable()
        Text(verbatim: valueText)
          .font(t.typeface(size: 24, weight: .bold))
          .monospacedDigit()
        if let pct = entry.percent {
          Gauge(value: Double(pct), in: 0...100) {
            Text(verbatim: LockText.battery)
          }
          .gaugeStyle(.accessoryLinearCapacity)
          .labelsHidden()
        }
      }
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockBatteryWidget: Widget {
  let kind = "GlazeLockBattery"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: LockBatteryProvider()) { entry in
      LockBatteryView(entry: entry)
    }
    .configurationDisplayName("Lock Screen battery")
    .description("Your battery level for your Lock Screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

// MARK: - Countdown (GlazeLockCountdown)

/// The day the Countdown widget counts to, from the design the app saves (`countdownTo`).
enum LockCountdownStore {
  struct Target {
    let day: Date
    /// The user's own label for the countdown, when they typed one.
    let label: String?
  }

  static func target(theme: WidgetTheme, family: WidgetFamily) -> Target? {
    let families: [WidgetFamily] = [family, .systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline]
    for f in families {
      guard let design = ThemeStore.savedDesign(kind: "countdown", family: f, theme: theme),
        let raw = design.raw["countdownTo"] as? String,
        let day = parseDay(raw)
      else { continue }
      return Target(day: day, label: label(in: design))
    }
    return nil
  }

  /// "YYYY-MM-DD" to the start of that day (current calendar); nil for anything else.
  static func parseDay(_ s: String) -> Date? {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar.current
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let d = formatter.date(from: s) else { return nil }
    return Calendar.current.startOfDay(for: d)
  }

  /// Whole days from today to the target, never negative.
  static func daysLeft(to day: Date, from now: Date) -> Int {
    let cal = Calendar.current
    return max(0, cal.dateComponents([.day], from: cal.startOfDay(for: now), to: day).day ?? 0)
  }

  /// The first free-text region's typed text (same lookup as SavedWidgetView's "text" source).
  private static func label(in design: SavedWidgetDesign) -> String? {
    for region in design.regions {
      guard let text = region["text"] as? [String: Any], (text["source"] as? String) == "text" else { continue }
      let id = region["id"] as? String ?? ""
      let typed = (text["userText"] as? String) ?? design.texts[id] ?? ""
      let clean = typed.trimmingCharacters(in: .whitespacesAndNewlines)
      if !clean.isEmpty { return clean }
    }
    return nil
  }
}

struct LockCountdownView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let target = LockCountdownStore.target(theme: t, family: family)
    let days = target.map { LockCountdownStore.daysLeft(to: $0.day, from: entry.date) }
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        if let days {
          VStack(spacing: -2) {
            Text(verbatim: days.formatted())
              .font(t.typeface(size: 22, weight: .bold))
              .monospacedDigit()
              .widgetAccentable()
            Text("Days")
              .font(t.typeface(size: 9, weight: .semibold))
          }
          .lineLimit(1)
          .minimumScaleFactor(0.5)
          .padding(4)
        } else {
          Image(systemName: "hourglass")
            .font(.system(size: 20, weight: .semibold))
            .widgetAccentable()
        }
      }
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      Label {
        if let days {
          Text(verbatim: LockText.days(days))
        } else {
          Text("Choose a date in Glaze")
        }
      } icon: {
        Image(systemName: "hourglass")
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: .leading, spacing: 0) {
        if let target, let days {
          HStack(spacing: 4) {
            Image(systemName: "hourglass")
              .font(.system(size: 12, weight: .semibold))
            if let label = target.label {
              Text(verbatim: label)
                .font(t.typeface(size: 13, weight: .semibold))
            } else {
              Text(target.day, format: .dateTime.day().month(.wide))
                .font(t.typeface(size: 13, weight: .semibold))
            }
          }
          .widgetAccentable()
          Text(verbatim: LockText.days(days))
            .font(t.typeface(size: 24, weight: .bold))
            .monospacedDigit()
          if target.label != nil {
            Text(target.day, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
              .font(t.typeface(size: 12, weight: .medium))
              .foregroundStyle(.secondary)
          }
        } else {
          Image(systemName: "hourglass")
            .font(.system(size: 16, weight: .semibold))
            .widgetAccentable()
          Text("Choose a date in Glaze")
            .font(t.typeface(size: 14, weight: .semibold))
            .lineLimit(2)
        }
      }
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockCountdownWidget: Widget {
  let kind = "GlazeLockCountdown"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider(sample: 0)) { entry in
      LockCountdownView(entry: entry)
    }
    .configurationDisplayName("Lock Screen countdown")
    .description("Days left to the date you choose in Glaze.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

// MARK: - Moon (GlazeLockMoon)

struct LockMoonView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let info = MoonPhase.info(at: entry.date)
    let toFull = MoonPhase.daysToFull(at: entry.date)
    let fullLine = toFull == 0 ? LockText.fullToday : LockText.fullIn(toFull)
    switch family {
    case .accessoryCircular:
      Gauge(value: info.illumination, in: 0...1) {
        Text(verbatim: LockText.moon)
      } currentValueLabel: {
        Image(systemName: info.phase.symbol)
          .font(.system(size: 18, weight: .semibold))
      }
      .gaugeStyle(.accessoryCircular)
      .widgetAccentable()
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      Label {
        Text(verbatim: fullLine)
      } icon: {
        Image(systemName: info.phase.symbol)
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      HStack(spacing: 10) {
        Image(systemName: info.phase.symbol)
          .font(.system(size: 34, weight: .regular))
          .widgetAccentable()
        VStack(alignment: .leading, spacing: 0) {
          Text(verbatim: LockText.lit(info.illumination))
            .font(t.typeface(size: 18, weight: .bold))
            .monospacedDigit()
          Text(verbatim: fullLine)
            .font(t.typeface(size: 12, weight: .medium))
            .foregroundStyle(.secondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        Spacer(minLength: 0)
      }
      .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct LockMoonWidget: Widget {
  let kind = "GlazeLockMoon"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider(sample: 0)) { entry in
      LockMoonView(entry: entry)
    }
    .configurationDisplayName("Lock Screen moon")
    .description("Tonight's moon and the days to the next full moon.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}

// MARK: - Bundle

/// T279: the Lock Screen widgets, included from GlazeWidgetsBundle as `.body` (≤ 9 entries).
struct GlazeLockWidgetsBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    LockAccessoryWidget()
    LockDateWidget()
    LockBatteryWidget()
    LockCountdownWidget()
    LockMoonWidget()
  }
}
