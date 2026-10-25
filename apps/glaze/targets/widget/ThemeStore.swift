// Reads the active Glaze theme that the app writes into the App Group.
// Writer: modules/glaze-widget-bridge (UserDefaults suite `group.com.jared797.glaze`, key `glaze.theme.v1`).
// Schema: src/core/widgetTheme.ts (WidgetTheme v1). Decoding is tolerant: any missing or invalid
// field falls back to the Glaze defaults below (plum to coral, light ink), matching
// DEFAULT_WIDGET_THEME in TS. T125: a backup copy of the same JSON is read from `theme.json` in the
// App Group container when the UserDefaults key is missing. The theme name is never rendered.
// T146: each load writes what it rendered to `glaze.widget.lastRead.v1` (read back by the bridge's
// linkStatus for the Widgets tab link check). No visible text.
import Foundation
import SwiftUI
import UIKit
import WidgetKit

enum GlazeShared {
  static let appGroup = "group.com.jared797.glaze"
  static let themeKey = "glaze.theme.v1"
  static let photoFile = "widget-photo.jpg"
  static let themeFile = "theme.json"
  /// T146: what the extension last rendered (src/core/widgetLink.ts WIDGET_LAST_READ_KEY).
  static let lastReadKey = "glaze.widget.lastRead.v1"
}

enum WidgetSurfaceStyle: String {
  case glass, solid, outline
}

enum WidgetFontChoice: String {
  case display, body
}

struct WidgetTheme: Decodable {
  var v: Int = 1
  var themeId: String = "glaze"
  var name: String = "Glaze"
  var bg: [String] = ["#7A2E6B", "#E0794F"]
  var surface: String = "#4A1A42"
  var accent: String = "#FFC9A8"
  var ink: String = "#FFF7F2"
  var style: WidgetSurfaceStyle = .solid
  var font: WidgetFontChoice = .display
  var updatedAt: String = "1970-01-01T00:00:00.000Z"

  static let fallback = WidgetTheme()

  /// T125: mirrors PALE_BG_LUMINANCE / PALE_ACCENT_MIX in src/core/widgetTheme.ts.
  static let paleLuminance: Double = 0.8
  static let paleAccentMix: Double = 0.35

  init() {}

  private enum CodingKeys: String, CodingKey {
    case v, themeId, name, bg, surface, accent, ink, style, font, updatedAt
  }

  // Relies on Swift 5 flattening of `try?` (SE-0230), so `try? decodeIfPresent` is a single optional.
  init(from decoder: Decoder) throws {
    let d = WidgetTheme()
    let c = try decoder.container(keyedBy: CodingKeys.self)
    v = (try? c.decodeIfPresent(Int.self, forKey: .v)) ?? 1
    themeId = Self.text(try? c.decodeIfPresent(String.self, forKey: .themeId)) ?? d.themeId
    name = Self.text(try? c.decodeIfPresent(String.self, forKey: .name)) ?? d.name
    var rawBg: [String] = []
    if let list = try? c.decodeIfPresent([String].self, forKey: .bg) {
      rawBg = list
    } else if let single = try? c.decodeIfPresent(String.self, forKey: .bg) {
      rawBg = [single]
    }
    let validBg = rawBg.filter { Color.isHex($0) }.prefix(2)
    bg = validBg.isEmpty ? d.bg : Array(validBg)
    surface = Self.hex(try? c.decodeIfPresent(String.self, forKey: .surface)) ?? d.surface
    accent = Self.hex(try? c.decodeIfPresent(String.self, forKey: .accent)) ?? d.accent
    ink = Self.hex(try? c.decodeIfPresent(String.self, forKey: .ink)) ?? d.ink
    style = (try? c.decodeIfPresent(String.self, forKey: .style)).flatMap(WidgetSurfaceStyle.init(rawValue:)) ?? d.style
    font = (try? c.decodeIfPresent(String.self, forKey: .font)).flatMap(WidgetFontChoice.init(rawValue:)) ?? d.font
    updatedAt = Self.text(try? c.decodeIfPresent(String.self, forKey: .updatedAt)) ?? d.updatedAt
  }

  private static func text(_ s: String?) -> String? {
    guard let s = s else { return nil }
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
  }

  private static func hex(_ s: String?) -> String? {
    guard let s = s, Color.isHex(s) else { return nil }
    return s
  }

  // MARK: Colours

  var bgColors: [Color] { bg.map { Color(hex: $0) } }

  /// T125: the two gradient stops widgets paint (src/core/widgetTheme.ts widgetBackgroundStops).
  /// When every stop is pale, the last one is pulled toward the accent so pastel themes still read
  /// as their theme rather than plain white.
  var backgroundHexes: [String] {
    let stops: [String] = bg.isEmpty ? WidgetTheme.fallback.bg : Array(bg.prefix(2))
    let first = stops[0]
    let last = stops[stops.count - 1]
    let pale = stops.allSatisfy { GlazeHex.luminance($0) >= WidgetTheme.paleLuminance }
    return [first, pale ? GlazeHex.mix(last, accent, WidgetTheme.paleAccentMix) : last]
  }

  var backgroundColors: [Color] { backgroundHexes.map { Color(hex: $0) } }
  var surfaceColor: Color { Color(hex: surface) }
  var accentColor: Color { Color(hex: accent) }
  var inkColor: Color { Color(hex: ink) }

