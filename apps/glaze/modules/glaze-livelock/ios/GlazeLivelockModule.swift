import ExpoModulesCore

/// JS name "GlazeLivelock". Reached only through src/native/livelock.ts
/// (requireOptionalNativeModule), so Expo Go and Android never load it.
public class GlazeLivelockModule: Module {
  private lazy var controller: NowPlayingController = {
    let c = NowPlayingController()
    c.onState = { [weak self] body in
      self?.sendEvent("onState", body)
    }
    return c
  }()

  public func definition() -> ModuleDefinition {
    Name("GlazeLivelock")

    Events("onState")

    /// { supported: Bool, reason: "ios-version" | "not-built" | null }
    AsyncFunction("isSupported") { () -> [String: Any] in
      Self.support()
    }

    /// json: src/core/livelockPayload.ts LivelockPayload. Resolves once the loops are
    /// exported and the Now Playing item is live; rejects with ERR_LIVELOCK otherwise.
    AsyncFunction("start") { (json: String, promise: Promise) in
      let support = Self.support()
      guard support["supported"] as? Bool == true else {
        promise.reject("ERR_LIVELOCK_UNSUPPORTED", "Live Lock Screen is not supported here (\(support["reason"] ?? "unknown")).")
        return
      }
      let payload: LivelockPayload
      do {
        payload = try LivelockPayload.decode(json)
      } catch {
        promise.reject("ERR_LIVELOCK_PAYLOAD", String(describing: error))
        return
      }
      self.controller.start(payload) { error in
        if let error {
          promise.reject("ERR_LIVELOCK", String(describing: error))
        } else {
          promise.resolve(nil)
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.controller.stop(reason: "user")
    }.runOnQueue(.main)

    AsyncFunction("next") {
      self.controller.next()
    }.runOnQueue(.main)

    /// Same shape as the onState event body.
    AsyncFunction("getState") { () -> [String: Any] in
      self.controller.snapshot()
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { [weak self] in
        self?.controller.stop(reason: "destroyed")
      }
    }
  }

  private static func support() -> [String: Any] {
    if #available(iOS 26.0, *) {
      if livelockSDKHasAnimatedArtwork {
        return ["supported": true, "reason": NSNull()]
      }
      return ["supported": false, "reason": "not-built"]
    }
    return ["supported": false, "reason": "ios-version"]
  }
}
