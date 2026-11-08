// T221 (owner-1101e) "My widget art": the configurable side of the Seamless widget.
// Each Glaze art widget on the Home Screen can show its own piece: long-press > Edit Widget > Art.
//
// Library (written by the app through modules/glaze-widget-bridge; index logic in
// src/core/widgetArtLibrary.ts, keep in sync):
//   <App Group>/widget-art/index.json  { "v": 1, "pieces": [{ id, name, themeName, themeId, source,
//                                        file, created, aspect, size, slot? }], "currentThemeId"?,
//                                        "retired"?: { <id>: { size, slot } },
//                                        "unpinned"?: { <size>: <id> | null } (T259) }
//   <App Group>/widget-art/<id>.jpg    the composed image (full bleed since T236, long edge <= 1200 px)
//   <App Group>/widget-art/<id>-art.png  T236, optional: the raw art for the Fit layout
// T236: Edit Widget also has Layout (ArtLayout): Fill (default) or Fit, see SeamlessWidget.swift.
// T252 (owner-1101h #3): applying a theme adds ALL its pieces and removes the previous theme's
// (src/store/themeWidgetArt.ts). So that Edit Widget > Art never "bugs out" after a swap:
//   - every query, timeline and image load reads index.json FRESH from disk (WidgetArtStore.snapshot,
//     no static cache anywhere in this file); the app writes the index before it reloads timelines;
//   - the picker lists the current theme's pieces first (size, slot), then the rest newest first
//     (pickerPieces in TS);
//   - a widget whose configured piece was removed shows the current theme's piece in the same size
//     + slot, else that size's first piece, else the theme's first piece (resolve, mirroring
//     resolveWidgetPiece in TS), else the last applied image for its size, else the theme
//     background (SeamlessWidgetView): never blank, never a crash.
//
// iOS 17+ only (WidgetConfigurationIntent / AppIntentConfiguration). The extension's deployment
// target is 17.0 (expo-target.config.js), so the bundle uses SeamlessWidget() directly.
// The literal titles below are localised like HabitIntents.swift (English text = key in
// targets/widget/<lang>.lproj/Localizable.strings).
//
// Not compiled here (no Xcode in the build environment). VERIFY on a dev build.
import AppIntents
import Foundation
import SwiftUI
import UIKit
import WidgetKit

struct WidgetArtRecord {
  let id: String
  let name: String
  let themeName: String
  let file: String
  let created: Double
  /// T252: "photo" for the person's own pieces, else auto-added theme art.
  let source: String
  let themeId: String?
  /// "small" / "medium" / "large", or nil (photos).
  let size: String?
  /// T252: position among the theme's pieces of the same size, or nil (photos, older records).
  let slot: Int?
}

/// T252: what a removed auto-added piece was, so its widgets can be remapped.
struct WidgetArtRetired {
  let size: String?
  let slot: Int?
}

/// T252: one read of widget-art/index.json. Made fresh by WidgetArtStore.snapshot() on every call
/// and never stored, so a query or timeline always sees what the app last wrote.
struct WidgetArtSnapshot {
  /// Every piece in the index whose file exists, newest first.
  let records: [WidgetArtRecord]
  let currentThemeId: String?
  let retired: [String: WidgetArtRetired]
  /// T259: index.json `unpinned`, size -> piece id ("" = the theme's plain background). A size not
  /// listed = the last applied image (seamless-<size>.png). Written by the app (followTheme in TS).
  var unpinned: [String: String] = [:]

  func has(_ id: String) -> Bool {
    records.contains { $0.id == id }
  }

  /// The current theme's auto-added pieces in shelf order (byShelf in TS).
  func currentThemeRecords() -> [WidgetArtRecord] {
    guard let current = currentThemeId, !current.isEmpty else { return [] }
    return records
      .filter { $0.source != "photo" && $0.themeId == current }
      .sorted(by: WidgetArtStore.shelfOrder)
  }

  /// Edit Widget > Art order: the current theme's pieces first, then the rest newest first.
  func pickerRecords() -> [WidgetArtRecord] {
    let mine = currentThemeRecords()
    let ids = Set(mine.map { $0.id })
    return mine + records.filter { !ids.contains($0.id) }
  }

