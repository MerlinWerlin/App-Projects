// Owner 2026-11-15 ("make your own theme, be creative"): five Home Screen widgets, "Custom 1" to
// "Custom 5", each showing a picture the person added to that slot in Glaze (Widgets tab > Your
// artwork). The pictures stay on the device: the app's bridge (GlazeWidgetBridgeModule
// setCustomArt / clearCustomArt) writes a square JPEG of at most CustomArtStore.maxPixels into the
// App Group's custom-art folder, records it in custom-art/slots.json and reloads every timeline.
//
// Rules kept from the Artwork kinds (ThemeArtWidgets.swift):
// - Small only, fresh fixed kinds (GlazeCustom1-5), never touched by the Artwork slots.
// - FIXED, fully written-out display names (displayName below): an interpolated name made Glaze
//   vanish from the Add Widget list in 1.0.24 (PR #283).
// - Registered in GlazePersonalWidgetsBundle (GlazeWidgetsBundle.swift): the @main block is at its
//   9-entry limit, so there is no new nested bundle.
// - The gallery tile never reads a file: a drawn "+ your picture" tile with the slot number, so
//   the gallery costs no image memory and can never show someone's photo.
// - An empty or removed slot shows a calm "Add a picture in Glaze" card in the theme's colours,
//   never a grey tile.
import ImageIO
import SwiftUI
import WidgetKit

enum CustomArtStore {
  /// Owner 2026-11-27: Custom 1-5 small, 6-7 medium, 8-9 large (the same numbers as Artwork).
  static let slotCount = 9
  /// The long edge of a stored picture (the bridge writes at most this) and of the decode here.
  /// A small widget is at most ~170 pt (510 px at 3x), so 600 px is sharp and only ~1.4 MB decoded.
  static let maxPixels = 600
  /// Medium / large (364 pt wide, 1092 px at 3x): 1200 px, at most ~5.5 MB decoded.
  static let wideMaxPixels = 1200

  static func longEdge(slot: Int) -> Int { slot >= 6 ? wideMaxPixels : maxPixels }
  static let folder = "custom-art"
  static let manifest = "slots.json"

  private static func directory() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)?
      .appendingPathComponent(folder, isDirectory: true)
  }

  /// The file name the app saved for `slot` (1...5), if any. Names carry a fresh token per save,
  /// so a replaced picture is never served from an old cache.
  static func fileName(slot: Int) -> String? {
    guard
      (1...slotCount).contains(slot),
      let dir = directory(),
      let data = try? Data(contentsOf: dir.appendingPathComponent(manifest)),
      let map = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let name = map[String(slot)] as? String,
      !name.isEmpty, !name.contains("/"), !name.contains("..")
    else { return nil }
    return name
  }

  /// The slot's picture, decoded through ImageIO at no more than maxPixels (memory-safe even if a
  /// larger file were ever written). nil = empty slot.
  static func load(slot: Int) -> UIImage? {
    guard let name = fileName(slot: slot), let dir = directory() else { return nil }
    let url = dir.appendingPathComponent(name)
    guard
      FileManager.default.fileExists(atPath: url.path),
      let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: longEdge(slot: slot), kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
    else { return nil }
    return UIImage(cgImage: image)
  }
}

struct CustomArtEntry: TimelineEntry {
  let date: Date
  let slot: Int
  let theme: WidgetTheme
  /// The Add Widget gallery (isPreview snapshot and the placeholder): the drawn tile only.
  var preview: Bool = false
}

struct CustomArtProvider: TimelineProvider {
  let slot: Int

  private var galleryEntry: CustomArtEntry {
    CustomArtEntry(date: Date(), slot: slot, theme: GallerySample.theme(slot - 1), preview: true)
  }

  func placeholder(in context: Context) -> CustomArtEntry { galleryEntry }

  func getSnapshot(in context: Context, completion: @escaping (CustomArtEntry) -> Void) {
    completion(context.isPreview ? galleryEntry : CustomArtEntry(date: Date(), slot: slot, theme: ThemeStore.load()))
  }

  /// One entry; the app reloads every timeline when a picture is added, replaced or removed.
  func getTimeline(in context: Context, completion: @escaping (Timeline<CustomArtEntry>) -> Void) {
    completion(Timeline(entries: [CustomArtEntry(date: Date(), slot: slot, theme: ThemeStore.load())], policy: .never))
  }
}

/// The Add Widget gallery tile of Custom `slot`: a soft dashed frame, a plus and the slot number.
/// Distinct from Artwork's solid colour tiles, and it never reads the theme or any picture.
struct CustomSlotTile: View {
  let slot: Int

  static let fill = Color(hex: "#F4EFE8")
  static let ink = Color(hex: "#3B2F2A")

