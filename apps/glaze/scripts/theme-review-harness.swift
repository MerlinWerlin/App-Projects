// CI-only iOS Simulator host. Renders the actual native clock value view, not an installed widget.
import SwiftUI
import UIKit
import CryptoKit

@main
struct GlazeReviewHarness: App {
  var body: some Scene {
    WindowGroup {
      Text("Glaze native render review").task {
        await MainActor.run { NativeReviewCapture.run() }
      }
    }
  }
}

@MainActor
enum NativeReviewCapture {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("GlazeNativeReview")
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      guard let url = Bundle.main.url(forResource: "reviewed-theme-palettes", withExtension: "json"),
            let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any],
            let themes = root["themes"] as? [[String: String]], themes.count == 105 else {
        throw NSError(domain: "GlazeReview", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing105-theme palette fixture"])
      }
      let sizes: [(String, CGFloat, CGFloat)] = [("small", 170, 170), ("medium", 364, 170), ("large", 364, 382)]
      let times = [(0, 0), (6, 30), (11, 59), (23, 59)]
      var records: [[String: Any]] = []
      for t in themes {
        guard let id = t["id"], let bg = t["bg"], let ink = t["ink"], Color.isHex(bg), Color.isHex(ink) else {
          throw NSError(domain: "GlazeReview", code: 2)
        }
        var theme = WidgetTheme(); theme.themeId = id; theme.bg = [bg]; theme.surface = bg; theme.ink = ink; theme.accent = ink
        guard let spec = LiveArtSpec.parse(["kind": "clock", "rect": [0, 0, 1, 1], "shape": "circle", "cover": false, "plate": bg, "ink": ink]) else {
          throw NSError(domain: "GlazeReview", code: 3)
        }
        for (size, width, height) in sizes {
          var hashes = Set<String>()
          for (hour, minute) in times {
            try autoreleasepool {
              let date = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: hour, minute: minute))!
              let value = LiveArtValueView(spec: spec, theme: theme, date: date)
                .frame(width: width, height: height)
                .background(Color(hex: bg))
                .environment(\.colorScheme, .light)
                .environment(\.locale, Locale(identifier: "en_US"))
              let renderer = ImageRenderer(content: value); renderer.scale = 2
              guard let image = renderer.uiImage, let bytes = image.pngData() else {
                throw NSError(domain: "GlazeReview", code: 4, userInfo: [NSLocalizedDescriptionKey: "Native renderer returned no image"])
              }
              let filename = "\(id)_\(size)_\(hour)-\(minute).png"
              try bytes.write(to: folder.appendingPathComponent(filename), options: .atomic)
              let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined(); hashes.insert(digest)
              records.append(["theme": id, "size": size, "hour": hour, "minute": minute, "file": filename, "sha256": digest, "width": Int(image.size.width * image.scale), "height": Int(image.size.height * image.scale)])
            }
          }
          guard hashes.count == times.count else {
            throw NSError(domain: "GlazeReview", code: 5, userInfo: [NSLocalizedDescriptionKey: "Clock renders did not change across all four times for\(id)/\(size)"])
          }
        }
      }
      let report: [String: Any] = ["schema": "GLAZE_NATIVE_RENDER_CAPTURE_V1", "sourceSHA": Bundle.main.object(forInfoDictionaryKey: "ReviewSourceSHA") as? String ?? "unknown", "platform": "iOS Simulator", "themes": themes.count, "renders": records.count, "records": records, "installedWidgetTest": false, "physicalDeviceTest": false, "scope": "Actual native LiveArtValueView clock render across reviewed palettes; no App Group, widget timeline, installation or interaction qualification"]
      try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: folder.appendingPathComponent("_SUCCESS.json"), options: .atomic)
      print("GLAZE_NATIVE_REVIEW_SUCCESS\(records.count)")
    } catch {
      try? Data(String(describing: error).utf8).write(to: folder.appendingPathComponent("_ERROR.txt"), options: .atomic)
      print("GLAZE_NATIVE_REVIEW_ERROR\(error)")
    }
  }
}
