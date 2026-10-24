// T131 Seamless widget (docs/WIDGETS.md "Seamless widget"): the image the app composed for this
// widget size (the piece of the wallpaper under the widget's Home Screen slot, with the theme's
// transparent hero art on top), edge to edge, so the widget blends into the wallpaper.
// Writer: modules/glaze-widget-bridge `setSeamless` → App Group file seamless-<family>.png
// (keep in sync with src/core/seamlessWidget.ts seamlessFileName / SEAMLESS_WIDGET_KIND).
// Without a file: the theme background and a short "Set up in Glaze" hint.
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
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let image = SeamlessStore.load(family)
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
        // The file already has the widget's aspect; fill so no edge shows.
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
      } else {
        GlazeBackground(theme: t)
      }
    }
  }
}

struct SeamlessWidget: Widget {
  let kind = "GlazeSeamless"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StaticProvider()) { entry in
      SeamlessWidgetView(entry: entry)
    }
    .configurationDisplayName("Seamless")
    .description("Art that floats on your wallpaper. Set it up in Glaze.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
