// T221 (owner-1101e) "My widget art": the configurable side of the Seamless widget.
// Each Glaze art widget on the Home Screen can show its own piece: long-press > Edit Widget > Art.
//
// Library (written by the app through modules/glaze-widget-bridge; index logic in
// src/core/widgetArtLibrary.ts, keep in sync):
//   <App Group>/widget-art/index.json  { "v": 1, "pieces": [{ id, name, themeName, themeId, source,
//                                        file, created, aspect, size }] }
//   <App Group>/widget-art/<id>.jpg    the composed image (already fitted, long edge <= 1200 px)
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

  /// The chosen piece's image, or nil (no choice, removed from the library, or unreadable), in which
  /// case the widget shows the last applied image for its size (SeamlessStore.load).
  static func load(_ id: String?) -> UIImage? {
    guard let id = id, validID(id), let dir = directory() else { return nil }
    let url = dir.appendingPathComponent("\(id).jpg")
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

  init() {}
}

@available(iOS 17.0, *)
struct ArtEntry: TimelineEntry {
  let date: Date
  let theme: WidgetTheme
  let pieceID: String?
}

/// Static content: only changes when the app reloads timelines (every library change does) or the
/// user picks another piece in Edit Widget (WidgetKit asks for a new timeline then).
@available(iOS 17.0, *)
struct ArtProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> ArtEntry {
    ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: nil)
  }

  func snapshot(for configuration: ChooseWidgetArtIntent, in context: Context) async -> ArtEntry {
    ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: configuration.art?.id)
  }

  func timeline(for configuration: ChooseWidgetArtIntent, in context: Context) async -> Timeline<ArtEntry> {
    let entry = ArtEntry(date: Date(), theme: ThemeStore.load(), pieceID: configuration.art?.id)
    return Timeline(entries: [entry], policy: .never)
  }
}
