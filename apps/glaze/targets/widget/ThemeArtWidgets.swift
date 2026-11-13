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
// Since 2026-11-12 every kind is small only ("Artwork n", ThemeArtSlots below).
import SwiftUI
import WidgetKit

// Owner 2026-11-12 ("singular themes need to be like art work 1 art work 2 ... just be all small
// arts"): the theme art widgets are a plain numbered set, "Artwork 1" to "Artwork 5", small only.
// Artwork n is the current theme's n-th small plain art piece (no clock / date / calendar
// pictures, no designs). Every published theme has 2 to 5 (audit 12 Nov), so a slot past the
// theme's count cycles back through its pieces: no Artwork slot is ever blank.
@available(iOS 17.0, *)
enum ThemeArtSlots {
  /// The current theme's small artwork, in Edit Widget order. Plain art first; a theme with none
  /// falls back to its other small pictures (designs never).
  static func pieces(family: WidgetFamily) -> [String] {
    // One read of index.json per tile (the flags are parsed with it), not one per piece.
    let snap = WidgetArtStore.snapshot()
    // Owner 2026-11-13: the app's ordered Artwork list (pure illustrations), the same list My widget
    // art shows, so Home Screen Artwork n = in-app Artwork n.
    if let list = snap.artwork { return list.filter { snap.has($0) } }
    let small = snap.currentThemeRecords().filter { $0.size == "small" && !$0.design }
    let art = small.filter { !$0.live }
    return (art.isEmpty ? small : art).map { $0.id }
  }

  /// The piece Artwork `slot` (1-based) shows when nothing is chosen in Edit Widget: cycles
  /// through the theme's pieces, nil only when the theme has none at all.
  static func piece(slot: Int, family: WidgetFamily) -> String? {
    let list = pieces(family: family)
    guard slot >= 1, !list.isEmpty else { return nil }
    return list[(slot - 1) % list.count]
  }
}

// Owner 2026-11-12 ("like colour code them or some thing"): one fixed colour per Artwork slot, the
// same in every theme; the app shows the same colour and number on each piece (src/core/artworkSlots.ts
// ARTWORK_SLOT_COLOURS, kept equal by artworkSlots.test.ts).
enum ArtworkSlotColour {
  /// (fill, ink) for slots 1...6: coral, amber, mint, blue, violet, rose.
  static let table: [(fill: String, ink: String)] = [
    ("#E5533D", "#FFFFFF"), ("#F2A91D", "#2A1A00"), ("#2FBF8F", "#062A1E"),
    ("#2F7BEA", "#FFFFFF"), ("#8A5CF0", "#FFFFFF"), ("#E04F8E", "#FFFFFF"),
  ]

  static func of(_ slot: Int) -> (fill: Color, ink: Color) {
    let n = table.count
    let c = table[(((slot - 1) % n) + n) % n]
    return (Color(hex: c.fill), Color(hex: c.ink))
  }
}

/// The Add Widget gallery tile of Artwork `slot`: its colour and a big number, never theme art.
struct ArtworkSlotTile: View {
  let slot: Int

