import Foundation
import SwiftUI
import UIKit
import WidgetKit
import ImageIO
import CryptoKit

@main struct NativeAlbumReview: App {
  var body: some Scene { WindowGroup { Text("Glaze album review").task { await MainActor.run { AlbumCapture.run() } } } }
}
@MainActor enum AlbumCapture {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let args = ProcessInfo.processInfo.arguments
    let language = args.firstIndex(of: "--language").map { args[$0 + 1] } ?? "en"
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("GlazeAlbumReview").appendingPathComponent(language)
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      var checks = 0
      func check(_ value: Bool, _ message: String) throws {
        guard value else { throw NSError(domain: "AlbumContract", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }; checks += 1
      }
      try check(Bundle.main.preferredLocalizations.first == language, "Actual extension language bundle")
      let scratch = folder.appendingPathComponent("isolated-imports")
      try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
      func picture(_ colour: UIColor, name: String) throws -> URL {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 2400, height: 1600), format: format).image { c in
          colour.setFill(); c.fill(CGRect(x: 0, y: 0, width: 2400, height: 1600))
          UIColor.white.setFill(); c.fill(CGRect(x: 170, y: 170, width: 320, height: 320))
        }
        let url = scratch.appendingPathComponent(name)
        try image.jpegData(compressionQuality: 0.9)!.write(to: url); return url
      }
      let inputs = try [picture(.systemTeal, name: "first.jpg"), picture(.systemOrange, name: "second.jpg")]
      let refs = AlbumPhotoImport.copy(inputs.map(\.absoluteString), to: scratch)
      try check(refs.count == 2 && Set(refs).count == 2, "Two distinct images imported")
      try check(AlbumPhotoImport.copy(inputs.map(\.absoluteString), to: scratch) == refs, "Repeat import deduplicates by content")
      try check(AlbumPhotoImport.copy(["https://example.com/photo.jpg"], to: scratch).isEmpty, "Remote URI rejected")
      try check(AlbumPhotoImport.copy(Array(repeating: inputs[0].absoluteString, count: 13), to: scratch).isEmpty, "Over-limit rejected")
      try check(AlbumPhotoImport.copy([inputs[0].absoluteString, scratch.appendingPathComponent("missing.jpg").absoluteString], to: scratch).isEmpty, "Partial import never published")
      for ref in refs {
        let url = scratch.appendingPathComponent(ref), data = try Data(contentsOf: url)
        let image = PhotoAlbumStore.image(ref, in: scratch)!
        try check(max(image.size.width, image.size.height) == 1200, "Source downsampled before full decode")
        try check(data.count <= 2 * 1024 * 1024, "JPEG size bounded")
        let source = CGImageSourceCreateWithData(data as CFData, nil)!
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] ?? [:]
        try check(properties[kCGImagePropertyGPSDictionary as String] == nil, "No GPS metadata retained")
      }
      for bad in ["../photo.jpg", "file:///photo.jpg", "album-" + String(repeating: "a", count: 40) + ".jpg\n", "widget-photo.jpg"] {
        try check(!PhotoAlbumModel.validRef(bad) && !AlbumPhotoImport.validRef(bad), "Owned bare file reference only")
        try check(PhotoAlbumStore.image(bad, in: scratch) == nil, "Invalid reference never loaded")
      }
      for minutes in PhotoAlbumModel.intervals {
        let boundary = Date(timeIntervalSince1970: Double(4 * minutes * 60))
        try check(PhotoAlbumModel.index(at: boundary.addingTimeInterval(-0.01), minutes: minutes, count: 3) == 0, "Before boundary")
        try check(PhotoAlbumModel.index(at: boundary, minutes: minutes, count: 3) == 1, "At boundary")
        try check(PhotoAlbumModel.index(at: Date(timeIntervalSince1970: -1), minutes: minutes, count: 3) == 2, "Negative epoch wraps")
        try check(PhotoAlbumModel.nextBoundary(after: boundary, minutes: minutes).timeIntervalSince(boundary) == Double(minutes * 60), "Strictly future reload")
      }
      guard let fixture = Bundle.main.url(forResource: "native-album-review", withExtension: "json"),
            let root = try JSONSerialization.jsonObject(with: Data(contentsOf: fixture)) as? [String: Any],
            let cases = root["cases"] as? [[String: Any]] else { throw NSError(domain: "AlbumContract", code: 2) }
      let date = Date(timeIntervalSince1970: 1800000000)
      var records: [[String: Any]] = []
      for c in cases where c["language"] as? String == language {
        let theme = try JSONDecoder().decode(WidgetTheme.self, from: JSONSerialization.data(withJSONObject: c["nativeTheme"]!))
        var raw = c["raw"] as! [String: Any]; raw["photoRefs"] = refs
        let texts = c["texts"] as! [String: String]
        let design = SavedWidgetDesign(raw: raw, texts: texts)
        try check(AlbumPhotoImport.validDesigns(["catalogue": ["specs": [raw]]], container: scratch), "Actual editor payload accepted")
        var bad = raw; bad["photoRefs"] = ["../photo.jpg"]
        try check(!AlbumPhotoImport.validDesigns(["catalogue": ["specs": [bad]]], container: scratch), "Invalid payload rejected")
        try check(PhotoAlbumStore.offset(design, in: scratch) == 0, "Initial cursor")
        try check(PhotoAlbumStore.advance(design, in: scratch) && PhotoAlbumStore.offset(design, in: scratch) == 1, "Persisted next photo")
        try check(PhotoAlbumStore.advance(design, in: scratch) && PhotoAlbumStore.offset(design, in: scratch) == 0, "Next wraps")
        var replacement = raw; replacement["photoRefs"] = Array(refs.reversed())
        try check(PhotoAlbumStore.offset(SavedWidgetDesign(raw: replacement, texts: texts), in: scratch) == 0, "New selection gets independent cursor")
        let size = c["size"] as! String
        let width: CGFloat = size == "small" ? 170 : 364, height: CGFloat = size == "large" ? 382 : 170
        for state in ["first", "next", "empty", "missing"] {
          let image = (state == "first" || state == "next") ? PhotoAlbumStore.image(refs[state == "first" ? 0 : 1], in: scratch) : nil
          let entry = PhotoAlbumEntry(date: date, theme: theme, design: state == "empty" ? nil : design, photoRef: state == "missing" ? "album-" + String(repeating: "f", count: 40) + ".jpg" : nil)
          let view = PhotoAlbumWidgetView(entry: entry, reviewImage: image).frame(width: width, height: height)
            .environment(\.locale, Locale(identifier: language))
            .environment(\.layoutDirection, language == "ar" ? .rightToLeft : .leftToRight)
          let renderer = ImageRenderer(content: view); renderer.scale = 2
          guard let rendered = renderer.uiImage, let data = rendered.pngData() else { throw NSError(domain: "AlbumContract", code: 3) }
          let file = "\(c["id"]!)_\(state).png"
          try data.write(to: folder.appendingPathComponent(file))
          records.append(["file": file, "state": state, "size": size, "width": Int(rendered.size.width * rendered.scale), "height": Int(rendered.size.height * rendered.scale), "sha256": SHA256.hash(data: data).map {String(format: "%02x", $0)}.joined()])
        }
      }
      try check(records.count == 72, "Six palettes by three sizes by four actual native states")
      let receipt: [String: Any] = ["schema": "GLAZE_NATIVE_ALBUM_REVIEW_V1", "sourceSHA": Bundle.main.object(forInfoDictionaryKey: "ReviewSourceSHA") as? String ?? "unknown", "language": language, "assertions": checks, "renders": records.count, "records": records, "preferredLocalizations": Bundle.main.preferredLocalizations, "installedWidgetTapTest": false, "physicalDeviceTest": false, "scope": "Actual native album importer, saved editor layout, cursor persistence, timeline model and isolated render capture; no picker UI or installed album button qualification"]
      try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys]).write(to: folder.appendingPathComponent("_ALBUM_SUCCESS.json"))
    } catch { try? Data(String(describing: error).utf8).write(to: folder.appendingPathComponent("_ERROR.txt")) }
  }
}
