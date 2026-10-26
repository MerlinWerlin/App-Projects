import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct GlazePetAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var mood: String
    var interaction: Int
  }
  let pet: String
  let name: String
  let startedAt: Date
}
