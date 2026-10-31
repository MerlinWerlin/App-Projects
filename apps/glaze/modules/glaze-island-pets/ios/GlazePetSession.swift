import ActivityKit
import Foundation
import UIKit

/// All mutations are serialized, including suspension points in ActivityKit calls.
@available(iOS 16.2, *)
@MainActor
enum GlazePetSession {
  private static var changing = false
  private static let names = ["cat": "Mushy", "fox": "Pip", "bunny": "Clover"]
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
  // ---- T188: pet life (src/core/petLife.ts). One update per state boundary, never a timer. ----

  private static let lifeStates: Set<String> = ["sleeping", "waking", "idle", "eating", "playing", "wandering", "happy"]
  private static let lifeMoods: Set<String> = ["sleepy", "content", "happy", "playful", "hungry"]

  /// Decodes the JSON the app sends (activityStateFor in petLife.ts). Unknown values are rejected.
  private static func lifeContent(_ json: String, interaction: Int) throws -> ActivityContent<GlazePetAttributes.ContentState> {
    guard let data = json.data(using: .utf8),
          let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let state = o["state"] as? String, lifeStates.contains(state),
          let mood = o["mood"] as? String, ["happy", "playful", "sleepy"].contains(mood) else {
      throw failure("Invalid pet state.")
    }
    func pick(_ key: String, _ allowed: Set<String>) -> String? {
      guard let v = o[key] as? String, allowed.contains(v) else { return nil }
      return v
    }
    func spot(_ key: String) -> Int? {
      guard let v = o[key] as? NSNumber else { return nil }
      return max(0, min(4, v.intValue))
    }
    var until: Date? = nil
    if let ms = o["until"] as? NSNumber, ms.doubleValue > Date().timeIntervalSince1970 * 1000 {
      until = Date(timeIntervalSince1970: ms.doubleValue / 1000)
    }
    var name: String? = nil
    if let n = o["name"] as? String, !n.isEmpty { name = String(n.prefix(16)) }
    let content = GlazePetAttributes.ContentState(
      mood: mood, interaction: min(1000000, interaction), state: state, lifeMood: pick("lifeMood", lifeMoods),
      spot: spot("spot"), until: until, nextState: pick("nextState", lifeStates), nextMood: pick("nextMood", lifeMoods),
      nextSpot: spot("nextSpot"), name: name)
    // staleDate = the next boundary: iOS re-renders with isStale and the view shows the next state.
    return ActivityContent(state: content, staleDate: until)
  }

  static func startLife(_ pet: String, _ json: String) async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    guard let name = names[pet] else { throw failure("Unknown pet.") }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw failure("Live Activities are disabled.") }
    let content = try lifeContent(json, interaction: 0)
    changing = true; defer { changing = false }
    // The same companion keeps its session (and its iOS lifetime); it only gets the new state.
    if live.count == 1, let a = live.first, a.attributes.pet == pet {
      let updated = try lifeContent(json, interaction: a.content.state.interaction + 1)
      await a.update(updated)
      return status()
    }
    guard UIApplication.shared.applicationState == .active else { throw failure("Open Glaze to start a pet.") }
    for a in live { await a.end(nil, dismissalPolicy: .immediate) }
    let attributes = GlazePetAttributes(pet: pet, name: name, startedAt: Date())
    _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
    return status()
  }

  static func life(_ id: String, _ json: String) async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    guard let a = live.first(where: { $0.id == id }) else { throw failure("This pet session has ended.") }
    let content = try lifeContent(json, interaction: a.content.state.interaction + 1)
    changing = true; defer { changing = false }
    await a.update(content)
    return status()
  }

  static func stop() async throws -> [String: Any] {
    guard !changing else { throw failure("Another pet action is finishing.") }
    changing = true; defer { changing = false }
    for a in live { await a.end(nil, dismissalPolicy: .immediate) }
    return status()
  }
}
