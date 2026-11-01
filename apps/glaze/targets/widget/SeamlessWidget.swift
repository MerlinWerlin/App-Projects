// T131 Seamless widget (docs/WIDGETS.md "Seamless widget"): the image the app composed for this
// widget size (the piece of the wallpaper under the widget's Home Screen slot, with the theme's
// transparent hero art on top), edge to edge, so the widget blends into the wallpaper.
// Writer: modules/glaze-widget-bridge `setSeamless` → App Group file seamless-<family>.png
// (keep in sync with src/core/seamlessWidget.ts seamlessFileName / SEAMLESS_WIDGET_KIND).
// Without a file: the theme background and a short "Set up in Glaze" hint.
// T221 (owner-1101e): iOS 17 AppIntentConfiguration (WidgetArtLibrary.swift). Each widget can pick
// its own piece from "My widget art" (long-press > Edit Widget > Art); with no piece chosen, or one
// removed from the library, it shows the last applied image for its size as before. Same kind
// ("GlazeSeamless"), so widgets already on the Home Screen keep working.
// T259: after a theme swap a widget with no piece chosen follows the new theme (index.json
// `unpinned`, written by the app): the theme's first piece for its size (ArtProvider resolves it),
// else the theme's plain background; the app writing seamless-<size>.png again restores that image.
// T223: every family (small, medium, large, extra large) and every source (chosen piece or the
// per-size file) goes through the one view below.
// T236 (owner-1101g #1): Edit Widget > Layout. Fill (default): the composed image, which the bridge
// now makes full bleed (art whole + its own edges extended, no inset, no veil), edge to edge over a
// full-opacity blur of itself: no grey/light frame ever, subject never cut. Fit: the raw art
// (<id>-art.png / seamless-<family>-art.png, else the composed image) whole, inset, on the theme.
// T251 (owner-1101h #2): art BLENDS with the wallpaper. The bridge keys / feathers the art
// (GlazeArtBlend) over the wallpaper crop under the widget; this view adds nothing round it: no
// blurred copy (the old light-grey frame), no border, no shadow, no material panel (ArtBackdrop).
// The three SwiftUI string literals below are localised like the other widgets' (looked up by
// their English text in targets/widget/<lang>.lproj/Localizable.strings; T133).
import SwiftUI
import UIKit
import WidgetKit

enum SeamlessStore {
  /// "small" / "medium" / "large" for the Home Screen families; nil for anything else.
  static func familyName(_ family: WidgetFamily) -> String? {
    switch family {
    case .systemSmall: return "small"
    case .systemMedium: return "medium"
    case .systemLarge: return "large"
    // iPad only. No file is composed at this size; the large one is fitted into it.
    case .systemExtraLarge: return "large"
    default: return nil
    }
  }

  /// The composed image for this family, if the app has written one.
  /// T259: nil after a swap to a theme with no piece of this size (index `unpinned`), so a widget
  /// with no chosen piece shows the theme's plain background, never the old theme's art.
  static func load(_ family: WidgetFamily) -> UIImage? {
    if WidgetArtStore.unpinnedShowsBackground(family) { return nil }
    guard
      let name = familyName(family),
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)
    else { return nil }
    let url = container.appendingPathComponent("seamless-\(name).png")
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  /// T236: the raw art behind this family's composed image (seamless-<family>-art.png, written by
  /// setWidgetArt, removed by setSeamless), for the Fit layout. nil = fit the composed image.
  static func loadArt(_ family: WidgetFamily) -> UIImage? {
    if WidgetArtStore.unpinnedShowsBackground(family) { return nil }
    guard
      let name = familyName(family),
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)
    else { return nil }
    let url = container.appendingPathComponent("seamless-\(name)-art.png")
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }
}

/// T236: Fill draws the image edge to edge only when its aspect is within this of the widget's
/// (the composed file is made at the widget's aspect); otherwise (iPad extra large shows the large
/// file, or a device whose widget shape differs) the image is fitted whole over a full-opacity
/// blurred fill of itself, so the subject is never cut and no light frame shows.
private let seamlessFillMinAspectMatch: CGFloat = 0.97