  static func backdrop(slot: Int) -> some View {
    let fill = ArtworkSlotColour.of(slot).fill
    return ZStack {
      fill
      LinearGradient(colors: [Color.white.opacity(0.22), Color.black.opacity(0.12)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
  }

  var body: some View {
    let ink = ArtworkSlotColour.of(slot).ink
    GeometryReader { geo in
      let s = min(geo.size.width, geo.size.height)
      ZStack(alignment: .topLeading) {
        Text(verbatim: "\(slot)")
          .font(.system(size: s * 0.62, weight: .heavy, design: .rounded))
          .foregroundStyle(ink)
          .minimumScaleFactor(0.5)
          .frame(width: geo.size.width, height: geo.size.height)
        Image(systemName: "sparkles")
          .font(.system(size: s * 0.13, weight: .semibold))
          .foregroundStyle(ink.opacity(0.85))
          .padding(s * 0.09)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text("Artwork \(slot)"))
  }
}

@available(iOS 17.0, *)
struct ThemeArtEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  /// nil = this theme has no piece for the slot: the plain theme background.
  let pieceID: String?
  let layout: ArtLayout?
  /// The Add Widget gallery (snapshot with context.isPreview, and the placeholder): the fixed
  /// GallerySampleArt scene `sample`, never the theme's art.
  var preview: Bool = false
  var sample: Int = 0
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

  /// Owner 2026-11-11: the gallery never reads the theme, the art index or any art file.
  private var galleryEntry: ThemeArtEntry {
    ThemeArtEntry(date: Date(), theme: GallerySample.theme(slot - 1), pieceID: nil, layout: nil, preview: true, sample: slot - 1)
  }

  func placeholder(in context: Context) -> ThemeArtEntry {
    galleryEntry
  }

  func snapshot(for configuration: ChooseWidgetArtIntent, in context: Context) async -> ThemeArtEntry {
    context.isPreview ? galleryEntry : entry(configuration, family: context.family)
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
  let entry: ThemeArtEntry

  var body: some View {
    // Owner 2026-11-09: in the gallery (entry.preview) EVERY tile, live pieces included, draws a
    // small thumbnail (GalleryThumbnail, SeamlessWidget.swift): 1.0.20 covered plain art only, and
    // the live pieces in the later Art tiles still decoded full images over the extension's memory limit.
    if entry.preview {
      ArtworkSlotTile(slot: entry.sample + 1)
        .containerBackground(for: .widget) { ArtworkSlotTile.backdrop(slot: entry.sample + 1) }
    } else if entry.pieceID != nil {
      SeamlessWidgetView(theme: entry.theme, pieceID: entry.pieceID, layout: entry.layout, date: entry.date, preview: entry.preview)
    } else {
      Color.clear.containerBackground(for: .widget) { GlazeBackground(theme: entry.theme) }
    }
  }
}

@available(iOS 17.0, *)
enum ThemeArtKind {
  // Owner 2026-11-13 (build 74: "the galary ones arent like that ... they do not correspsone"): the
  // code drew the coloured numbered tiles, but iOS keeps each widget kind's gallery preview and
  // kept showing the older pictures for GlazeThemeArt1-6. Fresh kinds (GlazeArtwork1-5) have no
  // preview stored, so iOS must draw the current tiles; the tiles never read the theme, so they can
  // never go stale again. The GlazeThemeArt kinds stay registered (widgets already placed keep
  // working, same provider and view) but leave the Home Screen gallery.
  static func kind(slot: Int, legacy: Bool) -> String {
    legacy ? "GlazeThemeArt\(slot)" : "GlazeArtwork\(slot)"
  }

  @MainActor static func configuration(slot: Int, legacy: Bool = false) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: kind(slot: slot, legacy: legacy), intent: ChooseWidgetArtIntent.self, provider: ThemeArtProvider(slot: slot)) { entry in
      ThemeArtSlotView(entry: entry)
        .widgetURL(URL(string: "glaze://widgets"))
    }
    .configurationDisplayName(displayName(slot: slot))
    .description("Shows your Glaze theme's art once added.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
    .disfavoredLocations([.homeScreen], for: legacy ? [.systemSmall] : galleryHidden(slot: slot))
  }

  /// Owner 2026-11-08 ("a small and large grey icon at the end of its gallery"): an empty slot
  /// showed the plain background. Later slots stay registered (widgets already placed keep working)
  /// and move to WidgetKit's Other list; every piece is still offered in Edit Widget > Art.
  // Owner 2026-11-08 ("Aurora is missing art works such as the fox"): pieces are planned art first
  // (themeArtSync.ts), live / calendar pictures after. Every live pack has at most 5 art pieces and
  // at least 5 non-design pieces per size, so Art 1-5 show every art piece and never an empty tile.
  static let gallerySmallSlots = 5

  /// Owner 2026-11-13 (Glaze missing from the Add Widget list after a reinstall): six fixed,
  /// localised names instead of an interpolated key ("Artwork \(slot)"), so every widget
  /// description iOS stores is a plain string key like every other Glaze widget's.
  static func displayName(slot: Int) -> LocalizedStringKey {
    switch slot {
    case 1: return "Artwork 1"
    case 2: return "Artwork 2"
    case 3: return "Artwork 3"
    case 4: return "Artwork 4"
    case 5: return "Artwork 5"
    default: return "Artwork 6"
    }
  }
  static func galleryHidden(slot: Int) -> [WidgetFamily] {
    slot > gallerySmallSlots ? [.systemSmall] : []
  }
}

@available(iOS 17.0, *) struct ThemeArtWidget1: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 1, legacy: true) } }
@available(iOS 17.0, *) struct ThemeArtWidget2: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 2, legacy: true) } }
@available(iOS 17.0, *) struct ThemeArtWidget3: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 3, legacy: true) } }
@available(iOS 17.0, *) struct ThemeArtWidget4: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 4, legacy: true) } }
@available(iOS 17.0, *) struct ThemeArtWidget5: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 5, legacy: true) } }
@available(iOS 17.0, *) struct ThemeArtWidget6: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 6, legacy: true) } }

@available(iOS 17.0, *) struct ArtworkWidget1: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 1) } }
@available(iOS 17.0, *) struct ArtworkWidget2: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 2) } }
@available(iOS 17.0, *) struct ArtworkWidget3: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 3) } }
@available(iOS 17.0, *) struct ArtworkWidget4: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 4) } }
@available(iOS 17.0, *) struct ArtworkWidget5: Widget { var body: some WidgetConfiguration { ThemeArtKind.configuration(slot: 5) } }

/// The theme's art pages in the gallery, after its Clock, Battery and Calendar: Artwork 1-5 (fresh
/// kinds, 2026-11-13). The older GlazeThemeArt1-6 kinds are in GlazeLegacyArtBundle.
struct GlazeThemeArtBundle: WidgetBundle {
  var body: some Widget {
    ArtworkWidget1()
    ArtworkWidget2()
    ArtworkWidget3()
    ArtworkWidget4()
    ArtworkWidget5()
  }
}
