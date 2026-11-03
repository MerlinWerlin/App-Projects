import SwiftUI
import UIKit
import WidgetKit
import CryptoKit

@main struct NativeHabitLocaleReview: App {
  var body: some Scene {
    WindowGroup { Text("Glaze native habit language review").task { await MainActor.run { HabitLocaleCapture.run() } } }
  }
}

@MainActor enum HabitLocaleCapture {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let arguments = ProcessInfo.processInfo.arguments
    func argument(_ key: String) -> String {
      guard let index = arguments.firstIndex(of: key), arguments.indices.contains(index + 1) else { return "" }
      return arguments[index + 1]
    }
    let language = argument("--review-language")
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("GlazeHabitLocaleReview").appendingPathComponent(language)
    do {
      let supported = ["ar", "de", "en", "es", "fr", "hi", "it", "ja", "ko", "pt-BR", "zh-Hans"]
      guard supported.contains(language) else { throw failure("Unsupported review language") }
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      guard Bundle.main.preferredLocalizations.first == language else {
        throw failure("Expected \(language), got \(Bundle.main.preferredLocalizations)")
      }
      guard let url = Bundle.main.url(forResource: "native-habit-review-profiles", withExtension: "json"),
            let profiles = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any],
            let first = (profiles["themes"] as? [[String: Any]])?.first else { throw failure("Missing actual native theme") }
      let theme = try JSONDecoder().decode(WidgetTheme.self, from: JSONSerialization.data(withJSONObject: first["nativeTheme"]!))
      let date = Date(timeIntervalSince1970: 1793620800)
      var records: [[String: Any]] = []
      for kind in HabitKindID.allCases {
        let def = HabitDef.of(kind)
        var cases: [(String, Double)] = [("empty", 0), ("progress", kind == .mood ? 3 : (def.goal ?? 0) / 2), ("upper-bound", def.max)]
        if kind == .mood { cases += [("level-1", 1), ("level-2", 2), ("level-4", 4)] }
        for (state, value) in cases {
          let entry = HabitEntry(date: date, theme: theme, habit: kind, value: value, goal: def.goal, step: def.step)
          for size in kind.nativeSizes.filter({ $0.hasPrefix("accessory") }) {
            let (family, width, height) = dimensions(size)
            for scheme in ["dark", "light"] {
              try autoreleasepool {
                let view = HabitAccessoryView(entry: entry, family: family).frame(width: width, height: height)
                  .environment(\.locale, Locale.current)
                  .environment(\.layoutDirection, language == "ar" ? .rightToLeft : .leftToRight)
                  .environment(\.colorScheme, scheme == "dark" ? .dark : .light)
                  .background(scheme == "dark" ? Color.black : Color.white)
                let renderer = ImageRenderer(content: view); renderer.scale = 2
                guard let image = renderer.uiImage, let data = image.pngData() else { throw failure("Missing native image") }
                let file = "\(kind.rawValue)_\(state)_\(size)_\(scheme).png"
                try data.write(to: folder.appendingPathComponent(file), options: .atomic)
                records.append([
                  "file": file, "kind": kind.rawValue, "state": state, "size": size, "scheme": scheme,
                  "width": Int(image.size.width * image.scale), "height": Int(image.size.height * image.scale),
                  "sha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(),
                  "name": def.name, "unit": def.unit, "formattedValue": HabitStore.format(value, decimals: def.decimals),
                  "moodDescription": kind == .mood ? HabitText.mood(Int(value)) : "",
                  "spokenGoal": def.goal.map { HabitText.goalOf(HabitStore.format($0, decimals: def.decimals), unit: def.unit) } ?? "",
                ])
              }
            }
          }
        }
      }
      guard records.count == 78 else { throw failure("Expected 78 translated accessory captures") }
      let receipt: [String: Any] = [
        "sourceSHA": Bundle.main.object(forInfoDictionaryKey: "ReviewSourceSHA") as? String ?? "unknown",
        "language": language, "locale": Locale.current.identifier,
        "preferredLocalizations": Bundle.main.preferredLocalizations,
        "rtlFixtureLayout": language == "ar", "renders": records.count, "records": records,
        "scope": "Actual production accessory content and actual bundled HabitText lookups/number formatting under AppleLanguages and AppleLocale launch arguments. Explicit RTL fixture geometry. Not a system-language change, installed Lock Screen, VoiceOver or native-speaker translation review.",
        "installedWidgetTapTest": false, "physicalDeviceTest": false,
      ]
      try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
        .write(to: folder.appendingPathComponent("_LOCALE_SUCCESS.json"), options: .atomic)
    } catch {
      try? Data(String(describing: error).utf8).write(to: folder.appendingPathComponent("_ERROR.txt"))
    }
  }
  static func dimensions(_ size: String) -> (WidgetFamily, CGFloat, CGFloat) {
    switch size {
    case "accessoryCircular": return (.accessoryCircular, 72, 72)
    case "accessoryRectangular": return (.accessoryRectangular, 160, 72)
    default: return (.accessoryInline, 257, 26)
    }
  }
  static func failure(_ message: String) -> NSError {
    NSError(domain: "GlazeHabitLocaleReview", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