struct SeamlessWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let theme: WidgetTheme
  /// T221: the piece chosen in Edit Widget (nil = the last applied image for this size).
  let pieceID: String?
  /// T236: Edit Widget > Layout. nil = .fill.
  var layout: ArtLayout? = nil

  /// 0-1, 1 = same aspect (same rule as src/core/widgetOptions.ts aspectMatch).
  static func aspectMatch(_ a: CGSize, _ b: CGSize) -> CGFloat {
    guard a.width > 0, a.height > 0, b.width > 0, b.height > 0 else { return 1 }
    let x = a.width / a.height
    let y = b.width / b.height
    return min(x, y) / max(x, y)
  }
  /// T237: the timeline entry's date (live values over the art, LiveArtOverlay.swift).
  var date: Date = Date()

  var body: some View {
    let t = theme
    let image = WidgetArtStore.load(pieceID, preferSize: SeamlessStore.familyName(family)) ?? SeamlessStore.load(family)
    let fit = layout == .fit
    let live = LiveArtStore.spec(pieceID: pieceID, family: family) != nil
    // Fit only: the raw art of the same source (piece or per-size file), else the composed image.
    // Not loaded for Fill (widget memory budget).
    let raw: UIImage? = fit && !live ? (WidgetArtStore.has(pieceID) ? WidgetArtStore.loadArt(pieceID) : SeamlessStore.loadArt(family)) : nil
    ZStack(alignment: .bottomLeading) {
      // T259: following a theme with no piece of this size = its plain background, no hint.
      if image == nil && !WidgetArtStore.unpinnedShowsBackground(family) {
        VStack(alignment: .leading, spacing: 4) {
          Image(systemName: "sparkles")
            .font(.system(size: 18, weight: .semibold))
          Text("Set up in Glaze")
            .font(t.typeface(size: 12, weight: .semibold))
        }
        .foregroundStyle(t.inkColor.opacity(0.85))
        .padding(14)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
    // T237: the live value (time, date, battery, countdown, focus timer) over a piece that has one;
    // nothing for plain art. In the content (not the background) so the focus Button can be tapped.
    .overlay {
      // Live Fit retains the composed image and shares its inset with this layer.
      // Switching layout must not freeze a clock or reveal its painted sample value.
      if let image = image {
        if #available(iOS 17.0, *) {
          LiveArtLayer(pieceID: pieceID, imageSize: image.size, theme: t, date: date, insetFraction: fit ? 0.06 : 0)
        }
      }
    }
    .containerBackground(for: .widget) {
      if let image = image {
        // T201 (owner-1101d #4): every layer is pinned to the widget's own size, so an aspect-filled
        // layer can never grow the stack and push the art past the widget's edges.
        GeometryReader { geo in
          let size = geo.size
          if fit {
            // T236 Fit: the whole raw art, small inset. T251: the raw art is the BLENDED art (keyed /
            // feathered by the bridge, transparent edges), on the plain wallpaper-sampled theme
            // gradient (ArtBackdrop: no material panel, no outline), so no box shows round it.
            let inset = min(size.width, size.height) * 0.06
            ZStack {
              ArtBackdrop(theme: t)
              Image(uiImage: raw ?? image)
                .resizable()
                .scaledToFit()
                .padding(inset)
                .frame(width: size.width, height: size.height)
            }
            .frame(width: size.width, height: size.height)
            .clipped()
          } else {
            // T236 Fill (default). T251 (owner-1101h #2): the composed file (the wallpaper crop under
            // the widget, or the theme colour, with the blended art on it) goes edge to edge. NO
            // blurred copy behind it any more: that blur of a black square with a white moon was the
            // light-grey frame. When the shapes differ (iPad extra large, older pieces) the image is
            // fitted whole over the plain theme gradient (ArtBackdrop), never a grey/white box.
            let edgeToEdge = SeamlessWidgetView.aspectMatch(image.size, size) >= seamlessFillMinAspectMatch
            ZStack {
              ArtBackdrop(theme: t)
              if edgeToEdge {
                Image(uiImage: image)
                  .resizable()
                  .scaledToFill()
                  .frame(width: size.width, height: size.height)
                  .clipped()
              } else {
                Image(uiImage: image)
                  .resizable()
                  .scaledToFit()
                  .frame(width: size.width, height: size.height)
              }
            }
            .frame(width: size.width, height: size.height)
            .clipped()
          }
        }
      } else {
        GlazeBackground(theme: t)
      }
    }
  }
}

/// T251: what sits behind widget art. The theme's own two colours (sampled from its wallpaper) as a
/// plain corner-to-corner gradient: no material panel (glass), no outline stroke, no blur, no shadow,
/// so art never gets a frame or a box from the widget itself.
struct ArtBackdrop: View {
  let theme: WidgetTheme

  var body: some View {
    LinearGradient(colors: theme.backgroundColors, startPoint: .topLeading, endPoint: .bottomTrailing)
  }
}

@available(iOS 17.0, *)
struct SeamlessWidget: Widget {
  let kind = "GlazeSeamless"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ChooseWidgetArtIntent.self, provider: ArtProvider()) { entry in
      SeamlessWidgetView(theme: entry.theme, pieceID: entry.pieceID, layout: entry.layout, date: entry.date)
    }
    .configurationDisplayName("Seamless")
    .description("Your Glaze art. Long-press and choose Edit Widget to pick a piece.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
    .contentMarginsDisabled()
  }
}