  /// The piece a widget configured with `id` shows (mirrors resolveWidgetPiece in TS): `id` while
  /// it is in the library; removed → the current theme's piece of the same size (the widget's,
  /// else the removed piece's) and slot, else that size's first, else the theme's first; nil = no
  /// choice or nothing to map to (the view then shows the last applied image / theme background).
  func resolve(_ id: String?, preferSize: String?) -> String? {
    guard let id = id, WidgetArtStore.validID(id) else { return nil }
    if has(id) { return id }
    let mine = currentThemeRecords()
    guard let first = mine.first else { return nil }
    let gone = retired[id]
    let want: String? = preferSize ?? gone?.size
    var sameSize: [WidgetArtRecord] = []
    if let want = want {
      sameSize = mine.filter { $0.size == want }
    }
    if let slot = gone?.slot, let hit = sameSize.first(where: { $0.slot == slot }) {
      return hit.id
    }
    return sameSize.first?.id ?? first.id
  }

  /// T259: what a widget with NO piece chosen shows (mirrors unpinnedChoice in TS): size not listed
  /// → the last applied image; "" → the theme's plain background; an id → resolved like a chosen
  /// piece, else the plain background. Never the previous theme's last applied image.
  func unpinnedChoice(_ size: String?) -> UnpinnedChoice {
    guard let size = size, let want = unpinned[size] else { return .lastApplied }
    if want.isEmpty { return .background }
    if let id = resolve(want, preferSize: size) { return .piece(id) }
    return .background
  }
}

/// T259: see WidgetArtSnapshot.unpinnedChoice.
enum UnpinnedChoice {
  case lastApplied
  case background
  case piece(String)
}

enum WidgetArtStore {
  static let dirName = "widget-art"
  static let indexName = "index.json"

