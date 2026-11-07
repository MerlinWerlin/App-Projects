import Foundation

@main struct RecoveryCheck {
  static func main() throws {
    let fm = FileManager.default
    let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    let art = root.appendingPathComponent("widget-art", isDirectory: true)
    try fm.createDirectory(at: art, withIntermediateDirectories: true)
    defer { try? fm.removeItem(at: root) }
    let photo = Data([1, 2, 3, 4])
    let rawPhoto = Data([5, 6, 7])
    try photo.write(to: art.appendingPathComponent("p-personal.jpg"))
    try rawPhoto.write(to: art.appendingPathComponent("p-personal-art.png"))
    try Data([8]).write(to: art.appendingPathComponent("t-old-small.jpg"))
    try Data([9]).write(to: art.appendingPathComponent("t-old-small-art.png"))
    try Data([10]).write(to: art.appendingPathComponent("orphaned-compose.jpg"))
    try Data([11]).write(to: root.appendingPathComponent("seamless-small.png"))
    try Data([12]).write(to: root.appendingPathComponent("seamless-large-art.png"))
    let photos: [[String: Any]] = [["id": "p-personal", "source": "photo", "file": "p-personal.jpg", "name": "Mine", "created": 5]]
    let index: [String: Any] = [
      "v": 1, "pieces": photos + [["id": "t-old-small", "source": "theme", "themeId": "alpine-starlight"]],
      "retired": ["t-dead-small": ["slot": 7]], "unpinned": ["small": "t-old-small"],
      "currentThemeId": "old", "migrated": 5,
    ]
    try JSONSerialization.data(withJSONObject: index).write(to: art.appendingPathComponent("index.json"))
    for _ in 0..<2 {
      guard GlazeWidgetArtRecovery.reset(container: root) else { throw fail("reset failed") }
      let reset = try JSONSerialization.jsonObject(with: Data(contentsOf: art.appendingPathComponent("index.json"))) as! [String: Any]
      guard Set(reset.keys) == Set(["v", "pieces"]),
            (reset["pieces"] as? [[String: Any]])?.count == 1,
            try Data(contentsOf: art.appendingPathComponent("p-personal.jpg")) == photo,
            try Data(contentsOf: art.appendingPathComponent("p-personal-art.png")) == rawPhoto,
            Set(try fm.contentsOfDirectory(atPath: art.path)) == Set(["index.json", "p-personal.jpg", "p-personal-art.png"]),
            !fm.fileExists(atPath: root.appendingPathComponent("seamless-small.png").path),
            !fm.fileExists(atPath: root.appendingPathComponent("seamless-large-art.png").path)
      else { throw fail("reset did not preserve photos or clear old state") }
    }
    print("GLAZE_PHOTO_PRESERVING_RECOVERY_VERIFIED")
  }

  static func fail(_ message: String) -> NSError {
    NSError(domain: "GlazeRecovery", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
