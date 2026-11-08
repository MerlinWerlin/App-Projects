// Owner 2026-11-08: "I mainly care about the gallery." The theme's art pieces show in the Home
// Screen Add Widget gallery, one gallery page per piece, next to the theme Clock / Battery /
// Calendar. Since 1.0.5 (PR #242) the Seamless art widget is disfavoured on the Home Screen
// (legacyGlazeGallery), so its art never reached the gallery; Seamless keeps that so widgets already
// placed are untouched, and these kinds carry the art instead.
//
// WidgetKit's gallery can only show fixed kinds, so there are six: "Art" n shows the current theme's
// n-th art piece for its size (the Edit Widget order, the theme's native Clock / Battery / Calendar
// designs left out because they have their own gallery pages). Edit Widget > Art still picks any
// piece (the same ChooseWidgetArtIntent and view as Seamless). A slot the theme has no piece for
// shows the plain theme background, never a repeat of another piece.
// Kinds 2-6 are small and large only: theme packs draw their extra pieces square, and a square piece
// is never offered in the wide medium widget (src/core/widgetOptions.ts drawnForSize).
import ImageIO
import SwiftUI
import WidgetKit

@available(iOS 17.0, *)
enum ThemeArtSlots {
  /// The current theme's art pieces for this family, in Edit Widget order, designs left out.
  static func pieces(family: WidgetFamily) -> [String] {
    guard let size = SeamlessStore.familyName(family) else { return [] }
    return WidgetArtStore.snapshot().currentThemeRecords()
      .filter { $0.size == size }
      .filter { LiveArtStore.spec(pieceID: $0.id, family: family)?.design == nil }
      .map { $0.id }
  }

  /// The piece slot `slot` (1-based) shows when nothing is chosen in Edit Widget, else nil.
  static func piece(slot: Int, family: WidgetFamily) -> String? {
    let list = pieces(family: family)
    return slot >= 1 && slot <= list.count ? list[slot - 1] : nil
  }
}

@available(iOS 17.0, *)
struct ThemeArtEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// nil = this theme has no piece for the slot: the plain theme background.
  let pieceID: String?
  let layout: ArtLayout?
  /// The Add Widget gallery (snapshot with context.isPreview, and the placeholder): a small
  /// thumbnail instead of the full composed image.
  var preview: Bool = false
}

@available(iOS 17.0, *)
struct ThemeArtProvider: AppIntentTimelineProvider {
  let slot: Int

  private func entry(_ configuration: ChooseWidgetArtIntent?, family: WidgetFamily, preview: Bool = false) -> ThemeArtEntry {
    let chosen = configuration?.art?.id
    let piece = chosen != nil
      ? WidgetArtStore.resolvedID(chosen, family: family)
      : ThemeArtSlots.piece(slot: slot, family: family)
    return ThemeArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: piece, layout: configuration?.layout, preview: preview)
  }

  func placeholder(in context: Context) -> ThemeArtEntry {
    entry(nil, family: context.family, preview: true)
  }

  func snapshot(for configuration: ChooseWidgetArtIntent, in context: Context) async -> ThemeArtEntry {
    entry(configuration, family: context.family, preview: context.isPreview)
  }

  func timeline(for configuration: ChooseWidgetArtIntent, in context: Context) async -> Timeline<ThemeArtEntry> {
    let first = entry(configuration, family: context.family)
    let live = LiveArtSchedule.plan(pieceID: first.pieceID, family: context.family, from: first.date)
    let entries = live.dates.map { ThemeArtEntry(date: $0, theme: first.theme, pieceID: first.pieceID, layout: first.layout) }
    return Timeline(entries: entries, policy: live.policy)
  }
}

@available(iOS 17.0, *)
struct ThemeArtSlotView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ThemeArtEntry

  static func thumbnail(_ id: String) -> UIImage? {
    guard WidgetArtStore.validID(id), let dir = WidgetArtStore.directory() else { return nil }
    let url = dir.appendingPathComponent("\(id).jpg")
    guard
      let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 360, kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
    else { return nil }
    return UIImage(cgImage: image)
  }

  var body: some View {
    // Owner 2026-11-08 (after a swap the whole Glaze gallery stayed on the old theme, even after a
    // restart, since 1.0.18 showed 11 Art tiles instead of 8): every gallery tile decoded its full
    // composed image (up to 1200 px, ~6 MB each) in the one extension process, which is over the
    // widget memory limit, so iOS kept the old previews. Gallery tiles of plain art now decode a
    // 360 px thumbnail; live pieces and placed widgets are unchanged.
    if entry.preview, let id = entry.pieceID, LiveArtStore.spec(pieceID: id, family: family) == nil,
       let thumb = ThemeArtSlotView.thumbnail(id) {
      Color.clear.containerBackground(for: .widget) {
        Image(uiImage: thumb).resizable().scaledToFill()
      }
    } else if entry.pieceID != nil {
      SeamlessWidgetView(theme: entry.theme, pieceID: entry.pieceID, layout: entry.layout, date: entry.date)
    } else {
      Color.clear.containerBackground(for: .widget) { GlazeBackground(theme: entry.theme) }
    }
  }
}

@available(iOS 17.0, *)
enum ThemeArtKind {
  @MainActor static func configuration(slot: Int) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: "GlazeThemeArt\(slot)", intent: ChooseWidgetArtIntent.self, provider: ThemeArtProvider(slot: slot)) { entry in
      ThemeArtSlotView(entry: entry)
        .widgetURL(URL(string: "glaze://widgets"))
    }
    .configurationDisplayName("Art")
    .description("Artwork from the theme you choose in Glaze.")
    .supportedFamilies(slot == 1 ? [.systemSmall, .systemMedium, .systemLarge] : [.systemSmall, .systemLarge])
    .contentMarginsDisabled()
    .disfavoredLocations([.homeScreen], for: galleryHidden(slot: slot))
  }

  /// Owner 2026-11-08 ("a small and large grey icon at the end of its gallery"): an empty slot
  /// showed the plain background. Later slots stay registered (widgets already placed keep working)
  /// and move to WidgetKit's Other list; every piece is still offered in Edit Widget > Art.
  // Owner 2026-11-08 ("Aurora is missing art works such as the fox"): pieces are planned art first
  // (themeArtSync.ts), live / calendar pictures after. Every live pack has at most 5 art pieces and
  // at least 5 non-design pieces per size, so Art 1-5 show every art piece and never an empty tile.
  static let gallerySmallSlots = 5
  static let galleryLargeSlots = 5
  static func galleryHidden(slot: Int) -> [WidgetFamily] {
    var hidden: [WidgetFamily] = []
    if slot > gallerySmallSlots { hidden.append(.systemSmall) }
    if slot > galleryLargeSlots { hidden.append(.systemLarge) }
    return hidden
  }
}

@available(iOS 17.0, *) struct ThemeArtWidget1: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 1) } }
@available(iOS 17.0, *) struct ThemeArtWidget2: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 2) } }
@available(iOS 17.0, *) struct ThemeArtWidget3: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 3) } }
@available(iOS 17.0, *) struct ThemeArtWidget4: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 4) } }
@available(iOS 17.0, *) struct ThemeArtWidget5: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 5) } }
@available(iOS 17.0, *) struct ThemeArtWidget6: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 6) } }

/// The theme's art pages in the gallery, after its Clock, Battery and Calendar.
struct GlazeThemeArtBundle: WidgetBundle {
  var body: some Widget {
    ThemeArtWidget1()
    ThemeArtWidget2()
    ThemeArtWidget3()
    ThemeArtWidget4()
    ThemeArtWidget5()
    ThemeArtWidget6()
  }
}