  static func directory() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)?
      .appendingPathComponent(dirName, isDirectory: true)
  }

  /// T252: reads index.json from disk NOW (no cache). Tolerant: a missing or broken index is an
  /// empty library; pieces whose file is missing are left out.
  static func snapshot() -> WidgetArtSnapshot {
    let none = WidgetArtSnapshot(records: [], currentThemeId: nil, retired: [:])
    guard
      let dir = directory(),
      let data = try? Data(contentsOf: dir.appendingPathComponent(indexName)),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      root["v"] as? Int == 1,
      let pieces = root["pieces"] as? [[String: Any]]
    else { return none }
    var out: [WidgetArtRecord] = []
    for p in pieces {
      guard let id = p["id"] as? String, validID(id) else { continue }
      if out.contains(where: { $0.id == id }) { continue }
      let file = "\(id).jpg"
      guard FileManager.default.fileExists(atPath: dir.appendingPathComponent(file).path) else { continue }
      out.append(
        WidgetArtRecord(
          id: id,
          name: (p["name"] as? String) ?? id,
          themeName: (p["themeName"] as? String) ?? "",
          file: file,
          created: (p["created"] as? NSNumber)?.doubleValue ?? 0,
          source: (p["source"] as? String) == "photo" ? "photo" : "theme",
          themeId: p["themeId"] as? String,
          size: sizeName(p["size"]),
          slot: slotNumber(p["slot"])
        )
      )
    }
    let newestFirst = out.sorted { $0.created > $1.created || ($0.created == $1.created && $0.id < $1.id) }
    var retired: [String: WidgetArtRetired] = [:]
    if let map = root["retired"] as? [String: Any] {
      for (key, value) in map {
        guard validID(key), let r = value as? [String: Any] else { continue }
        retired[key] = WidgetArtRetired(size: sizeName(r["size"]), slot: slotNumber(r["slot"]))
      }
    }
    var current: String? = nil
    if let c = root["currentThemeId"] as? String, !c.isEmpty { current = c }
    // T259: JSON null = the plain background (""), a valid id = that piece; anything else is ignored.
    var unpinned: [String: String] = [:]
    if let map = root["unpinned"] as? [String: Any] {
      for (key, value) in map {
        guard let size = sizeName(key) else { continue }
        if value is NSNull {
          unpinned[size] = ""
        } else if let id = value as? String, validID(id) {
          unpinned[size] = id
        }
      }
    }
    return WidgetArtSnapshot(records: newestFirst, currentThemeId: current, retired: retired, unpinned: unpinned)
  }

  /// T259: true when a widget of `family` with no chosen piece shows the theme's plain background
  /// (after a swap to a theme with no piece of that size): the last applied image is NOT shown.
  static func unpinnedShowsBackground(_ family: WidgetFamily) -> Bool {
    if case .background = snapshot().unpinnedChoice(SeamlessStore.familyName(family)) { return true }
    return false
  }

  static func sizeName(_ raw: Any?) -> String? {
    guard let s = raw as? String, s == "small" || s == "medium" || s == "large" else { return nil }
    return s
  }

  static func slotNumber(_ raw: Any?) -> Int? {
    guard let n = raw as? NSNumber else { return nil }
    let v = n.doubleValue
    guard v >= 0, v < 1000, v == v.rounded() else { return nil }
    return Int(v)
  }

  /// byShelf in TS: size (small, medium, large, none), slot (none last), newest, id.
  static func shelfOrder(_ a: WidgetArtRecord, _ b: WidgetArtRecord) -> Bool {
    let sa = sizeRank(a.size)
    let sb = sizeRank(b.size)
    if sa != sb { return sa < sb }
    let la = a.slot ?? Int.max
    let lb = b.slot ?? Int.max
    if la != lb { return la < lb }
    if a.created != b.created { return a.created > b.created }
    return a.id < b.id
  }

  static func sizeRank(_ size: String?) -> Int {
    switch size {
    case "small": return 0
    case "medium": return 1
    case "large": return 2
    default: return 3
    }
  }

  /// Every piece in the index whose file exists, newest first (read fresh).
  static func records() -> [WidgetArtRecord] {
    snapshot().records
  }

  /// Same rule as WIDGET_ART_ID_RE (src/core/widgetArtLibrary.ts): letters, digits, _ and -, 1-64.
  static func validID(_ id: String) -> Bool {
    guard !id.isEmpty, id.count <= 64 else { return false }
    return id.unicodeScalars.allSatisfy { s in
      (s >= "a" && s <= "z") || (s >= "A" && s <= "Z") || (s >= "0" && s <= "9") || s == "_" || s == "-"
    }
  }

  /// T252: the piece a widget of `family` configured with `id` shows (see WidgetArtSnapshot.resolve).
  /// T259: with no piece chosen, the piece the index says unpinned widgets of this size follow (the
  /// current theme's), else nil (the view shows the last applied image or the plain background).
  static func resolvedID(_ id: String?, family: WidgetFamily) -> String? {
    let size = SeamlessStore.familyName(family)
    guard id != nil else {
      if case .piece(let follow) = snapshot().unpinnedChoice(size) { return follow }
      return nil
    }
    return snapshot().resolve(id, preferSize: size)
  }

  /// The chosen piece's image, or nil (no choice, or unreadable), in which case the widget shows
  /// the last applied image for its size (SeamlessStore.load).
  /// T238/T252: a chosen piece that was removed (theme swap / Manage / clean-up) shows the current
  /// theme's piece in the same size + slot (fallbackID → WidgetArtSnapshot.resolve), else nil.
  static func load(_ id: String?, preferSize: String? = nil) -> UIImage? {
    guard let id = id, validID(id), let dir = directory() else { return nil }
    let url = dir.appendingPathComponent("\(id).jpg")
    if FileManager.default.fileExists(atPath: url.path) {
      return UIImage(contentsOfFile: url.path)
    }
    guard let fallback = fallbackID(for: id, preferSize: preferSize), fallback != id else { return nil }
    return UIImage(contentsOfFile: dir.appendingPathComponent("\(fallback).jpg").path)
  }

  /// T238/T252: the current theme's replacement for a removed piece (fresh index read), or nil.
  static func fallbackID(for id: String, preferSize: String?) -> String? {
    snapshot().resolve(id, preferSize: preferSize)
  }

  /// T236: true when the chosen piece's composed file exists (so the widget shows the piece).
  static func has(_ id: String?) -> Bool {
    guard let id = id, validID(id), let dir = directory() else { return false }
    return FileManager.default.fileExists(atPath: dir.appendingPathComponent("\(id).jpg").path)
  }

  /// T236: the chosen piece's raw art (<id>-art.png) for the Fit layout, or nil (older pieces and
  /// wallpaper-backed ones have none; the view then fits the composed image).
  static func loadArt(_ id: String?) -> UIImage? {
    guard let id = id, validID(id), let dir = directory() else { return nil }
    let url = dir.appendingPathComponent("\(id)-art.png")
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }
}

@available(iOS 17.0, *)
extension WidgetArtRecord {
  var entity: WidgetArtEntity {
    WidgetArtEntity(id: id, name: name, themeName: themeName)
  }
}

