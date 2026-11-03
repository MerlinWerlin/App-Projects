import Foundation

extension SavedWidgetDesign {
  /// Same name region and resolved text map written by serialiseWidgetCatalogue.
  /// Dynamic values, goals and actions continue to come from the native habit entry.
  var habitTitle: String? {
    guard let region = regions.first(where: { $0["id"] as? String == "name" }),
          region["role"] as? String == "text" else { return nil }
    let text = region["text"] as? [String: Any] ?? [:]
    let value = (text["userText"] as? String) ?? texts["name"] ?? ""
    let title = value.components(separatedBy: .newlines).joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return title.isEmpty ? nil : String(title.prefix(40))
  }
}
