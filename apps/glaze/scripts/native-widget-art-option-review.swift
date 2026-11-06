import Foundation
import UIKit

private struct ThemeFixture: Decodable {
  struct Choice: Decodable {
    let id: String
    let variants: [String: String]
  }

  let id: String
  let index: String
  let files: [String: String]
  let expected: [Choice]
}

@main final class WidgetArtReviewHost: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = UIViewController()
    window.makeKeyAndVisible()
    self.window = window
    Task { @MainActor in
      let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      do { try await verify(in: root) }
      catch { try? String(describing: error).write(to: root.appendingPathComponent("widget-art-error.txt"), atomically: true, encoding: .utf8) }
    }
    return true
  }

  private func verify(in root: URL) async throws {
    let bundle = Bundle.main.bundleURL
    let data = try Data(contentsOf: bundle.appendingPathComponent("widget-art-options.json"))
    let fixtures = try JSONDecoder().decode([ThemeFixture].self, from: data)
    let fm = FileManager.default
    var decoded = Set<String>()
    var variants = 0
    var alpine: [String] = []
    for fixture in fixtures {
      let dir = root.appendingPathComponent(fixture.id, isDirectory: true)
      try fm.createDirectory(at: dir, withIntermediateDirectories: true)
      try fixture.index.write(to: dir.appendingPathComponent(WidgetArtStore.indexName), atomically: true, encoding: .utf8)
      for (id, file) in fixture.files {
        let shared = root.appendingPathComponent(file + ".jpg")
        if decoded.insert(file).inserted {
          let source = bundle.appendingPathComponent("art-fixture-files").appendingPathComponent(file)
          try autoreleasepool {
            guard let art = UIImage(contentsOfFile: source.path),
                  let bytes = art.jpegData(compressionQuality: 0.75) else {
              throw failure(fixture.id + ": UIKit cannot decode " + file)
            }
            try bytes.write(to: shared, options: .atomic)
          }
        }
        try fm.linkItem(at: shared, to: dir.appendingPathComponent(id + ".jpg"))
      }
      let query = WidgetArtQuery(directory: dir)
      let entities = try await query.suggestedEntities()
      let snapshot = WidgetArtStore.snapshot(in: dir)
      guard entities.count == fixture.expected.count else {
        throw failure(fixture.id + ": native query offered " + String(entities.count) + " of " + String(fixture.expected.count) + " pictures")
      }
      for choice in fixture.expected {
        let ids = Set(choice.variants.values)
        guard let offered = entities.first(where: { ids.contains($0.id) }) else {
          throw failure(fixture.id + ": native query omitted " + choice.id)
        }
        for (size, expectedID) in choice.variants {
          guard snapshot.resolve(offered.id, preferSize: size) == expectedID else {
            throw failure(fixture.id + ": " + choice.id + " failed to resolve for " + size)
          }
          variants += 1
        }
        if fixture.id == "alpine-starlight" && choice.variants["small"] != nil { alpine.append(choice.id) }
      }
      try fm.removeItem(at: dir)
    }
    let receipt: [String: Any] = ["packs": fixtures.count, "variants": variants, "nativeDecodedAssets": decoded.count, "alpineSmall": alpine.sorted()]
    try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
      .write(to: root.appendingPathComponent("widget-art-success.json"), options: .atomic)
  }

  private func failure(_ text: String) -> NSError {
    NSError(domain: "GlazeWidgetArt", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
  }
}
