// GlazeProfileServer (T126): hands the icon profile (.mobileconfig) to Safari, the one app that
// reliably registers a downloaded configuration profile with iOS ("Profile Downloaded" in Settings).
//
// How: a tiny HTTP/1.1 server on the loopback interface only (127.0.0.1, random high port), built
// on Apple's Network framework (NWListener). The app opens http://127.0.0.1:<port>/ in Safari;
// that landing page has one Install link to /glaze.mobileconfig, served with
// Content-Type application/x-apple-aspen-config. Nothing leaves the iPhone: loopback is not the
// local network, so no Local Network prompt and no ATS exception are needed (Safari makes the
// request, not the app).
//
// Lifetime: the server runs while Glaze is in the background thanks to a UIApplication background
// task (iOS decides how long; usually about 30 s, sometimes more). It stops on the first of:
// the timeout passed to start(), iOS ending the background time, stop() from JS, or a short grace
// period after Safari fetched the profile (Safari can fetch again after the Allow prompt).
//
// NOT YET COMPILED OR TESTED ON A DEVICE. Symbols or behaviour we could not check without Xcode
// are marked `// VERIFY`.
//
// JS side: src/native/profileServer.ts (adapter) -> NativeModule "GlazeProfileServer".

import ExpoModulesCore
import Foundation
import Network
import UIKit

public class GlazeProfileServerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlazeProfileServer")

    // T136 checked: a trailing `Promise` argument is the documented ExpoModulesCore form (Expo
    // Modules API: "up to 8 arguments (including the promise)"); glaze-livelock uses the same
    // shape and compiled in the 24 Oct native build. The completion runs exactly once
    // (GlazeLoopbackServer.finish), so the JS promise always settles.
    AsyncFunction("start") { (path: String, pageJson: String, timeoutSeconds: Double, promise: Promise) in
      GlazeLoopbackServer.shared.start(path: path, pageJson: pageJson, timeoutSeconds: timeoutSeconds) { result in
        switch result {
        case .success(let info):
          // Explicit type: a mixed-value dictionary literal must not rely on inference.
          let payload: [String: Any] = [
            "url": info.url,
            "profileUrl": info.profileUrl,
            "port": info.port,
          ]
          promise.resolve(payload)
        case .failure(let error):
          promise.reject("ERR_GLAZE_PROFILE_SERVER", error.localizedDescription)
        }
      }
    }

    Function("stop") { () -> Bool in
      GlazeLoopbackServer.shared.stop()
      return true
    }

    Function("isServing") { () -> Bool in
      return GlazeLoopbackServer.shared.isServing
    }

    Function("fetchCount") { () -> Int in
      return GlazeLoopbackServer.shared.fetchCount
    }
  }
}

// MARK: - Server

struct GlazeProfileServerInfo {
  let url: String
  let profileUrl: String
  let port: Int
}

enum GlazeProfileServerError: LocalizedError {
  case unreadable(String)
  case tooLarge
  case notAProfile
  case listenFailed(String)
  case stopped

  var errorDescription: String? {
    switch self {
    case .stopped: return "The local profile server was stopped before it was ready."
    case .unreadable(let why): return "The profile file could not be read: \(why)"
    case .tooLarge: return "The profile file is too large to serve."
    case .notAProfile: return "The file does not look like a configuration profile."
    case .listenFailed(let why): return "The local profile server could not start: \(why)"
    }
  }
}

/// Mutable flag shared with the listener's state handler (only touched on the server queue).
final class OnceFlag {
  var value = false
}

final class GlazeLoopbackServer {
  static let shared = GlazeLoopbackServer()

  /// Keep in sync with src/core/profileServer.ts (PROFILE_SERVER_PATH, PROFILE_MIME).
  static let profilePath = "/glaze.mobileconfig"
  static let contentType = "application/x-apple-aspen-config"
  static let maxProfileBytes = 8 * 1024 * 1024
  /// Seconds the server keeps going after Safari fetched the profile (it may fetch again).
  static let graceSeconds: Double = 20
  static let portAttempts = 5

  private let queue = DispatchQueue(label: "com.jared797.glaze.profile-server")