  var body: some View {
    GeometryReader { geo in
      let s = min(geo.size.width, geo.size.height)
      ZStack {
        RoundedRectangle(cornerRadius: s * 0.16, style: .continuous)
          .strokeBorder(Self.ink.opacity(0.35), style: StrokeStyle(lineWidth: max(1.5, s * 0.012), dash: [s * 0.05, s * 0.035]))
          .padding(s * 0.09)
        VStack(spacing: s * 0.03) {
          Image(systemName: "plus")
            .font(.system(size: s * 0.2, weight: .semibold))
          Text("Your picture")
            .font(.system(size: s * 0.085, weight: .semibold, design: .rounded))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        }
        .foregroundStyle(Self.ink.opacity(0.8))
        .padding(.horizontal, s * 0.14)
        Text(verbatim: "\(slot)")
          .font(.system(size: s * 0.12, weight: .heavy, design: .rounded))
          .foregroundStyle(Self.ink.opacity(0.7))
          .padding(.top, s * 0.14)
          .padding(.trailing, s * 0.16)
          .frame(width: geo.size.width, height: geo.size.height, alignment: .topTrailing)
      }
      .frame(width: geo.size.width, height: geo.size.height)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(CustomArtKind.displayName(slot: slot)))
  }
}

struct CustomArtSlotView: View {
  let entry: CustomArtEntry

  var body: some View {
    if entry.preview {
      CustomSlotTile(slot: entry.slot)
        .containerBackground(for: .widget) { CustomSlotTile.fill }
    } else if let image = CustomArtStore.load(slot: entry.slot) {
      Color.clear
        .overlay(Image(uiImage: image).resizable().scaledToFill())
        .clipped()
        .accessibilityHidden(true)
        .containerBackground(for: .widget) { Color.black }
    } else {
      // Empty or removed: a calm prompt in the theme's colours, never a grey tile.
      let t = entry.theme
      VStack(spacing: 8) {
        Image(systemName: "photo.badge.plus")
          .font(.system(size: 26, weight: .semibold))
          .foregroundStyle(t.accentColor)
        Text("Add a picture in Glaze")
          .font(t.typeface(size: 13, weight: .semibold))
          .foregroundStyle(t.inkColor.opacity(0.85))
          .multilineTextAlignment(.center)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
      }
      .padding(14)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .containerBackground(for: .widget) { GlazeBackground(theme: t) }
    }
  }
}

enum CustomArtKind {
  /// Fresh kinds, separate from GlazeArtwork1-5 and GlazeThemeArt1-6.
  static func kind(slot: Int) -> String {
    switch slot {
    case 1: return "GlazeCustom1"
    case 2: return "GlazeCustom2"
    case 3: return "GlazeCustom3"
    case 4: return "GlazeCustom4"
    case 6: return "GlazeCustom6"
    case 7: return "GlazeCustom7"
    case 8: return "GlazeCustom8"
    case 9: return "GlazeCustom9"
    default: return "GlazeCustom5"
    }
  }

  /// Owner 2026-11-27: 1-5 small, 6-7 medium, 8-9 large (ThemeArtKind.group, ARTWORK_GROUPS in TS).
  static func family(slot: Int) -> WidgetFamily {
    if slot >= 8 { return .systemLarge }
    if slot >= 6 { return .systemMedium }
    return .systemSmall
  }

  /// Fixed, fully written-out names: never an interpolated key (PR #283).
  static func displayName(slot: Int) -> LocalizedStringKey {
    switch slot {
    case 1: return "Custom 1"
    case 2: return "Custom 2"
    case 3: return "Custom 3"
    case 4: return "Custom 4"
    case 6: return "Custom 6"
    case 7: return "Custom 7"
    case 8: return "Custom 8"
    case 9: return "Custom 9"
    default: return "Custom 5"
    }
  }

  @MainActor static func configuration(slot: Int) -> some WidgetConfiguration {
    StaticConfiguration(kind: kind(slot: slot), provider: CustomArtProvider(slot: slot)) { entry in
      CustomArtSlotView(entry: entry)
        .widgetURL(URL(string: "glaze://widgets"))
    }
    .configurationDisplayName(displayName(slot: slot))
    .description("Your own picture, added in Glaze.")
    .supportedFamilies([family(slot: slot)])
    .contentMarginsDisabled()
  }
}

struct CustomArtWidget1: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 1) } }
struct CustomArtWidget2: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 2) } }
struct CustomArtWidget3: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 3) } }
struct CustomArtWidget4: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 4) } }
struct CustomArtWidget5: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 5) } }
// Owner 2026-11-27: Custom 6-7 (medium) and 8-9 (large).
struct CustomArtWidget6: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 6) } }
struct CustomArtWidget7: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 7) } }
struct CustomArtWidget8: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 8) } }
struct CustomArtWidget9: Widget { var body: some WidgetConfiguration { CustomArtKind.configuration(slot: 9) } }
// Registered in GlazeThemeGalleryBundle (GlazeWidgetsBundle.swift): GlazePersonalWidgetsBundle is
// at 7 entries and the @main block at its 9-entry limit.
