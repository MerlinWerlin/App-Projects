import Foundation
import SwiftUI
import WidgetKit

extension ThemeStore {
  static func savedDesign(kind: String, family: WidgetFamily, theme: WidgetTheme) -> SavedWidgetDesign? {
    let size: String
    switch family {
    case .systemMedium: size = "medium"
    case .systemLarge: size = "large"
    case .accessoryCircular: size = "accessoryCircular"
    case .accessoryRectangular: size = "accessoryRectangular"
    case .accessoryInline: size = "accessoryInline"
    default: size = "small"
    }
    // Atomic shared file first: UserDefaults can be cached independently in each process.
    let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)
    let fileData = container.flatMap { try? Data(contentsOf: $0.appendingPathComponent("widgets.json")) }
    let defaultsData = UserDefaults(suiteName: GlazeShared.appGroup)?.string(forKey: "glaze.widgets.v2")?.data(using: .utf8)
    guard let data = fileData ?? defaultsData, let payload = SavedWidgetPayload(data: data) else { return nil }
    return payload.design(kind: kind, size: size, activeThemeID: theme.themeId)
      ?? (size == "small" ? payload.design(kind: kind, size: "standby", activeThemeID: theme.themeId) : nil)
  }
}

private func number(_ object: [String: Any], _ key: String, _ fallback: Double = 0) -> Double {
  guard let value = object[key] as? Double, value.isFinite else { return fallback }
  return value
}
private func object(_ raw: [String: Any], _ key: String) -> [String: Any] { raw[key] as? [String: Any] ?? [:] }
private func string(_ raw: [String: Any], _ key: String, _ fallback: String = "") -> String { raw[key] as? String ?? fallback }

struct SavedWidgetFill: View {
  let fill: [String: Any]
  var body: some View {
    if string(fill, "kind") == "gradient" {
      let a = number(fill, "angle", 180) * .pi / 180
      LinearGradient(colors: [Color(hex: string(fill, "from", "#F6F3F5")), Color(hex: string(fill, "to", "#F6F3F5"))],
                     startPoint: UnitPoint(x: 0.5 - sin(a) / 2, y: 0.5 + cos(a) / 2),
                     endPoint: UnitPoint(x: 0.5 + sin(a) / 2, y: 0.5 - cos(a) / 2))
    } else {
      Color(hex: string(fill, "colour", "#F6F3F5"))
    }
  }
}

struct SavedWidgetView: View {
  let design: SavedWidgetDesign
  let date: Date

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
        ForEach(Array(design.regions.enumerated()), id: \.offset) { _, region in
          let frame = object(region, "frame")
          SavedWidgetRegion(region: region, design: design, date: date, scale: min(geo.size.width / design.width, geo.size.height / design.height))
            .frame(width: max(0, number(frame, "w")) * geo.size.width, height: max(0, number(frame, "h")) * geo.size.height)
            .clipped()
            .offset(x: number(frame, "x") * geo.size.width, y: number(frame, "y") * geo.size.height)
        }
      }
      .overlay {
        let border = object(design.raw, "border")
        if !border.isEmpty {
          ContainerRelativeShape().inset(by: number(border, "width", 1) / 2)
            .strokeBorder(Color(hex: string(border, "colour", design.accent)), lineWidth: number(border, "width", 1))
        }
      }
    }
    .containerBackground(for: .widget) {
      // WidgetKit cannot blur arbitrary Home Screen wallpaper. Use the saved, contrast-checked fill.
      SavedWidgetFill(fill: design.background)
    }
  }
}

private struct SavedWidgetRegion: View {
  let region: [String: Any]
  let design: SavedWidgetDesign
  let date: Date
  let scale: Double
  private var colour: Color { Color(hex: string(region, "colour", design.accent)) }
  private var period: WidgetPeriod { WidgetPeriod.at(date, year: design.kind == "yearProgress") }
  private func textFont(_ text: [String: Any]) -> Font {
    let size = max(6, number(text, "sizePt", 16) * scale)
    let weight: Font.Weight = string(text, "weight") == "bold" ? .bold : string(text, "weight") == "medium" ? .medium : .regular
    guard string(text, "font") == "display" else { return .system(size: size, weight: weight) }
    // Match the iOS system families used by ThemeCard.displayFontStyle in the app.
    switch string(design.raw, "typeface") {
    case "serif": return .custom("Georgia", size: size).weight(weight)
    case "script": return .custom("Snell Roundhand", size: size).weight(weight)
    case "mono": return .custom("Menlo", size: size).weight(weight)
    case "rounded": return .custom("Avenir Next", size: size).weight(weight)
    default: return .system(size: size, weight: weight, design: .rounded)
    }
  }

