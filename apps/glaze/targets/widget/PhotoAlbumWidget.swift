import AppIntents
import CryptoKit
import Foundation
import ImageIO
import SwiftUI
import UIKit
import WidgetKit

enum PhotoAlbumStore {
  static var container: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup) }
  static func cursorURL(_ design: SavedWidgetDesign, in folder: URL) -> URL {
    let identity = design.albumID + "|" + design.albumRefs.joined(separator: "|")
    let key = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    return folder.appendingPathComponent("album-cursor-\(key).json")
  }
  static func offset(_ design: SavedWidgetDesign, in folder: URL?) -> Int {
    guard let folder, let data = try? Data(contentsOf: cursorURL(design, in: folder)),
          let n = try? JSONDecoder().decode(Int.self, from: data), n >= 0 else { return 0 }
    return n % max(1, design.albumRefs.count)
  }
  @discardableResult static func advance(_ design: SavedWidgetDesign, in folder: URL?) -> Bool {
    guard let folder, design.albumRefs.count > 1 else { return false }
    var failure: NSError?
    var wrote = false
    let url = cursorURL(design, in: folder)
    NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &failure) { target in
      let next = (offset(design, in: folder) + 1) % design.albumRefs.count
      if let data = try? JSONEncoder().encode(next) {
        do { try data.write(to: target, options: .atomic); wrote = true } catch { wrote = false }
      }
    }
    return failure == nil && wrote
  }
  static func image(_ ref: String?, in folder: URL? = container) -> UIImage? {
    guard let ref, PhotoAlbumModel.validRef(ref), let folder,
          let source = CGImageSourceCreateWithURL(folder.appendingPathComponent(ref) as CFURL,
            [kCGImageSourceShouldCache: false] as CFDictionary),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 1200, kCGImageSourceShouldCacheImmediately: true] as CFDictionary) else { return nil }
    return UIImage(cgImage: image)
  }
}

struct NextAlbumPhotoIntent: AppIntent {
  static var title: LocalizedStringResource = "Next photo"
  static var isDiscoverable: Bool = false
  @Parameter(title: "Widget size") var size: String
  init() {}
  init(size: String) { self.size = size }
  func perform() async throws -> some IntentResult {
    let family: WidgetFamily
    switch size { case "medium": family = .systemMedium; case "large": family = .systemLarge; default: return .result() }
    if let design = ThemeStore.savedDesign(kind: "photoAlbum", family: family, theme: ThemeStore.load()),
       PhotoAlbumStore.advance(design, in: PhotoAlbumStore.container) {
      WidgetCenter.shared.reloadTimelines(ofKind: "GlazePhotoAlbum")
    }
    return .result()
  }
}

struct PhotoAlbumEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  let design: SavedWidgetDesign?
  let photoRef: String?
}

struct PhotoAlbumProvider: TimelineProvider {
  func placeholder(in context: Context) -> PhotoAlbumEntry { PhotoAlbumEntry(date: Date(), theme: ThemeStore.load(), design: nil, photoRef: nil) }
  func entry(at date: Date, theme: WidgetTheme, design: SavedWidgetDesign?) -> PhotoAlbumEntry {
    let refs = design?.albumRefs ?? []
    let offset = design.map { PhotoAlbumStore.offset($0, in: PhotoAlbumStore.container) } ?? 0
    let index = PhotoAlbumModel.index(at: date, minutes: design?.albumMinutes ?? 60, count: refs.count, offset: offset)
    return PhotoAlbumEntry(date: date, theme: theme, design: design, photoRef: refs.isEmpty ? nil : refs[index])
  }
  func getSnapshot(in context: Context, completion: @escaping (PhotoAlbumEntry) -> Void) {
    let theme = ThemeStore.load()
    completion(entry(at: Date(), theme: theme, design: ThemeStore.savedDesign(kind: "photoAlbum", family: context.family, theme: theme)))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoAlbumEntry>) -> Void) {
    let theme = ThemeStore.load()
    let design = ThemeStore.savedDesign(kind: "photoAlbum", family: context.family, theme: theme)
    let now = Date(), minutes = design?.albumMinutes ?? 60
    let next = PhotoAlbumModel.nextBoundary(after: now, minutes: minutes)
    let dates = [now] + (0..<12).map { next.addingTimeInterval(Double($0 * minutes * 60)) }
    // Entries hold filenames, never twelve decoded images. WidgetKit controls actual presentation time.
    completion(Timeline(entries: dates.map { entry(at: $0, theme: theme, design: design) },
      policy: .after(next.addingTimeInterval(Double(12 * minutes * 60)))))
  }
}

struct PhotoAlbumWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: PhotoAlbumEntry
  /// Isolated render-contract fixture only; production loads the bounded shared JPEG.
  var reviewImage: UIImage? = nil
  var body: some View {
    let image = reviewImage ?? PhotoAlbumStore.image(entry.photoRef)
    let emptyTheme = albumPlaceholderTheme(entry.theme)
    Group {
      if let design = entry.design, let image {
        SavedWidgetView(design: design, date: entry.date, albumImage: image)
      } else {
        VStack(alignment: .leading, spacing: 8) {
          Image(systemName: "photo.on.rectangle.angled").font(.system(size: 24))
          Text("Choose album photos in Glaze").font(.system(size: 14, weight: .semibold)).lineLimit(4).minimumScaleFactor(0.75)
        }.foregroundStyle(emptyTheme.inkColor).padding(16)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
          .containerBackground(for: .widget) { GlazeBackground(theme: emptyTheme) }
      }
    }
    .widgetURL(URL(string: "glaze://widgets"))
  }
}

/// Empty albums keep the palette's real stops; system glass can wash them out unpredictably.
func albumPlaceholderTheme(_ theme: WidgetTheme) -> WidgetTheme {
  var result = theme
  result.style = .solid
  result.ink = HabitColours.resolve(theme.ink, stops: theme.backgroundHexes, secondary: false)
  return result
}

struct PhotoAlbumWidget: Widget {
  let kind = "GlazePhotoAlbum"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PhotoAlbumProvider()) { PhotoAlbumWidgetView(entry: $0) }
      .configurationDisplayName("Photo album")
      .description("Your selected photos, changing through the day.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
      .legacyGlazeGallery()
      .contentMarginsDisabled()
  }
}
