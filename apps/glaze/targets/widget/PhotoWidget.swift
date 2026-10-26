// Photo: the image the app saved into the App Group (widget-photo.jpg), edge to edge.
// Without one, a gradient in the theme colours with a hint to pick a photo in Glaze.
import SwiftUI
import WidgetKit

struct PhotoWidgetView: View {
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let photo = ThemeStore.loadPhoto()
    ZStack(alignment: .bottomLeading) {
      if photo == nil {
        VStack(alignment: .leading, spacing: 4) {
          Image(systemName: "photo")
            .font(.system(size: 18, weight: .semibold))
          Text("Choose a photo in Glaze")
            .font(t.typeface(size: 12, weight: .semibold))
        }
        .foregroundStyle(t.inkColor.opacity(0.8))
        .padding(14)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
    .containerBackground(for: .widget) {
      if let photo {
        Image(uiImage: photo)
          .resizable()
          .scaledToFill()
      } else {
        // T125: the theme's own gradient with an accent corner, so it reads as the theme.
        ZStack {
          GlazeBackground(theme: t)
          RadialGradient(
            colors: [t.accentColor.opacity(0.55), t.accentColor.opacity(0)],
            center: .topTrailing,
            startRadius: 0,
            endRadius: 180
          )
        }
      }
    }
  }
}

struct PhotoWidget: Widget {
  let kind = "GlazePhoto"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StaticProvider()) { entry in
      GlazeDesignedWidget(kind: "photo", entry: entry) { PhotoWidgetView(entry: entry) }
    }
    .configurationDisplayName("Photo")
    .description("A photo you pick in Glaze.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
