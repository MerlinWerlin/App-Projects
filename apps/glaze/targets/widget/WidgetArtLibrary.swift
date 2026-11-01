// T221 (owner-1101e) "My widget art": the configurable side of the Seamless widget.
// Each Glaze art widget on the Home Screen can show its own piece: long-press > Edit Widget > Art.
//
// Library (written by the app through modules/glaze-widget-bridge; index logic in
// src/core/widgetArtLibrary.ts, keep in sync):
//   <App Group>/widget-art/index.json  { "v": 1, "pieces": [{ id, name, themeName, themeId, source,
//                                        file, created, aspect, size }] }
//   <App Group>/widget-art/<id>.jpg    the composed image (full bleed since T236, long edge <= 1200 px)
//   <App Group>/widget-art/<id>-art.png  T236, optional: the raw art for the Fit layout
// T236: Edit Widget also has Layout (ArtLayout): Fill (default) or Fit, see SeamlessWidget.swift.
// The picker lists pieces newest first (same order as listPieces in TS).
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
}

enum WidgetArtStore {
  static let dirName = "widget-art"
  static let indexName = "index.json"

  static func directory() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GlazeShared.appGroup)?
      .appendingPathComponent(dirName, isDirectory: true)
  }

  /// Every piece in the index whose file exists, newest first. Tolerant: a broken index is empty.
  static func records() -> [WidgetArtRecord] {
    guard
      let dir = directory(),
      let data = try? Data(contentsOf: dir.appendingPathComponent(indexName)),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      root["v"] as? Int == 1,
      let pieces = root["pieces"] as? [[String: Any]]
    else { return [] }
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
          created: (p["created"] as? NSNumber)?.doubleValue ?? 0
        )
      )
    }
    return out.sorted { $0.created > $1.created || ($0.created == $1.created && $0.id < $1.id) }
  }

  /// Same rule as WIDGET_ART_ID_RE (src/core/widgetArtLibrary.ts): letters, digits, _ and -, 1-64.
  static func validID(_ id: String) -> Bool {
    guard !id.isEmpty, id.count <= 64 else { return false }
    return id.unicodeScalars.allSatisfy { s in
      (s >= "a" && s <= "z") || (s >= "A" && s <= "Z") || (s >= "0" && s <= "9") || s == "_" || s == "-"
    }
  }

  /// The chosen piece's image, or nil (no choice, or unreadable), in which case the widget shows
  /// the last applied image for its size (SeamlessStore.load).
  /// T238: a chosen piece that was removed (Manage / theme replace / clean-up) falls back to the
  /// current theme's newest piece (index "currentThemeId"; `preferSize` "small"/"medium"/"large"
  /// wins when given), else nil (last applied image). Mirrors fallbackPiece in widgetArtLibrary.ts.
  static func load(_ id: String?, preferSize: String? = nil) -> UIImage? {
    guard let id = id, validID(id), let dir = directory() else { return nil }
    let url = dir.appendingPathComponent("\(id).jpg")
    if FileManager.default.fileExists(atPath: url.path) {
      return UIImage(contentsOfFile: url.path)
    }
    guard let fallback = fallbackID(preferSize: preferSize), fallback != id else { return nil }
    return UIImage(contentsOfFile: dir.appendingPathComponent("\(fallback).jpg").path)
  }

  /// T238: newest auto-added piece of the index's current theme whose file exists, or nil.
  static func fallbackID(preferSize: String?) -> String? {
    guard
      let dir = directory(),
      let data = try? Data(contentsOf: dir.appendingPathComponent(indexName)),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let current = root["currentThemeId"] as? String, !current.isEmpty,
      let pieces = root["pieces"] as? [[String: Any]]
    else { return nil }
    var mine: [(id: String, created: Double, size: String)] = []
    for p in pieces {
      guard let id = p["id"] as? String, validID(id) else { continue }
      guard (p["source"] as? String) != "photo", (p["themeId"] as? String) == current else { continue }
      guard FileManager.default.fileExists(atPath: dir.appendingPathComponent("\(id).jpg").path) else { continue }
      mine.append((id: id, created: (p["created"] as? NSNumber)?.doubleValue ?? 0, size: (p["size"] as? String) ?? ""))
    }
    mine.sort { $0.created > $1.created || ($0.created == $1.created && $0.id < $1.id) }
    if let size = preferSize, let hit = mine.first(where: { $0.size == size }) { return hit.id }
    return mine.first?.id
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

  @available(iOS 17.0, *)
  static func entities() -> [WidgetArtEntity] {
    records().map { WidgetArtEntity(id: $0.id, name: $0.name, themeName: $0.themeName) }
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

@available(iOS 17.0, *)
struct WidgetArtQuery: EntityQuery {
  init() {}

  func entities(for identifiers: [WidgetArtEntity.ID]) async throws -> [WidgetArtEntity] {
    let all = WidgetArtStore.entities()
    return identifiers.compactMap { id in all.first { $0.id == id } }
  }

  /// "My widget art", newest first.
  func suggestedEntities() async throws -> [WidgetArtEntity] {
    WidgetArtStore.entities()
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

  func snapshot(for configuration: ChooseWidgetArtIntent, in context: Context) async -> ArtEntry {
    ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: configuration.art?.id, layout: configuration.layout)
  }

  func timeline(for configuration: ChooseWidgetArtIntent, in context: Context) async -> Timeline<ArtEntry> {
    let entry = ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: configuration.art?.id, layout: configuration.layout)
    // T237: a piece with a live value (LiveArtOverlay.swift) gets per-minute entries (clock), a reload
    // after midnight (date), every 15 min (battery) or at the end of a focus session; else as before.
    let live = LiveArtSchedule.plan(pieceID: entry.pieceID, family: context.family, from: entry.date)
    let entries = live.dates.map { ArtEntry(date: $0, theme: entry.theme, pieceID: entry.pieceID, layout: entry.layout) }
    return Timeline(entries: entries, policy: live.policy)
  }
}
