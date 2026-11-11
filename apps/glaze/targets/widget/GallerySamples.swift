// Owner 2026-11-11 ("ok - make it generic - variations"): iOS keeps its own copies of the Add Widget
// gallery's previews and redraws them only when it chooses (no API forces it), so a gallery that
// showed the current theme went stale after a swap. Every Glaze gallery preview (snapshot with
// context.isPreview, and the placeholder) now draws a FIXED sample from this file: never the theme,
// never an App Group file. A spread of palettes and drawn art keeps the gallery varied. Widgets on
// the Home Screen are unchanged: they read the current theme as before.
import SwiftUI
import WidgetKit

enum GallerySample {
  /// Prefix of every sample theme id. ThemeStore.savedDesign / the Photo widget check it, so a
  /// preview never reads widgets.json or the person's photo.
  static let idPrefix = "gallery-sample-"

  private static func make(_ id: String, _ bg: [String], surface: String, accent: String, ink: String,
                           style: WidgetSurfaceStyle, font: WidgetFontChoice) -> WidgetTheme {
    var t = WidgetTheme()
    t.themeId = idPrefix + id
    t.bg = bg
    t.surface = surface
    t.accent = accent
    t.ink = ink
    t.style = style
    t.font = font
    return t
  }

  /// Six fixed palettes, deep and light, warm and cool.
  static let themes: [WidgetTheme] = [
    make("ink", ["#1F2433", "#3A4256"], surface: "#151925", accent: "#F2C46D", ink: "#F5F1E8", style: .glass, font: .display),
    make("sand", ["#E9DFCF", "#CDBBA0"], surface: "#F6F0E6", accent: "#B4532A", ink: "#2B2420", style: .solid, font: .body),
    make("sage", ["#5E7461", "#9DB09A"], surface: "#3F5243", accent: "#F3E3B5", ink: "#F7F5EE", style: .solid, font: .display),
    make("dusk", ["#3B2F4A", "#B0697A"], surface: "#2A2036", accent: "#FFD3B0", ink: "#FFF4EC", style: .glass, font: .display),
    make("slate", ["#2E3A40", "#5B7079"], surface: "#1F282C", accent: "#8FD3C8", ink: "#EEF4F3", style: .outline, font: .body),
    make("clay", ["#B8674A", "#E2A47C"], surface: "#8E4A33", accent: "#FFF1DE", ink: "#FFF8F1", style: .solid, font: .display),
  ]

  static func theme(_ variant: Int) -> WidgetTheme {
    themes[((variant % themes.count) + themes.count) % themes.count]
  }

  static func entry(_ variant: Int) -> GlazeEntry {
    GlazeEntry(date: Date(), theme: theme(variant))
  }

  /// The theme Clock / Battery / Calendar gallery tiles: the generic designed faces (no theme
  /// identity drawing) in a fixed palette each.
  static func design(kind: String) -> DesignedWidgetSpec {
    switch kind {
    case "battery":
      return DesignedWidgetSpec(kind: "battery", background: ["#5E7461", "#9DB09A"], ink: "#F7F5EE", secondary: "#DCE5D8",
        accent: "#F3E3B5", onAccent: "#2E3B31", line: "#C9D6C5", motif: "leaf", font: "rounded", clock: "dial", battery: "ring", identity: nil)
    case "calendar":
      return DesignedWidgetSpec(kind: "calendar", background: ["#E9DFCF", "#CDBBA0"], ink: "#2B2420", secondary: "#6B5D50",
        accent: "#B4532A", onAccent: "#FFF6EE", line: "#B9A68C", motif: "flower", font: "serif", clock: "dial", battery: "ring", identity: nil)
    default:
      return DesignedWidgetSpec(kind: "clock", background: ["#1F2433", "#3A4256"], ink: "#F5F1E8", secondary: "#B9BFCF",
        accent: "#F2C46D", onAccent: "#1F2433", line: "#59627A", motif: "stars", font: "rounded", clock: "dial", battery: "ring", identity: nil)
    }
  }
}

extension WidgetTheme {
  /// A fixed gallery sample (GallerySample), not the person's theme.
  var isGallerySample: Bool { themeId.hasPrefix(GallerySample.idPrefix) }
}

/// The Art / Seamless gallery tiles: a small drawn scene per variant, bundled in the extension.
struct GallerySampleArt: View {
  let variant: Int

  private static func c(_ hex: String) -> Color { Color(hex: hex) }

  var body: some View {
    let v = ((variant % 6) + 6) % 6
    GeometryReader { geo in
      let w = geo.size.width, h = geo.size.height, s = min(w, h)
      ZStack {
        switch v {
        case 0: moon(w: w, h: h, s: s)
        case 1: sun(w: w, h: h, s: s)
        case 2: planet(w: w, h: h, s: s)
        case 3: waves(w: w, h: h)
        case 4: peaks(w: w, h: h, s: s)
        default: stars(w: w, h: h, s: s)
        }
      }
      .frame(width: w, height: h)
      .clipped()
    }
    .accessibilityHidden(true)
  }

