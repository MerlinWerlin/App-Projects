// Photo frame (T282): the person's own photo (App Group widget-photo.jpg, ThemeStore.loadPhoto())
// set in a frame of the active theme: the theme background as the mat, an accent rule round a
// rounded inner photo, and (medium / large) a small date caption in the theme's typeface.
// Without a photo: the same frame, empty, with "Choose a photo in Glaze". Tapping either opens
// Widget Studio on the photo widget in the active theme (glaze://widget-studio?theme=…&kind=photo),
// where the photo is picked. The theme's name is never shown.
// DayProvider: one entry now and one at midnight, so the caption's date rolls over; the app reloads
// timelines when it saves a new photo.
import SwiftUI
import WidgetKit

/// Frame sizes per family (mat width round the photo, corner radius of the photo).
private struct PhotoFrameMetrics {
  let mat: CGFloat
  let radius: CGFloat
  let rule: CGFloat
  let caption: Bool

  static func of(_ family: WidgetFamily) -> PhotoFrameMetrics {
    switch family {
    case .systemLarge: return PhotoFrameMetrics(mat: 16, radius: 18, rule: 2.5, caption: true)
    case .systemMedium: return PhotoFrameMetrics(mat: 12, radius: 14, rule: 2, caption: true)
    default: return PhotoFrameMetrics(mat: 10, radius: 12, rule: 2, caption: false)
    }
  }
}

enum PhotoWidgetLink {
  /// Widget Studio on the photo widget, in the active theme and this size. nil if the URL can't be built.
  static func studio(themeId: String, family: WidgetFamily) -> URL? {
    let size: String
    switch family {
    case .systemLarge: size = "large"
    case .systemMedium: size = "medium"
    default: size = "small"
    }
    var c = URLComponents()
    c.scheme = "glaze"
    c.host = "widget-studio"
    c.queryItems = [
      URLQueryItem(name: "theme", value: themeId),
      URLQueryItem(name: "kind", value: "photo"),
      URLQueryItem(name: "size", value: size),
    ]
    return c.url
  }
}

struct PhotoWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GlazeEntry

  var body: some View {
    let t = entry.theme
    let m = PhotoFrameMetrics.of(family)
    // The gallery sample never shows the person's photo (iOS keeps gallery previews).
    let photo = t.isGallerySample ? nil : ThemeStore.loadPhoto()
    let shape = RoundedRectangle(cornerRadius: m.radius, style: .continuous)
    VStack(spacing: m.mat * 0.6) {
      ZStack {
        if let photo {
          // Color.clear sizes the frame; the photo fills it and is clipped to the rounded shape.
          Color.clear
            .overlay(
              Image(uiImage: photo)
                .resizable()
                .scaledToFill()
            )
            .clipShape(shape)
            .accessibilityHidden(true)
        } else {
          shape
            .fill(t.inkColor.opacity(0.08))
          VStack(spacing: 6) {
            Image(systemName: "photo.on.rectangle.angled")
              .font(.system(size: family == .systemSmall ? 20 : 26, weight: .semibold))
              .foregroundStyle(t.accentColor)
            Text("Choose a photo in Glaze")
              .font(t.typeface(size: family == .systemSmall ? 12 : 14, weight: .semibold))
              .foregroundStyle(t.inkColor.opacity(0.85))
              .multilineTextAlignment(.center)
              .lineLimit(2)
              .minimumScaleFactor(0.7)
          }
          .padding(10)
        }
      }
      .overlay(shape.strokeBorder(t.accentColor, lineWidth: m.rule))
      .frame(maxWidth: .infinity, maxHeight: .infinity)

      if m.caption {
        HStack(spacing: 6) {
          Capsule()
            .fill(t.accentColor)
            .frame(width: 14, height: 3)
          Text(entry.date, format: .dateTime.weekday(.wide).day().month(.wide))
            .font(t.typeface(size: family == .systemLarge ? 13 : 11, weight: .semibold))
            .foregroundStyle(t.inkColor.opacity(0.8))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          Spacer(minLength: 0)
        }
      }
    }
    .padding(m.mat)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(PhotoWidgetLink.studio(themeId: t.themeId, family: family))
    .containerBackground(for: .widget) {
      // The mat: the theme's own gradient with a soft accent corner.
      ZStack {
        GlazeBackground(theme: t)
        RadialGradient(
          colors: [t.accentColor.opacity(0.35), t.accentColor.opacity(0)],
          center: .topTrailing,
          startRadius: 0,
          endRadius: 200
        )
      }
    }
  }
}

struct PhotoWidget: Widget {
  let kind = "GlazePhoto"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DayProvider(sample: 1)) { entry in
      GlazeDesignedWidget(kind: "photo", entry: entry) { PhotoWidgetView(entry: entry) }
    }
    .configurationDisplayName("Photo")
    .description("A photo you pick in Glaze.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .legacyGlazeGallery()
    .contentMarginsDisabled()
  }
}