  // State below is only touched on `queue`.
  private var listener: NWListener?
  private var connections: [ObjectIdentifier: NWConnection] = [:]
  private var profile = Data()
  private var page = Data()
  private var timeoutItem: DispatchWorkItem?
  private var graceItem: DispatchWorkItem?
  private var served = 0
  private var serving = false
  private var generation = 0
  /// The JS promise of the start() that is still waiting for the listener (T136: settled exactly
  /// once through finish(), also when stop() or a newer start() comes first).
  private var pending: ((Result<GlazeProfileServerInfo, Error>) -> Void)?

  // Only touched on the main thread.
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  var isServing: Bool { queue.sync { serving } }
  var fetchCount: Int { queue.sync { served } }

  func start(
    path: String,
    pageJson: String,
    timeoutSeconds: Double,
    completion: @escaping (Result<GlazeProfileServerInfo, Error>) -> Void
  ) {
    let data: Data
    do {
      data = try GlazeLoopbackServer.readProfile(path)
    } catch {
      completion(.failure(error))
      return
    }
    let pageData = GlazeLoopbackServer.landingPage(json: pageJson)
    let timeout = max(15, min(600, timeoutSeconds.isFinite ? timeoutSeconds : 90))

    queue.async {
      self.stopLocked()
      self.generation += 1
      let gen = self.generation
      self.profile = data
      self.page = pageData
      self.served = 0
      self.pending = completion
      self.beginBackgroundTask()
      self.listen(gen: gen, attempt: 1, timeout: timeout)
    }
  }

  /// Runs on `queue`. Settles the waiting start() once; later calls do nothing.
  private func finish(_ result: Result<GlazeProfileServerInfo, Error>) {
    guard let done = pending else { return }
    pending = nil
    done(result)
  }

  func stop() {
    queue.async { self.stopLocked() }
  }

  // MARK: listening

  private func listen(gen: Int, attempt: Int, timeout: Double) {
    guard gen == generation else { return }
    let port = UInt16.random(in: 49152...65000)
    let params = NWParameters(tls: nil, tcp: NWProtocolTCP.Options())
    params.allowLocalEndpointReuse = true
    // Loopback only: nothing outside this iPhone can connect.
    // VERIFY (device): NWListener honours requiredLocalEndpoint for binding to 127.0.0.1. If it
    // were ignored, the server would still work, just on every interface, for at most the timeout.
    guard let nwPort = NWEndpoint.Port(rawValue: port) else {
      retryOrFail(gen: gen, attempt: attempt, timeout: timeout, why: "bad port")
      return
    }
    params.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(.loopback), port: nwPort)

    let l: NWListener
    do {
      l = try NWListener(using: params)
    } catch {
      retryOrFail(gen: gen, attempt: attempt, timeout: timeout, why: error.localizedDescription)
      return
    }

