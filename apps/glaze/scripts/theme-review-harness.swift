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
      guard let url = Bundle.main.url(forResource: "themed-clock-profiles", withExtension: "json"),
            let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any],
            let themes = root["themes"] as? [[String: Any]], themes.count == 105 else {
        throw NSError(domain: "GlazeReview", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing105-theme palette fixture"])
      }
      let sizes: [(String, CGFloat, CGFloat)] = [("small", 170, 170), ("medium", 364, 170), ("large", 364, 382)]
      let times = [(0, 0), (6, 30), (11, 59), (23, 59)]
      var records: [[String: Any]] = []
      for t in themes {
        guard let id = t["id"] as? String, let bg = t["bg"] as? String, let ink = t["ink"] as? String, Color.isHex(bg), Color.isHex(ink),
              let filename = t["image"] as? String,
              let image = UIImage(contentsOfFile: Bundle.main.bundleURL.appendingPathComponent("themed-clock-fixtures").appendingPathComponent(filename).path),
              let composed = t["composed"] as? [String: Any] else {
          throw NSError(domain: "GlazeReview", code: 2)
        }
        var theme = WidgetTheme(); theme.themeId = id; theme.bg = [bg]; theme.surface = bg; theme.ink = ink; theme.accent = ink
        for (size, width, height) in sizes {
          guard let spec = LiveArtSpec.parse(composed[size]) else { throw NSError(domain: "GlazeReview", code: 3) }
          let renderedArt = ClockArtRenderer.render(image:image,width:width,height:height,colour:bg)
          let artwork = NativeClockArt(image: renderedArt, width: width, height: height)
          for fit in [false, true] {
          var hashes = Set<String>()
          for (hour, minute) in times {
            try autoreleasepool {
              let date = Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: hour, minute: minute))!
              let value = NativeClockComposition(artwork: artwork, spec: spec, theme: theme, date: date, width: width, height: height, fit: fit)
                .frame(width: width, height: height)
                .background(Color(hex: bg))
                .environment(\.colorScheme, .light)
                .environment(\.locale, Locale(identifier: "en_US"))
              let renderer = ImageRenderer(content: value); renderer.scale = 2
              guard let image = renderer.uiImage, let bytes = image.pngData() else {
                throw NSError(domain: "GlazeReview", code: 4, userInfo: [NSLocalizedDescriptionKey: "Native renderer returned no image"])
              }
              let filename = "\(id)_\(size)_\(fit ? "fit" : "fill")_\(hour)-\(minute).png"
              try bytes.write(to: folder.appendingPathComponent(filename), options: .atomic)
              let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined(); hashes.insert(digest)
              records.append(["theme": id, "size": size, "fit": fit ? "fit" : "fill", "hour": hour, "minute": minute, "file": filename, "sha256": digest, "width": Int(image.size.width * image.scale), "height": Int(image.size.height * image.scale)])
            }
          }
          // Analog hands intentionally repeat after12 hours:11:59 and23:59 are identical.
          let expectedStates = spec.clockStyle == "analog" ? 3 : times.count
          guard hashes.count == expectedStates else {
            throw NSError(domain: "GlazeReview", code: 5, userInfo: [NSLocalizedDescriptionKey: "Expected\(expectedStates) distinct clock states, got\(hashes.count) for\(id)/\(size)"])
          }
          }
        }
      }
      let report: [String: Any] = ["schema": "GLAZE_NATIVE_ART_CLOCK_CAPTURE_V2", "sourceSHA": Bundle.main.object(forInfoDictionaryKey: "ReviewSourceSHA") as? String ?? "unknown", "platform": "iOS Simulator", "themes": themes.count, "renders": records.count, "records": records, "installedWidgetTest": false, "physicalDeviceTest": false, "scope": "Actual native LiveArtValueView over105 original-art fixtures with production-computed frames,3sizes,Fit/Fill,4times. No App Group, widget timeline, installation or interaction qualification."]
      try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: folder.appendingPathComponent("_SUCCESS.json"), options: .atomic)
      print("GLAZE_NATIVE_REVIEW_SUCCESS\(records.count)")
    } catch {
      try? Data(String(describing: error).utf8).write(to: folder.appendingPathComponent("_ERROR.txt"), options: .atomic)
      print("GLAZE_NATIVE_REVIEW_ERROR\(error)")
    }
  }
}

/// Whole artwork preserved, with an extended blurred background in any aspect-ratio strips.
struct NativeClockArt: View {
  let image: UIImage
  let width: CGFloat
  let height: CGFloat
  var body: some View {
    ZStack {
      Image(uiImage: image).resizable().frame(width: width, height: height)
    }.frame(width: width, height: height).clipped()
  }
}

@available(iOS 17.0, *)
struct NativeClockComposition: View {
  let artwork: NativeClockArt
  let spec: LiveArtSpec
  let theme: WidgetTheme
  let date: Date
  let width: CGFloat
  let height: CGFloat
  let fit: Bool
  var body: some View {
    let inset = fit ? min(width,height) * 0.06 : 0
    let scale = min((width-2*inset)/width, (height-2*inset)/height)
    let w = width*scale, h = height*scale
    let x = (width-w)/2, y = (height-h)/2
    let r = CGRect(x:x+spec.rect.minX*w,y:y+spec.rect.minY*h,width:spec.rect.width*w,height:spec.rect.height*h)
    ZStack(alignment: .topLeading) {
      artwork.scaleEffect(scale).frame(width:width,height:height)
      LiveArtValueView(spec:spec,theme:theme,date:date)
        .frame(width:spec.circle ? min(r.width,r.height) : r.width,height:spec.circle ? min(r.width,r.height) : r.height)
        .position(x:r.midX,y:r.midY)
    }.frame(width:width,height:height).clipped()
  }
}
