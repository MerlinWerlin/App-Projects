import ExpoModulesCore
import Foundation
import UIKit

/**
 * media-server: a tiny HTTP/1.1 file server so a TV on the home network can fetch one picked photo
 * or video (cast-1024 phase A). The server itself lives in MediaHttpServer.swift.
 *
 * The server is stopped (every token forgotten, listener cancelled) by stopAll() and whenever the
 * app enters the background (UIApplication.didEnterBackgroundNotification). It restarts lazily on
 * the next serve().
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested on a device or a TV.
 */
public class MediaServerModule: Module {
  private let server = MediaHttpServer()
  private let observerBox = MediaServerObserverBox()

  public func definition() -> ModuleDefinition {
    Name("MediaServer")

    OnCreate {
      // Capture the server constant (never a `var`) in the @Sendable notification block.
      let server = self.server
      let token = NotificationCenter.default.addObserver(
        forName: UIApplication.didEnterBackgroundNotification,
        object: nil,
        queue: nil
      ) { _ in
        server.stopAll(completion: nil)
      }
      self.observerBox.set(token)
    }

    AsyncFunction("serve") { (uri: String, mime: String, promise: Promise) in
      self.server.serve(uri: uri, mime: mime, promise: promise)
    }

    AsyncFunction("stop") { (id: String, promise: Promise) in
      self.server.stop(id: id) {
        promise.resolve(nil)
      }
    }

    AsyncFunction("stopAll") { (promise: Promise) in
      self.server.stopAll {
        promise.resolve(nil)
      }
    }

    OnDestroy {
      self.observerBox.removeFromCenter()
      self.server.stopAll(completion: nil)
    }
  }
}

/// Holds the NotificationCenter observer token (a reference type, so no captured `var` is needed).
final class MediaServerObserverBox {
  private let lock = NSLock()
  private var token: NSObjectProtocol?

  func set(_ newToken: NSObjectProtocol) {
    lock.lock()
    let old = token
    token = newToken
    lock.unlock()
    if let old = old {
      NotificationCenter.default.removeObserver(old)
    }
  }

  func removeFromCenter() {
    lock.lock()
    let old = token
    token = nil
    lock.unlock()
    if let old = old {
      NotificationCenter.default.removeObserver(old)
    }
  }
}
