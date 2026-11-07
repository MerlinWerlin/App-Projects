import Foundation

/// The recovery reset is separate from the restored 1.0.6 composition and index writers.
enum GlazeWidgetArtRecovery {
  static func reset(container: URL) -> Bool {
    let files = FileManager.default
    let directory = container.appendingPathComponent("widget-art", isDirectory: true)
    let indexURL = directory.appendingPathComponent("index.json")
    let raw = (try? Data(contentsOf: indexURL))
      .flatMap { (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any] }
    let pieces = raw?["pieces"] as? [[String: Any]] ?? []
    let photos = pieces.filter { $0["source"] as? String == "photo" }
    var keep = Set<String>(["index.json"])
    for photo in photos {
      guard let id = photo["id"] as? String, validID(id) else { return false }
      keep.insert("\(id).jpg")
      keep.insert("\(id)-art.png")
    }
    do {
      try files.createDirectory(at: directory, withIntermediateDirectories: true)
      // This is the original cleanup's photo-only result, before any theme has been committed.
      // A concurrently opened library must not migrate it again and claim the theme early.
      let clean: [String: Any] = ["v": 1, "pieces": photos, "migrated": 1101]
      let bytes = try JSONSerialization.data(withJSONObject: clean, options: [.sortedKeys])
      // Publish the photo-only index first. An interrupted reset is safe to repeat.
      try bytes.write(to: indexURL, options: .atomic)
      for name in try files.contentsOfDirectory(atPath: directory.path) where !keep.contains(name) {
        try files.removeItem(at: directory.appendingPathComponent(name))
      }
      for size in ["small", "medium", "large"] {
        for suffix in [".png", "-art.png"] {
          let file = container.appendingPathComponent("seamless-" + size + suffix)
          if files.fileExists(atPath: file.path) { try files.removeItem(at: file) }
        }
      }
      return true
    } catch {
      return false
    }
  }

  private static func validID(_ id: String) -> Bool {
    !id.isEmpty && id.count <= 64 && id.unicodeScalars.allSatisfy {
      ($0 >= "a" && $0 <= "z") || ($0 >= "A" && $0 <= "Z") ||
        ($0 >= "0" && $0 <= "9") || $0 == "_" || $0 == "-"
    }
  }
}
