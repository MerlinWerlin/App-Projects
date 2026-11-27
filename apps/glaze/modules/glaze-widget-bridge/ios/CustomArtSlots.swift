// Owner 2026-11-15 ("make your own theme, be creative"): the five "Your artwork" slots behind the
// Custom 1-5 Home Screen widgets (targets/widget/CustomArtWidgets.swift, CustomArtStore).
// Pictures stay on the device: each is decoded through ImageIO at no more than maxPixels, cut to a
// centred square (the picker's own square crop normally already did this), saved as JPEG in the App
// Group's custom-art folder under a fresh name, and listed in custom-art/slots.json. Nothing is
// uploaded. Keep the folder, manifest and size in sync with CustomArtStore and
// src/core/customArtSlots.ts.
import Foundation
import ImageIO
import UIKit

// Owner 2026-11-27: Custom 6-7 (medium) and 8-9 (large) as well, the same numbers as Artwork
// (src/core/artworkSlots.ts ARTWORK_GROUPS). Their pictures are cut to the widget's own shape
// (shape(slot:)) at up to wideMaxPixels on the long edge; slots.json keeps the same "1".."9" keys,
// so Custom 1-5 pictures saved by earlier builds stay where they are.
enum CustomArtSlots {
  static let slotCount = 9
  static let maxPixels = 600
  static let wideMaxPixels = 1200

  /// width / height of a slot's picture: square for 1-5, the medium widget (364x170 pt) for 6-7,
  /// the large widget (364x382 pt) for 8-9.
  static func shape(slot: Int) -> CGFloat {
    if slot >= 8 { return 364.0 / 382.0 }
    if slot >= 6 { return 364.0 / 170.0 }
    return 1
  }

  static func longEdge(slot: Int) -> Int { slot >= 6 ? wideMaxPixels : maxPixels }
  static let folder = "custom-art"
  static let manifest = "slots.json"

  private static func directory(_ container: URL) -> URL {
    container.appendingPathComponent(folder, isDirectory: true)
  }

  private static func readMap(_ dir: URL) -> [String: String] {
    guard
      let data = try? Data(contentsOf: dir.appendingPathComponent(manifest)),
      let map = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [:] }
    var out: [String: String] = [:]
    for (k, v) in map {
      if let name = v as? String, let n = Int(k), (1...slotCount).contains(n), validName(name) { out[k] = name }
    }
    return out
  }

  private static func writeMap(_ map: [String: String], _ dir: URL) -> Bool {
    guard let data = try? JSONSerialization.data(withJSONObject: map, options: [.sortedKeys]) else { return false }
    return (try? data.write(to: dir.appendingPathComponent(manifest), options: .atomic)) != nil
  }

  static func validName(_ name: String) -> Bool {
    !name.isEmpty && !name.contains("/") && !name.contains("..") && name.hasSuffix(".jpg")
  }

  /// The picture at `uri` as an upright square of at most maxPixels, or nil if unreadable.
  static func square(_ uri: String) -> UIImage? {
    shaped(uri, aspect: 1, longEdge: maxPixels)
  }

  /// The picture at `uri`, centre-cut to `aspect` (width / height), at most `longEdge` px on its
  /// long side, or nil if unreadable.
  static func shaped(_ uri: String, aspect: CGFloat, longEdge: Int) -> UIImage? {
    let url: URL = uri.hasPrefix("file://") ? (URL(string: uri) ?? URL(fileURLWithPath: uri)) : URL(fileURLWithPath: uri)
    guard
      let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
      // Decode a little larger than the target so the square cut still has maxPixels on its short edge.
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: longEdge * 2, kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
    else { return nil }
    let w = CGFloat(image.width), h = CGFloat(image.height)
    guard w >= 1, h >= 1, aspect > 0 else { return nil }
    // The largest centred rectangle of the wanted shape.
    let cw = min(w, h * aspect), ch = cw / aspect
    let rect = CGRect(x: ((w - cw) / 2).rounded(.down), y: ((h - ch) / 2).rounded(.down), width: cw.rounded(.down), height: ch.rounded(.down))
    guard rect.width >= 1, rect.height >= 1, let cropped = image.cropping(to: rect) else { return nil }
    let k = min(1, CGFloat(longEdge) / max(rect.width, rect.height))
    let size = CGSize(width: max(1, (rect.width * k).rounded()), height: max(1, (rect.height * k).rounded()))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      UIImage(cgImage: cropped).draw(in: CGRect(origin: .zero, size: size))
    }
  }

  /// Saves the picture into `slot`, replacing (and deleting) any earlier one.
  static func save(slot: Int, uri: String, container: URL) -> Bool {
    guard
      (1...slotCount).contains(slot),
      let image = shaped(uri, aspect: shape(slot: slot), longEdge: longEdge(slot: slot)),
      let data = image.jpegData(compressionQuality: 0.85)
    else { return false }
    let dir = directory(container)
    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let name = "\(slot)-\(UUID().uuidString.lowercased()).jpg"
      try data.write(to: dir.appendingPathComponent(name), options: .atomic)
      var map = readMap(dir)
      let old = map[String(slot)]
      map[String(slot)] = name
      guard writeMap(map, dir) else {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))
        return false
      }
      if let old, old != name { try? FileManager.default.removeItem(at: dir.appendingPathComponent(old)) }
      return true
    } catch {
      return false
    }
  }

  /// Empties `slot` (the widget shows its "Add a picture in Glaze" card).
  static func clear(slot: Int, container: URL) -> Bool {
    guard (1...slotCount).contains(slot) else { return false }
    let dir = directory(container)
    var map = readMap(dir)
    guard let old = map.removeValue(forKey: String(slot)) else { return true }
    guard writeMap(map, dir) else { return false }
    try? FileManager.default.removeItem(at: dir.appendingPathComponent(old))
    return true
  }

  /// file:// URL per slot (index 0 = slot 1), "" for an empty slot.
  static func list(container: URL) -> [String] {
    let dir = directory(container)
    let map = readMap(dir)
    return (1...slotCount).map { n in
      guard let name = map[String(n)] else { return "" }
      let url = dir.appendingPathComponent(name)
      return FileManager.default.fileExists(atPath: url.path) ? url.absoluteString : ""
    }
  }
}