  /// Unbounded / Manrope are not bundled in the extension; the system rounded face stands in for
  /// the display font. TODO: bundle the OFL font files into the target and register them.
  func typeface(size: CGFloat, weight: Font.Weight = .semibold) -> Font {
    switch font {
    case .display: return .system(size: size, weight: weight, design: .rounded)
    case .body: return .system(size: size, weight: weight == .semibold ? .medium : weight, design: .default)
    }
  }
}

enum ThemeStore {
  /// Reads and decodes the theme; never fails. UserDefaults first, then the theme.json copy in the
  /// App Group container, then the Glaze default.
  /// T146: every load (timeline, snapshot, placeholder) also records what it rendered, so the app's
  /// Widgets tab can tell whether the widgets see its App Group (widget link check).
  static func load() -> WidgetTheme {
    let found = loadWithSource()
    recordRead(themeId: found.theme.themeId, source: found.source)
    return found.theme
  }

  /// The theme plus where it came from: "defaults", "file" or "fallback".
  private static func loadWithSource() -> (theme: WidgetTheme, source: String) {
    if
      let defaults = UserDefaults(suiteName: GlazeShared.appGroup),
      let json = defaults.string(forKey: GlazeShared.themeKey),
      let data = json.data(using: .utf8),
      let theme = decode(data)
    {
      return (theme, "defaults")
    }
    if
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup),
      let data = try? Data(contentsOf: container.appendingPathComponent(GlazeShared.themeFile)),
      let theme = decode(data)
    {
      return (theme, "file")
    }
    return (.fallback, "fallback")
  }

  /// T146: writes {at, themeId, source} as a JSON string to `glaze.widget.lastRead.v1` in the App
  /// Group UserDefaults. Cheap and silent: any failure just skips the write. Without the App Group
  /// entitlement the suite is private to the extension, so the app never sees the record (which is
  /// itself the answer the link check needs).
  private static func recordRead(themeId: String, source: String) {
    guard let defaults = UserDefaults(suiteName: GlazeShared.appGroup) else { return }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let payload: [String: String] = [
      "at": formatter.string(from: Date()),
      "themeId": themeId,
      "source": source,
    ]
    guard
      JSONSerialization.isValidJSONObject(payload),
      let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
      let json = String(data: data, encoding: .utf8)
    else { return }
    defaults.set(json, forKey: GlazeShared.lastReadKey)
  }

  private static func decode(_ data: Data) -> WidgetTheme? {
    guard let theme = try? JSONDecoder().decode(WidgetTheme.self, from: data), theme.v == 1 else { return nil }
    return theme
  }

  /// The photo the app saved for the Photo widget, if any.
  static func loadPhoto() -> UIImage? {
    guard
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)
    else { return nil }
    let url = container.appendingPathComponent(GlazeShared.photoFile)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }
}

// MARK: - Hex colours

/// T125: hex maths for the pale-background rule (mirrors src/core/colour.ts).
enum GlazeHex {
  static func rgb(_ input: String) -> (r: Double, g: Double, b: Double)? {
    var s = input.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
    var value: UInt64 = 0
    guard s.count == 6, Scanner(string: s).scanHexInt64(&value) else { return nil }
    return (
      r: Double((value >> 16) & 0xFF) / 255,
      g: Double((value >> 8) & 0xFF) / 255,
      b: Double(value & 0xFF) / 255
    )
  }

  /// WCAG relative luminance, 0 (black) to 1 (white). Unreadable input counts as dark.
  static func luminance(_ hex: String) -> Double {
    guard let c = rgb(hex) else { return 0 }
    return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b)
  }

  /// Linear sRGB-space mix: t = 0 gives a, t = 1 gives b. `#RRGGBB`.
  static func mix(_ a: String, _ b: String, _ t: Double) -> String {
    guard let x = rgb(a), let y = rgb(b) else { return a }
    let k = min(max(t, 0), 1)
    let r = channel(x.r + (y.r - x.r) * k)
    let g = channel(x.g + (y.g - x.g) * k)
    let bl = channel(x.b + (y.b - x.b) * k)
    return String(format: "#%02X%02X%02X", r, g, bl)
  }

  private static func linear(_ v: Double) -> Double {
    v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
  }

  private static func channel(_ v: Double) -> Int32 {
    Int32(min(max((v * 255).rounded(), 0), 255))
  }
}

extension Color {
  static func isHex(_ input: String) -> Bool {
    var s = input.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 3 || s.count == 6 else { return false }
    return s.allSatisfy { $0.isHexDigit }
  }

  init(hex input: String) {
    var s = input.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
    var value: UInt64 = 0
    guard s.count == 6, Scanner(string: s).scanHexInt64(&value) else {
      self = .gray
      return
    }
    self.init(
      .sRGB,
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255,
      opacity: 1
    )
  }
}

// MARK: - Shared timeline entry + background

struct GlazeEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
}

/// Background for a theme's widget style. Applied through containerBackground (iOS 17).
struct GlazeBackground: View {
  let theme: WidgetTheme

  var body: some View {
    // T125: always two stops (pale themes get an accent-tinted second stop), corner to corner.
    let fill = LinearGradient(
      colors: theme.backgroundColors,
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
    switch theme.style {
    case .solid:
      fill
    case .glass:
      // Material over the theme gradient. VERIFY: materials inside widgets render as a flat
      // blur of the widget's own content (no Home Screen wallpaper shows through).
      ZStack {
        fill
        Rectangle().fill(.ultraThinMaterial)
        theme.accentColor.opacity(0.08)
      }
    case .outline:
      ZStack {
        fill
        ContainerRelativeShape()
          .inset(by: 5)
          .strokeBorder(theme.accentColor, lineWidth: 2)
      }
    }
  }
}
