import Foundation

/// Same bounds and rotation intervals as widgetKinds.ts. Only importer-owned bare JPEG names.
enum PhotoAlbumModel {
  static let maxPhotos = 12
  static let intervals = [15, 30, 60, 180, 360, 720, 1440]
  static func validRef(_ value: String) -> Bool {
    value.utf8.count == 50 && value.range(of: "^album-[a-f0-9]{40}\\.jpg$", options: .regularExpression) != nil
  }
  static func refs(_ raw: Any?) -> [String] {
    guard let list = raw as? [String] else { return [] }
    var seen = Set<String>()
    return Array(list.filter { validRef($0) && seen.insert($0).inserted }.prefix(maxPhotos))
  }
  static func interval(_ raw: Any?) -> Int {
    let n = raw as? Int ?? 60
    return intervals.contains(n) ? n : 60
  }
  static func index(at date: Date, minutes: Int, count: Int, offset: Int = 0) -> Int {
    guard count > 0, date.timeIntervalSince1970.isFinite, abs(date.timeIntervalSince1970) < 9e15 else { return 0 }
    let bucket = Int(floor(date.timeIntervalSince1970 / Double(interval(minutes) * 60)))
    return ((bucket % count + offset % count) % count + count) % count
  }
  static func nextBoundary(after date: Date, minutes: Int) -> Date {
    let step = Double(interval(minutes) * 60)
    return Date(timeIntervalSince1970: (floor(date.timeIntervalSince1970 / step) + 1) * step)
  }
}

extension SavedWidgetDesign {
  var albumRefs: [String] { PhotoAlbumModel.refs(raw["photoRefs"]) }
  var albumMinutes: Int { PhotoAlbumModel.interval(raw["rotateMinutes"]) }
  var albumID: String { String((raw["id"] as? String ?? "photoAlbum").prefix(200)) }
  var albumCaption: String {
    let region = regions.first { $0["id"] as? String == "caption" }
    let text = region?["text"] as? [String: Any]
    return String(((text?["userText"] as? String) ?? texts["caption"] ?? "")
      .components(separatedBy: .newlines).joined(separator: " ").prefix(40))
  }
}
