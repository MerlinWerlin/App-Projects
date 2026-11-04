import Foundation
import UIKit
import ImageIO
import CryptoKit

enum AlbumPhotoImport {
  static let limit = 12
  static func validRef(_ ref: String) -> Bool {
    ref.utf8.count == 50 && ref.range(of: "^album-[a-f0-9]{40}\\.jpg$", options: .regularExpression) != nil
  }
  /// Decode one bounded thumbnail at a time; never decode all original full-resolution photos.
  static func copy(_ uris: [String], to container: URL) -> [String] {
    guard !uris.isEmpty, uris.count <= limit else { return [] }
    var results: [String] = []
    for uri in uris {
      let ref: String? = autoreleasepool {
        guard let source = URL(string: uri), source.isFileURL,
              let input = CGImageSourceCreateWithURL(source as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(input, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1200,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) else { return nil }
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        let size = CGSize(width: thumbnail.width, height: thumbnail.height)
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
          UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
          UIImage(cgImage: thumbnail).draw(in: CGRect(origin: .zero, size: size))
        }
        guard let data = image.jpegData(compressionQuality: 0.82), data.count <= 2 * 1024 * 1024 else { return nil }
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let name = "album-\(digest.prefix(40)).jpg"
        do { try data.write(to: container.appendingPathComponent(name), options: .atomic); return name }
        catch { return nil }
      }
      guard let ref else { return [] } // No partially delivered list; unused copied files are harmless.
      results.append(ref)
    }
    return results
  }
  static func validDesigns(_ payload: [String: Any], container: URL) -> Bool {
    let catalogue = payload["catalogue"] as? [String: Any] ?? [:]
    for spec in catalogue["specs"] as? [[String: Any]] ?? [] where spec["kind"] as? String == "photoAlbum" {
      guard let refs = spec["photoRefs"] as? [String], refs.count <= limit else { return false }
      for ref in refs {
        guard validRef(ref), FileManager.default.fileExists(atPath: container.appendingPathComponent(ref).path) else { return false }
      }
    }
    return true
  }
}