@available(iOS 17.0, *)
struct WidgetArtEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Widget art"
  static var defaultQuery = WidgetArtQuery()

  let id: String
  let name: String
  let themeName: String

  var displayRepresentation: DisplayRepresentation {
    if themeName.isEmpty {
      return DisplayRepresentation(title: "\(name)")
    }
    return DisplayRepresentation(title: "\(name)", subtitle: "\(themeName)")
  }
}

/// Reads the index fresh on every call (T252): no stored library, so Edit Widget > Art lists the
/// current theme's pieces straight after a swap.
@available(iOS 17.0, *)
struct WidgetArtQuery: EntityQuery {
  init() {}

  /// A configured id that is still in the library is itself. One removed by a theme swap or Manage
  /// comes back under its own id (so the widget keeps its configuration) showing the replacement
  /// piece's name; the timeline then draws that replacement (ArtProvider → resolvedID).
  func entities(for identifiers: [WidgetArtEntity.ID]) async throws -> [WidgetArtEntity] {
    let snap = WidgetArtStore.snapshot()
    return identifiers.compactMap { (id: String) -> WidgetArtEntity? in
      if let hit = snap.records.first(where: { $0.id == id }) { return hit.entity }
      guard let other = snap.resolve(id, preferSize: nil), let rec = snap.records.first(where: { $0.id == other }) else {
        return nil
      }
      return WidgetArtEntity(id: id, name: rec.name, themeName: rec.themeName)
    }
  }

  /// "My widget art": the current theme's pieces first (size, slot), then the rest newest first.
  func suggestedEntities() async throws -> [WidgetArtEntity] {
    let snap = WidgetArtStore.snapshot()
    return snap.pickerRecords().map { $0.entity }
  }
}

@available(iOS 17.0, *)
struct ChooseWidgetArtIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Choose widget art"

  /// Empty = the last piece applied in Glaze for this size (the pre-T221 behaviour).
  @Parameter(title: "Art")
  var art: WidgetArtEntity?

  /// T236 (owner-1101g #1): Fill (default) = the full-bleed image edge to edge; Fit = the raw art
  /// whole on the theme background. Widgets configured before T236 get the default, Fill.
  @Parameter(title: "Layout", default: .fill)
  var layout: ArtLayout

  init() {}
}

/// T236: Edit Widget > Layout. Fill (default) never shows a frame; Fit shows the whole art inset.
@available(iOS 17.0, *)
enum ArtLayout: String, AppEnum {
  case fill
  case fit

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Layout"
  static var caseDisplayRepresentations: [ArtLayout: DisplayRepresentation] = [
    .fill: "Fill",
    .fit: "Fit",
  ]
}

@available(iOS 17.0, *)
struct ArtEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  let pieceID: String?
  /// T236: nil (placeholder) behaves as .fill.
  let layout: ArtLayout?
}

/// Static content: only changes when the app reloads timelines (every library change does) or the
/// user picks another piece in Edit Widget (WidgetKit asks for a new timeline then).
@available(iOS 17.0, *)
struct ArtProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> ArtEntry {
    ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: nil, layout: nil)
  }

  // T252: the configured piece resolved against the index as it is on disk NOW, for this widget's
  // size: a piece removed by a theme swap becomes the current theme's piece in the same slot, so
  // the image, the Fit raw art and the live overlay all come from one existing piece.
  func snapshot(for configuration: ChooseWidgetArtIntent, in context: Context) async -> ArtEntry {
    let piece = WidgetArtStore.resolvedID(configuration.art?.id, family: context.family)
    return ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: piece, layout: configuration.layout)
  }

  func timeline(for configuration: ChooseWidgetArtIntent, in context: Context) async -> Timeline<ArtEntry> {
    let piece = WidgetArtStore.resolvedID(configuration.art?.id, family: context.family)
    let entry = ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: piece, layout: configuration.layout)
    // T237: a piece with a live value (LiveArtOverlay.swift) gets per-minute entries (clock), a reload
    // after midnight (date), every 15 min (battery) or at the end of a focus session; else as before.
    let live = LiveArtSchedule.plan(pieceID: entry.pieceID, family: context.family, from: entry.date)
    let entries = live.dates.map { ArtEntry(date: $0, theme: entry.theme, pieceID: entry.pieceID, layout: entry.layout) }
    return Timeline(entries: entries, policy: live.policy)
  }
}
