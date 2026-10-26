import ExpoModulesCore

public class GlazeIslandPetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeIslandPets")
    AsyncFunction("status") { () async -> [String: Any] in
      if #available(iOS 16.2, *) { return await GlazePetSession.status() }
      return ["enabled": false, "active": false]
    }
    AsyncFunction("start") { (pet: String) async throws -> [String: Any] in
      if #available(iOS 16.2, *) { return try await GlazePetSession.start(pet) }
      return ["enabled": false, "active": false]
    }
    AsyncFunction("mood") { (id: String, mood: String) async throws -> [String: Any] in
      if #available(iOS 16.2, *) { return try await GlazePetSession.mood(id, mood) }
      return ["enabled": false, "active": false]
    }
    AsyncFunction("stop") { () async throws -> [String: Any] in
      if #available(iOS 16.2, *) { return try await GlazePetSession.stop() }
      return ["enabled": false, "active": false]
    }
  }
}
