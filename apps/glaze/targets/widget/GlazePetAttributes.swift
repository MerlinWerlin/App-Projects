import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct GlazePetAttributes: ActivityAttributes {
  /// T188: the life fields are optional so activities started by older builds still decode, and
  /// older extensions ignore them. The app sends a new state only at petLife boundaries
  /// (src/core/petLife.ts); `until` is also the staleDate, and once it passes the extension shows
  /// `nextState` / `nextMood` / `nextSpot` without another update.
  struct ContentState: Codable, Hashable {
    var mood: String
    var interaction: Int
    var state: String?
    var lifeMood: String?
    var spot: Int?
    var until: Date?
    var nextState: String?
    var nextMood: String?
    var nextSpot: Int?
    var name: String?
  }
  let pet: String
  let name: String
  let startedAt: Date
}