    let answered = OnceFlag()
    l.newConnectionHandler = { [weak self] conn in
      guard let self = self else {
        conn.cancel()
        return
      }
      self.accept(conn, gen: gen)
    }
    l.stateUpdateHandler = { [weak self, weak l] state in
      guard let self = self, let l = l else { return }
      switch state {
      case .ready:
        guard !answered.value else { return }
        answered.value = true
        guard gen == self.generation else {
          l.cancel()
          return
        }
        self.serving = true
        let actual = Int(l.port?.rawValue ?? port)
        self.scheduleTimeout(gen: gen, seconds: timeout)
        let base = "http://127.0.0.1:\(actual)"
        self.finish(.success(GlazeProfileServerInfo(
          url: base + "/",
          profileUrl: base + GlazeLoopbackServer.profilePath,
          port: actual
        )))
      case .failed(let error), .waiting(let error):
        // T136: `.waiting` before `.ready` (port not usable yet) is treated like a failure so
        // start() can't hang; the next attempt picks another port. After `.ready` it is ignored.
        if case .waiting = state, answered.value { return }
        l.cancel()
        if !answered.value {
          answered.value = true
          if self.listener === l { self.listener = nil }
          self.retryOrFail(gen: gen, attempt: attempt, timeout: timeout, why: error.localizedDescription)
        } else if self.listener === l {
          self.stopLocked()
        }
      default:
        break
      }
    }
    listener = l
    l.start(queue: queue)
  }

  private func retryOrFail(gen: Int, attempt: Int, timeout: Double, why: String) {
    guard gen == generation else { return }
    if attempt < GlazeLoopbackServer.portAttempts {
      listen(gen: gen, attempt: attempt + 1, timeout: timeout)
    } else {
      finish(.failure(GlazeProfileServerError.listenFailed(why)))
      stopLocked()
    }
  }

  private func scheduleTimeout(gen: Int, seconds: Double) {
    timeoutItem?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self = self, gen == self.generation else { return }
      self.stopLocked()
    }
    timeoutItem = item
    queue.asyncAfter(deadline: .now() + seconds, execute: item)
  }

  private func scheduleGraceStop(gen: Int) {
    graceItem?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self = self, gen == self.generation else { return }
      self.stopLocked()
    }
    graceItem = item
    queue.asyncAfter(deadline: .now() + GlazeLoopbackServer.graceSeconds, execute: item)
  }

  /// Runs on `queue`.
  private func stopLocked() {
    finish(.failure(GlazeProfileServerError.stopped))
    timeoutItem?.cancel()
    timeoutItem = nil
    graceItem?.cancel()
    graceItem = nil
    listener?.newConnectionHandler = nil
    listener?.stateUpdateHandler = nil
    listener?.cancel()
    listener = nil
    for (_, c) in connections { c.cancel() }
    connections.removeAll()
    serving = false
    profile = Data()
    endBackgroundTask()
  }

  // MARK: connections

  private func accept(_ conn: NWConnection, gen: Int) {
    guard gen == generation, serving else {
      conn.cancel()
      return
    }
    let id = ObjectIdentifier(conn)
    connections[id] = conn
    conn.stateUpdateHandler = { [weak self] state in
      switch state {
      case .failed, .cancelled:
        self?.connections.removeValue(forKey: id)
      default:
        break
      }
    }
    conn.start(queue: queue)
    receive(conn, buffer: Data(), gen: gen)
  }

  private func receive(_ conn: NWConnection, buffer: Data, gen: Int) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 16 * 1024) { [weak self] content, _, isComplete, error in
      guard let self = self else {
        conn.cancel()
        return
      }
      var buf = buffer
      if let content = content { buf.append(content) }
      if let end = buf.range(of: Data("\r\n\r\n".utf8)) {
        let head = String(decoding: buf.subdata(in: buf.startIndex..<end.lowerBound), as: UTF8.self)
        self.respond(conn, head: head, gen: gen)
        return
      }
      if error != nil || isComplete || buf.count > 32 * 1024 {
        conn.cancel()
        return
      }
      self.receive(conn, buffer: buf, gen: gen)
    }
  }

  private func respond(_ conn: NWConnection, head: String, gen: Int) {
    let requestLine = head.components(separatedBy: "\r\n").first ?? ""
    let parts = requestLine.split(separator: " ").map(String.init)
    let method = parts.count > 0 ? parts[0].uppercased() : ""
    let target = parts.count > 1 ? parts[1] : "/"
    let route = target.split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"
    let isHead = method == "HEAD"

    guard method == "GET" || isHead else {
      send(conn, status: "405 Method Not Allowed", type: "text/plain; charset=utf-8", body: Data("Method not allowed".utf8), extra: ["Allow: GET, HEAD"], headOnly: false)
      return
    }

    switch route {
    case "/", "/index.html":
      send(conn, status: "200 OK", type: "text/html; charset=utf-8", body: page, extra: [], headOnly: isHead)
    case GlazeLoopbackServer.profilePath:
      send(
        conn,
        status: "200 OK",
        type: GlazeLoopbackServer.contentType,
        body: profile,
        extra: ["Content-Disposition: attachment; filename=\"glaze.mobileconfig\""],
        headOnly: isHead
      )
      if !isHead {
        served += 1
        scheduleGraceStop(gen: gen)
      }
    default:
      send(conn, status: "404 Not Found", type: "text/plain; charset=utf-8", body: Data("Not found".utf8), extra: [], headOnly: isHead)
    }
  }

  private func send(_ conn: NWConnection, status: String, type: String, body: Data, extra: [String], headOnly: Bool) {
    var lines = [
      "HTTP/1.1 \(status)",
      "Content-Type: \(type)",
      "Content-Length: \(body.count)",
      "Cache-Control: no-store",
      "X-Content-Type-Options: nosniff",
      "Connection: close",
    ]
    lines.append(contentsOf: extra)
    var out = Data((lines.joined(separator: "\r\n") + "\r\n\r\n").utf8)
    if !headOnly { out.append(body) }
    conn.send(content: out, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed { _ in
      conn.cancel()
    })
  }

  // MARK: background time

  private func beginBackgroundTask() {
    DispatchQueue.main.async {
      if self.backgroundTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.backgroundTask)
        self.backgroundTask = .invalid
      }
      self.backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "GlazeProfileServer") { [weak self] in
        // iOS is ending our background time: stop serving and give the time back right away.
        guard let self = self else { return }
        if self.backgroundTask != .invalid {
          UIApplication.shared.endBackgroundTask(self.backgroundTask)
          self.backgroundTask = .invalid
        }
        self.queue.async { self.stopLocked() }
      }
    }
  }

  private func endBackgroundTask() {
    DispatchQueue.main.async {
      if self.backgroundTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.backgroundTask)
        self.backgroundTask = .invalid
      }
    }
  }

  // MARK: files and page

  static func readProfile(_ path: String) throws -> Data {
    let url: URL
    if path.hasPrefix("file:"), let u = URL(string: path) {
      url = u
    } else {
      url = URL(fileURLWithPath: path)
    }
    let data: Data
    do {
      data = try Data(contentsOf: url)
    } catch {
      throw GlazeProfileServerError.unreadable(error.localizedDescription)
    }
    if data.count > maxProfileBytes { throw GlazeProfileServerError.tooLarge }
    let head = String(decoding: data.prefix(512), as: UTF8.self)
    if data.isEmpty || !head.contains("<plist") { throw GlazeProfileServerError.notAProfile }
    return data
  }

  struct PageText: Decodable {
    let lang: String?
    let dir: String?
    let title: String?
    let body: String?
    let button: String?
  }

  static func escape(_ s: String) -> String {
    var out = ""
    for ch in s {
      switch ch {
      case "&": out += "&amp;"
      case "<": out += "&lt;"
      case ">": out += "&gt;"
      case "\"": out += "&quot;"
      case "'": out += "&#39;"
      default: out.append(ch)
      }
    }
    return out
  }

  static func landingPage(json: String) -> Data {
    let text = (try? JSONDecoder().decode(PageText.self, from: Data(json.utf8)))
    let lang = escape(text?.lang ?? "en")
    let dir = text?.dir == "rtl" ? "rtl" : "ltr"
    let title = escape(text?.title ?? "Glaze icons")
    let body = escape(text?.body ?? "Tap Install, then Allow. Then open Settings to finish.")
    let button = escape(text?.button ?? "Install")
    let html = """
    <!doctype html>
    <html lang="\(lang)" dir="\(dir)">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>\(title)</title>
    <style>
    body{margin:0;font:17px -apple-system,system-ui,sans-serif;background:#f6f4fb;color:#1c1b22}
    main{max-width:28rem;margin:0 auto;padding:12vh 24px 24px;text-align:center}
    h1{font-size:28px;margin:0 0 12px}
    p{line-height:1.45;color:#55525f;margin:0 0 28px}
    a.btn{display:block;padding:16px 20px;border-radius:999px;background:#6b4fd8;color:#fff;font-weight:600;text-decoration:none;font-size:19px}
    @media (prefers-color-scheme: dark){body{background:#121118;color:#f3f1f8}p{color:#b9b5c6}}
    </style>
    </head>
    <body>
    <main>
    <h1>\(title)</h1>
    <p>\(body)</p>
    <a class="btn" href="\(profilePath)">\(button)</a>
    </main>
    </body>
    </html>
    """
    return Data(html.utf8)
  }
}