  /// The same gradient as the scene's sky, for containerBackground.
  static func backdrop(_ variant: Int) -> LinearGradient {
    let skies: [[String]] = [
      ["#141A2E", "#2C3554"], ["#F4D9B8", "#E59E73"], ["#0F1220", "#28224A"],
      ["#CFE6E3", "#6FA7A6"], ["#3B2F4A", "#C27C7E"], ["#0B1022", "#1E2A4A"],
    ]
    let sky = skies[((variant % 6) + 6) % 6]
    return LinearGradient(colors: sky.map(c), startPoint: .top, endPoint: .bottom)
  }

  @ViewBuilder private func moon(w: CGFloat, h: CGFloat, s: CGFloat) -> some View {
    Self.backdrop(0)
    Circle().fill(Self.c("#F4EBD0")).frame(width: s * 0.3, height: s * 0.3)
      .shadow(color: Self.c("#F4EBD0").opacity(0.6), radius: s * 0.08)
      .position(x: w * 0.68, y: h * 0.3)
    Ellipse().fill(Self.c("#2F3B5C")).frame(width: w * 1.3, height: h * 0.55).position(x: w * 0.25, y: h * 1.0)
    Ellipse().fill(Self.c("#222B45")).frame(width: w * 1.2, height: h * 0.45).position(x: w * 0.85, y: h * 1.05)
  }

  @ViewBuilder private func sun(w: CGFloat, h: CGFloat, s: CGFloat) -> some View {
    Self.backdrop(1)
    ForEach(0..<3, id: \.self) { i in
      Circle().stroke(Self.c("#FFF3E0").opacity(0.5 - Double(i) * 0.14), lineWidth: s * 0.02)
        .frame(width: s * (0.5 + CGFloat(i) * 0.22), height: s * (0.5 + CGFloat(i) * 0.22))
        .position(x: w * 0.5, y: h * 0.55)
    }
    Circle().fill(Self.c("#C9532E")).frame(width: s * 0.36, height: s * 0.36).position(x: w * 0.5, y: h * 0.55)
  }

  @ViewBuilder private func planet(w: CGFloat, h: CGFloat, s: CGFloat) -> some View {
    Self.backdrop(2)
    Circle()
      .fill(LinearGradient(colors: [Self.c("#E8B07A"), Self.c("#8C4E7A")], startPoint: .topLeading, endPoint: .bottomTrailing))
      .frame(width: s * 0.46, height: s * 0.46)
      .position(x: w * 0.5, y: h * 0.5)
    Ellipse().stroke(Self.c("#F1D9C0").opacity(0.8), lineWidth: s * 0.025)
      .frame(width: s * 0.82, height: s * 0.2)
      .rotationEffect(.degrees(-18))
      .position(x: w * 0.5, y: h * 0.5)
  }

  @ViewBuilder private func waves(w: CGFloat, h: CGFloat) -> some View {
    Self.backdrop(3)
    ForEach(0..<3, id: \.self) { i in
      let y = h * (0.55 + CGFloat(i) * 0.15)
      Path { p in
        p.move(to: CGPoint(x: 0, y: y))
        p.addCurve(to: CGPoint(x: w, y: y), control1: CGPoint(x: w * 0.3, y: y - h * 0.12), control2: CGPoint(x: w * 0.7, y: y + h * 0.12))
        p.addLine(to: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: 0, y: h))
        p.closeSubpath()
      }
      .fill(Self.c(["#4F8E8F", "#2F6B70", "#1D4A52"][i]))
    }
  }

  @ViewBuilder private func peaks(w: CGFloat, h: CGFloat, s: CGFloat) -> some View {
    Self.backdrop(4)
    Circle().fill(Self.c("#FFD3B0")).frame(width: s * 0.22, height: s * 0.22).position(x: w * 0.3, y: h * 0.38)
    Path { p in
      p.move(to: CGPoint(x: 0, y: h))
      p.addLine(to: CGPoint(x: w * 0.35, y: h * 0.5))
      p.addLine(to: CGPoint(x: w * 0.6, y: h * 0.72))
      p.addLine(to: CGPoint(x: w * 0.8, y: h * 0.45))
      p.addLine(to: CGPoint(x: w, y: h * 0.65))
      p.addLine(to: CGPoint(x: w, y: h))
      p.closeSubpath()
    }
    .fill(Self.c("#2A2036"))
  }

  @ViewBuilder private func stars(w: CGFloat, h: CGFloat, s: CGFloat) -> some View {
    Self.backdrop(5)
    let points: [CGPoint] = [
      CGPoint(x: 0.2, y: 0.3), CGPoint(x: 0.38, y: 0.22), CGPoint(x: 0.55, y: 0.38),
      CGPoint(x: 0.7, y: 0.3), CGPoint(x: 0.78, y: 0.55), CGPoint(x: 0.6, y: 0.7),
    ]
    Path { p in
      for (i, q) in points.enumerated() {
        let pt = CGPoint(x: q.x * w, y: q.y * h)
        if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
      }
    }
    .stroke(Self.c("#9FB4E8").opacity(0.6), lineWidth: s * 0.01)
    ForEach(0..<points.count, id: \.self) { i in
      Circle().fill(Self.c("#F2F5FF")).frame(width: s * 0.035, height: s * 0.035)
        .position(x: points[i].x * w, y: points[i].y * h)
    }
  }
}
