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
// T223: every family (small, medium, large, extra large) and every source (chosen piece or the
// per-size file) goes through the one view below: the art is FITTED whole (scaledToFit) over a
// blurred aspect-filled copy of itself, never cropped.
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
  static func load(_ family: WidgetFamily) -> UIImage? {
    guard
      let name = familyName(family),
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)
    else { return nil }
    let url = container.appendingPathComponent("seamless-\(name).png")
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }
}

struct SeamlessWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let theme: WidgetTheme
  /// T221: the piece chosen in Edit Widget (nil = the last applied image for this size).
  let pieceID: String?

  var body: some View {
    let t = theme
    let image = WidgetArtStore.load(pieceID) ?? SeamlessStore.load(family)
    ZStack(alignment: .bottomLeading) {
      if image == nil {
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
    .containerBackground(for: .widget) {
      if let image = image {
        // T187 (owner-1101 #5: art is fitted, never cropped): the file is made at the widget's
        // aspect, but a device whose widget shape differs a little must not cut it. Fit the image
        // whole over a blurred copy of itself on the theme background, so no edge shows either.
        // T201 (owner-1101d #4): both layers are pinned to the widget's own size, so the
        // aspect-filled blur (background only) can never grow the stack and push the fitted
        // art past the widget's edges.
        GeometryReader { geo in
          ZStack {
            GlazeBackground(theme: t)
            Image(uiImage: image)
              .resizable()
              .scaledToFill()
              .frame(width: geo.size.width, height: geo.size.height)
              .clipped()
              .blur(radius: 16)
              .opacity(0.85)
            Image(uiImage: image)
              .resizable()
              .scaledToFit()
              .frame(width: geo.size.width, height: geo.size.height)
          }
          .frame(width: geo.size.width, height: geo.size.height)
          .clipped()
        }
      } else {
        GlazeBackground(theme: t)
      }
    }
  }
}

@available(iOS 17.0, *)
struct SeamlessWidget: Widget {
  let kind = "GlazeSeamless"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ChooseWidgetArtIntent.self, provider: ArtProvider()) { entry in
      SeamlessWidgetView(theme: entry.theme, pieceID: entry.pieceID)
    }
    .configurationDisplayName("Seamless")
    .description("Your Glaze art. Long-press and choose Edit Widget to pick a piece.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
    .contentMarginsDisabled()
  }
}
