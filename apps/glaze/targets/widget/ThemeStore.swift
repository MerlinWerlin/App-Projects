// Reads the active Glaze theme that the app writes into the App Group.
// Writer: modules/glaze-widget-bridge (UserDefaults suite `group.com.jared797.glaze`, key `glaze.theme.v1`).
// Schema: src/core/widgetTheme.ts (WidgetTheme v1). Decoding is tolerant: any missing or invalid
// field falls back to the Porcelain defaults below, matching DEFAULT_WIDGET_THEME in TS.
import Foundation
import SwiftUI
import UIKit
import WidgetKit

enum GlazeShared {
  static let appGroup = "group.com.jared797.glaze"
  static let themeKey = "glaze.theme.v1"
  static let photoFile = "widget-photo.jpg"
}

enum WidgetSurfaceStyle: String {
  case glass, solid, outline
}

enum WidgetFontChoice: String {
  case display, body
}

struct WidgetTheme: Decodable {
  var v: Int = 1
  var themeId: String = "porcelain"
  var name: String = "Porcelain"
  var bg: [String] = ["#F6F3F5", "#FFFFFF"]
  var surface: String = "#FFFFFF"
  var accent: String = "#7A2E6B"
  var ink: String = "#1E1A1D"
  var style: WidgetSurfaceStyle = .solid
  var font: WidgetFontChoice = .display
  var updatedAt: String = "1970-01-01T00:00:00.000Z"

  static let fallback = WidgetTheme()

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
  /// Reads and decodes the theme; never fails (falls back to Porcelain).
  static func load() -> WidgetTheme {
    guard
      let defaults = UserDefaults(suiteName: GlazeShared.appGroup),
      let json = defaults.string(forKey: GlazeShared.themeKey),
      let data = json.data(using: .utf8),
      let theme = try? JSONDecoder().decode(WidgetTheme.self, from: data),
      theme.v == 1
    else { return .fallback }
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
    let colors = theme.bgColors
    let fill = LinearGradient(
      colors: colors.count > 1 ? colors : [colors.first ?? .gray, colors.first ?? .gray],
      startPoint: .top,
      endPoint: .bottom
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
