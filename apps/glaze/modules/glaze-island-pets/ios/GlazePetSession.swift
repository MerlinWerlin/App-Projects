import ActivityKit
import Foundation
import UIKit

/// All mutations are serialized, including suspension points in ActivityKit calls.
@available(iOS 16.2, *)
@MainActor
enum GlazePetSession {
  private static var changing = false
  private static let names = ["cat": "Mochi", "fox": "Pip", "bunny": "Clover"]
  private static var live: [Activity<GlazePetAttributes>] {
    Activity<GlazePetAttributes>.activities.filter { $0.activityState == .active || $0.activityState == .stale }
  }
  private static func failure(_ message: String) -> NSError {
    NSError(domain: "GlazeIslandPets", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  static func status() -> [String: Any] {
    var value: [String: Any] = ["enabled": ActivityAuthorizationInfo().areActivitiesEnabled, "active": false]
    if let a = live.sorted(by: { $0.attributes.startedAt > $1.attributes.startedAt }).first {
      value["active"] = true; value["id"] = a.id; value["pet"] = a.attributes.pet
      value["mood"] = a.content.state.mood
      value["startedAt"] = a.attributes.startedAt.timeIntervalSince1970 * 1000
    }
    return value
  }
  static func start(_ pet: String) async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    guard let name = names[pet] else { throw failure("Unknown pet.") }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw failure("Live Activities are disabled.") }
    guard UIApplication.shared.applicationState == .active else { throw failure("Open Glaze to start a pet.") }
    changing = true; defer { changing = false }
    // Starting the same companion twice must not create duplicate activities or reset its lifetime.
    if live.count == 1, live.first?.attributes.pet == pet { return status() }
    for a in live { await a.end(nil, dismissalPolicy: .immediate) }
    let attributes = GlazePetAttributes(pet: pet, name: name, startedAt: Date())
    let state = GlazePetAttributes.ContentState(mood: "happy", interaction: 0)
    _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil), pushType: nil)
    return status()
  }
  static func mood(_ id: String, _ mood: String) async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    guard ["happy", "playful", "sleepy"].contains(mood) else { throw failure("Unknown mood.") }
    guard let a = live.first(where: { $0.id == id }) else { throw failure("This pet session has ended.") }
    changing = true; defer { changing = false }
    let state = GlazePetAttributes.ContentState(mood: mood, interaction: min(1000000, a.content.state.interaction + 1))
    await a.update(ActivityContent(state: state, staleDate: nil))
    return status()
  }
  static func stop() async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    changing = true; defer { changing = false }
    for a in live { await a.end(nil, dismissalPolicy: .immediate) }
    return status()
  }
}
