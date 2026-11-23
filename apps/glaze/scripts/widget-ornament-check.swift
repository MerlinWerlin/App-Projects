import Foundation
import SwiftUI

@main struct WidgetOrnamentCheck {
  static func main() throws {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let fixture = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let identities = fixture["identities"] as! [[String: Any]]
    var ornaments = 0
    for row in identities {
      guard let identity = WidgetIdentity.parse(row["identity"]) else {
        fatalError("Actual native parser rejected \(row["id"]!)")
      }
      if identity.ornament != nil { ornaments += 1 }
    }
    let control = fixture["control"] as! [String: Any]
    guard let identity = WidgetIdentity.parse(control), let ornament = identity.ornament,
      let legacy = WidgetIdentity.parse(fixture["legacy"]) else { fatalError("Valid companion fixture rejected") }
    precondition(legacy.ornament == nil)
    let bounds = ornament.boundingRect
    precondition(abs(bounds.minX - 12) < 0.001 && abs(bounds.maxX - 88) < 0.001)
    precondition(abs(bounds.minY - 18) < 0.001 && bounds.maxY >= 64 && bounds.maxY <= 84)
    for invalid in fixture["invalid"] as! [Any] {
      var corrupt = control
      corrupt["ornament"] = invalid
      precondition(WidgetIdentity.parse(corrupt) == nil, "Invalid companion must not enter native drawing")
    }
    print("Actual Swift identity parser accepted \(identities.count) identities / \(ornaments) compact companions; geometry, legacy and invalid-path checks passed")
  }
}