  @ViewBuilder var body: some View {
    switch string(region, "role") {
    case "text":
      let text = object(region, "text")
      if string(text, "source") == "monthGrid" {
        monthGrid
      } else {
        let align = string(text, "align")
        Text(textValue(text))
          .font(textFont(text))
          .minimumScaleFactor(0.5)
          .multilineTextAlignment(align == "center" ? .center : align == "end" ? .trailing : .leading)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: align == "center" ? .center : align == "end" ? .trailing : .leading)
          .foregroundStyle(colour)
          .shadow(color: Color(hex: string(object(design.raw, "glow"), "colour", design.accent)).opacity(number(object(design.raw, "glow"), "opacity")), radius: number(object(design.raw, "glow"), "radius") * scale)
      }
    case "band", "scrim":
      SavedWidgetFill(fill: object(region, "fill")).opacity(number(region, "fillOpacity", 1))
    case "photo":
      if string(design.raw, "photoRef") == GlazeShared.photoFile, let image = ThemeStore.loadPhoto() {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        ZStack { SavedWidgetFill(fill: object(region, "fill")); Image(systemName: "photo").foregroundStyle(colour) }
      }
    case "dots":
      let dots = object(region, "dots")
      let p = WidgetPeriod.at(date, year: string(dots, "source") == "year")
      GeometryReader { geo in
        let columns = max(1, Int(number(dots, "columns", 7)))
        let rows = max(1, Int(ceil(Double(p.total) / Double(columns))))
        let side = min(geo.size.width / Double(columns), geo.size.height / Double(rows)) * 0.72
        ForEach(0..<p.total, id: \.self) { i in
          Circle().fill(i < p.day - 1 ? colour : i == p.day - 1 ? Color(hex: string(dots, "today", design.accent)) : Color(hex: string(dots, "track", "#CCCCCC")))
            .frame(width: side, height: side)
            .position(x: (Double(i % columns) + 0.5) * geo.size.width / Double(columns), y: (Double(i / columns) + 0.5) * geo.size.height / Double(rows))
        }
      }.accessibilityLabel(p.fraction.formatted(.percent.precision(.fractionLength(0))))
    case "meter":
      let meter = object(region, "meter")
      if string(meter, "shape") == "ring" {
        ZStack {
          Circle().stroke(Color(hex: string(meter, "track", "#CCCCCC")), lineWidth: 5)
          Circle().trim(from: 0, to: period.fraction).stroke(colour, style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(-90))
        }.padding(3)
      } else {
        GeometryReader { geo in
          ZStack(alignment: .leading) {
            Capsule().fill(Color(hex: string(meter, "track", "#CCCCCC")))
            Capsule().fill(colour).frame(width: geo.size.width * period.fraction)
          }
        }
      }
    case "dial":
      GeometryReader { geo in
        let side = min(geo.size.width, geo.size.height)
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        ZStack {
          Circle().stroke(colour.opacity(0.3), lineWidth: 2)
          ForEach(0..<12) { i in
            Capsule().fill(colour).frame(width: 2, height: side * 0.045).offset(y: -side * 0.44).rotationEffect(.degrees(Double(i) * 30))
          }
          Capsule().fill(colour).frame(width: 4, height: side * 0.27).offset(y: -side * 0.135)
            .rotationEffect(.degrees(Double((parts.hour ?? 0) % 12) * 30 + Double(parts.minute ?? 0) * 0.5))
          Capsule().fill(colour).frame(width: 2, height: side * 0.39).offset(y: -side * 0.195)
            .rotationEffect(.degrees(Double(parts.minute ?? 0) * 6))
        }.frame(width: side, height: side).position(x: geo.size.width / 2, y: geo.size.height / 2)
      }
    case "glyph":
      Image(systemName: design.kind == "countdown" ? "hourglass" : "sparkle").resizable().scaledToFit().foregroundStyle(colour)
    default: EmptyView()
    }
  }

  private func textValue(_ text: [String: Any]) -> String {
    let cal = Calendar.current
    switch string(text, "source") {
    case "time": return date.formatted(date: .omitted, time: .shortened)
    case "weekday": return date.formatted(.dateTime.weekday(.wide))
    case "date": return date.formatted(.dateTime.day().month(.wide))
    case "month": return date.formatted(.dateTime.month(.wide))
    case "dayNumber": return date.formatted(.dateTime.day())
    case "week": return cal.component(.weekOfYear, from: date).formatted()
    case "monthProgress", "yearProgress": return "\(period.day)/\(period.total)"
    case "progressPercent": return (floor(period.fraction * 100) / 100).formatted(.percent.precision(.fractionLength(0)))
    case "countdown":
      let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
      guard let target = formatter.date(from: string(design.raw, "countdownTo")) else { return "—" }
      return (cal.dateComponents([.day], from: cal.startOfDay(for: date), to: cal.startOfDay(for: target)).day ?? 0).formatted()
    default: return string(text, "userText", design.texts[string(region, "id")] ?? "")
    }
  }

  private var monthGrid: some View {
    let cal = Calendar.current
    let days = cal.range(of: .day, in: .month, for: date)?.count ?? 31
    let start = cal.date(from: cal.dateComponents([.year, .month], from: date)) ?? date
    let offset = (cal.component(.weekday, from: start) - cal.firstWeekday + 7) % 7
    let grid = object(region, "grid")
    return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 2) {
      ForEach(0..<(days + offset), id: \.self) { i in
        let day = i - offset + 1
        let today = day == cal.component(.day, from: date)
        Text(day > 0 ? day.formatted() : " ")
          .font(.system(size: max(8, 12 * scale)))
          .foregroundStyle(today ? Color(hex: string(grid, "todayText", "#FFFFFF")) : colour)
          .frame(maxWidth: .infinity, minHeight: 16 * scale)
          .background(Circle().fill(today ? Color(hex: string(grid, "todayFill", design.accent)) : .clear))
      }
    }
  }
}

extension HabitKindID {
  var designKind: String { "habit" + rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}

/// Keeps all existing interactive habit actions while applying the saved colours/gradient per size.
func savedHabitTheme(_ theme: WidgetTheme, kind: String, family: WidgetFamily) -> WidgetTheme {
  guard let design = ThemeStore.savedDesign(kind: kind, family: family, theme: theme) else { return theme }
  var changed = theme
  let bg = design.background
  changed.bg = string(bg, "kind") == "gradient" ? [string(bg, "from"), string(bg, "to")] : [string(bg, "colour", theme.bg.first ?? "#F6F3F5")]
  changed.ink = design.textColour
  changed.accent = design.accent
  changed.style = .solid
  return changed
}
