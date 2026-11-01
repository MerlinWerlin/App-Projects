import ExpoModulesCore
import Foundation

/**
 * lan-wss: a minimal WebSocket client for TVs on the home network (URLSessionWebSocketTask).
 *
 * A self-signed server certificate is accepted ONLY when the caller asked for it
 * (allowSelfSignedLan) AND the URL is wss:// AND its host is a literal RFC 1918 IPv4 address AND the
 * trust challenge is for that exact host. Everything else gets default certificate validation.
 * The RFC 1918 rule mirrors src/core/lanHost.ts (isRfc1918Host); keep them in sync.
 *
 * UNVERIFIED: written without a build machine. Not compiled, not tested against a TV.
 */
public class LanWssModule: Module {
  private lazy var client = LanWssClient(module: self)
  private lazy var fetchClient = LanFetchClient()
  private lazy var tlsClient = LanTlsClient(module: self)
  private lazy var atvClient = LanAtvClient(module: self)
  private lazy var bonjourClient = LanBonjourClient(module: self)

  public func definition() -> ModuleDefinition {
    Name("LanWss")

    Events("onMessage", "onClose", "onError", "onTlsData", "onTlsClose", "onBonjourService")

    AsyncFunction("connect") { (id: String, url: String, allowSelfSignedLan: Bool, promise: Promise) in
      self.client.connect(id: id, urlString: url, allowSelfSignedLan: allowSelfSignedLan, promise: promise)
    }

    Function("send") { (id: String, data: String) -> Bool in
      return self.client.send(id: id, data: data)
    }

    Function("close") { (id: String) in
      self.client.close(id: id)
    }

    // One HTTP(S) request; same RFC 1918-only relaxed trust rule (see LanFetch.swift).
    AsyncFunction("fetch") { (url: String, method: String, headersJson: String, body: String?, timeoutMs: Double, allowSelfSignedLan: Bool, promise: Promise) in
      self.fetchClient.fetch(
        urlString: url,
        method: method,
        headersJson: headersJson,
        body: body,
        timeoutMs: timeoutMs,
        allowSelfSignedLan: allowSelfSignedLan,
        promise: promise
      )
    }

    // Raw TLS socket for Google Cast (T106); RFC 1918 IPv4 hosts only (see LanTls.swift).
    AsyncFunction("tlsConnect") { (id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) in
      self.tlsClient.connect(id: id, host: host, port: port, timeoutMs: timeoutMs, promise: promise)
    }

    Function("tlsWrite") { (id: String, base64: String) -> Bool in
      return self.tlsClient.write(id: id, base64: base64)
    }

    Function("tlsClose") { (id: String) in
      self.tlsClient.close(id: id)
    }

    // Google TV remote (Android TV Remote v2): Keychain client identity + mutual-TLS socket,
    // RFC 1918 IPv4 hosts only (see LanAtv.swift). Data / close reuse onTlsData / onTlsClose.
    AsyncFunction("atvKey") { (promise: Promise) in
      self.atvClient.key(promise: promise)
    }

    AsyncFunction("atvSign") { (dataBase64: String, promise: Promise) in
      self.atvClient.sign(dataBase64: dataBase64, promise: promise)
    }

    AsyncFunction("atvSetCertificate") { (certBase64: String, promise: Promise) in
      self.atvClient.setCertificate(certBase64: certBase64, promise: promise)
    }

    AsyncFunction("atvConnect") { (id: String, host: String, port: Int, timeoutMs: Double, promise: Promise) in
      self.atvClient.connect(id: id, host: host, port: port, timeoutMs: timeoutMs, promise: promise)
    }

    Function("atvWrite") { (id: String, base64: String) -> Bool in
      return self.atvClient.write(id: id, base64: base64)
    }

    Function("atvClose") { (id: String) in
      self.atvClient.close(id: id)
    }

    // Bonjour (DNS-SD) browse + resolve with Network.framework (see LanBonjour.swift). Types must be
    // listed in NSBonjourServices. Found services arrive as onBonjourService { id, type, name, txt }.
    Function("bonjourBrowse") { (id: String, types: [String], timeoutMs: Double) -> Bool in
      return self.bonjourClient.browse(id: id, types: types, timeoutMs: timeoutMs)
    }

    Function("bonjourStop") { (id: String) in
      self.bonjourClient.stop(id: id)
    }

    AsyncFunction("bonjourResolve") { (type: String, name: String, timeoutMs: Double, promise: Promise) in
      self.bonjourClient.resolve(type: type, name: name, timeoutMs: timeoutMs, promise: promise)
    }

    OnDestroy {
      self.client.closeAll()
      self.fetchClient.cancelAll()
      self.tlsClient.closeAll()
      self.atvClient.closeAll()
      self.bonjourClient.stopAll()
    }
  }

  func emit(_ name: String, _ body: [String: Any]) {
    sendEvent(name, body)
  }
}

/// Strict dotted-quad IPv4 (no leading zeros, 0-255 per octet) in 10/8, 172.16/12 or 192.168/16.
func lanWssIsRfc1918Host(_ host: String) -> Bool {
  let parts = host.split(separator: ".", omittingEmptySubsequences: false)
  guard parts.count == 4 else { return false }
  var octets: [Int] = []
  for part in parts {
    guard !part.isEmpty, part.count <= 3 else { return false }
    guard part.allSatisfy({ $0.isASCII && $0.isNumber }) else { return false }
    if part.count > 1 && part.first == "0" { return false }
    guard let n = Int(part), n <= 255 else { return false }
    octets.append(n)
  }
  let a = octets[0]
  let b = octets[1]
  if a == 10 { return true }
  if a == 172 && b >= 16 && b <= 31 { return true }
  if a == 192 && b == 168 { return true }
  return false
}

private final class LanWssConnection {
  let id: String
  let task: URLSessionWebSocketTask
  /// Host the relaxed trust rule may apply to; nil unless allowSelfSignedLan was requested and the
  /// URL is wss:// to a literal RFC 1918 IPv4 address.
  let relaxedTrustHost: String?
  var openPromise: Promise?
  var opened = false
  var finished = false

  init(id: String, task: URLSessionWebSocketTask, relaxedTrustHost: String?, openPromise: Promise) {
    self.id = id
    self.task = task
    self.relaxedTrustHost = relaxedTrustHost
    self.openPromise = openPromise
  }
}

private final class LanWssClient: NSObject, URLSessionWebSocketDelegate {
  private weak var module: LanWssModule?
  private let lock = NSLock()
  private var byId: [String: LanWssConnection] = [:]
  private var byTask: [Int: LanWssConnection] = [:]
  private lazy var session: URLSession = {
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: .default, delegate: self, delegateQueue: queue)
  }()

  init(module: LanWssModule) {
    self.module = module
    super.init()
  }

  // MARK: - API

  func connect(id: String, urlString: String, allowSelfSignedLan: Bool, promise: Promise) {
    guard let url = URL(string: urlString),
          let scheme = url.scheme?.lowercased(),
          scheme == "ws" || scheme == "wss",
          let host = url.host else {
      promise.reject("ERR_LAN_WSS_URL", "Invalid WebSocket URL.")
      return
    }

    var relaxedHost: String? = nil
    if allowSelfSignedLan && scheme == "wss" && lanWssIsRfc1918Host(host) {
      relaxedHost = host
    }

    let task = session.webSocketTask(with: url)
    let conn = LanWssConnection(id: id, task: task, relaxedTrustHost: relaxedHost, openPromise: promise)

    lock.lock()
    if byId[id] != nil {
      lock.unlock()
      promise.reject("ERR_LAN_WSS_ID", "A socket with this id already exists.")
      return
    }
    byId[id] = conn
    byTask[task.taskIdentifier] = conn
    lock.unlock()

    task.resume()
  }

  func send(id: String, data: String) -> Bool {
    lock.lock()
    let conn = byId[id]
    let usable = conn != nil && conn!.opened && !conn!.finished
    lock.unlock()
    guard usable, let c = conn else { return false }
    c.task.send(.string(data)) { [weak self] error in
      if let error = error {
        self?.fail(c, message: error.localizedDescription)
      }
    }
    return true
  }

  func close(id: String) {
    lock.lock()
    let conn = byId[id]
    lock.unlock()
    conn?.task.cancel(with: .normalClosure, reason: nil)
  }

  func closeAll() {
    lock.lock()
    let all = Array(byId.values)
    lock.unlock()
    for c in all { c.task.cancel(with: .goingAway, reason: nil) }
  }

  // MARK: - Internals

  private func connection(for task: URLSessionTask) -> LanWssConnection? {
    lock.lock()
    defer { lock.unlock() }
    return byTask[task.taskIdentifier]
  }

  private func receiveLoop(_ conn: LanWssConnection) {
    conn.task.receive { [weak self] result in
      guard let self = self else { return }
      switch result {
      case .success(let message):
        switch message {
        case .string(let text):
          self.module?.emit("onMessage", ["id": conn.id, "data": text])
        case .data(let bytes):
          // Binary frames are forwarded only when they are valid UTF-8.
          if let text = String(data: bytes, encoding: .utf8) {
            self.module?.emit("onMessage", ["id": conn.id, "data": text])
          }
        @unknown default:
          break
        }
        self.receiveLoop(conn)
      case .failure(let error):
        self.fail(conn, message: error.localizedDescription)
      }
    }
  }

  /// Rejects connect if still pending; otherwise emits onError then onClose (once).
  private func fail(_ conn: LanWssConnection, message: String) {
    lock.lock()
    if conn.finished {
      lock.unlock()
      return
    }
    conn.finished = true
    let pending = conn.openPromise
    conn.openPromise = nil
    let wasOpen = conn.opened
    byId.removeValue(forKey: conn.id)
    byTask.removeValue(forKey: conn.task.taskIdentifier)
    lock.unlock()

    conn.task.cancel()
    if !wasOpen, let p = pending {
      p.reject("ERR_LAN_WSS_CONNECT", message)
      return
    }
    module?.emit("onError", ["id": conn.id, "message": message])
    module?.emit("onClose", ["id": conn.id, "code": 1006, "reason": message])
  }

  private func finish(_ conn: LanWssConnection, code: Int, reason: String) {
    lock.lock()
    if conn.finished {
      lock.unlock()
      return
    }
    conn.finished = true
    let pending = conn.openPromise
    conn.openPromise = nil
    byId.removeValue(forKey: conn.id)
    byTask.removeValue(forKey: conn.task.taskIdentifier)
    lock.unlock()

    if let p = pending {
      p.reject("ERR_LAN_WSS_CONNECT", "The connection closed before it opened.")
      return
    }
    module?.emit("onClose", ["id": conn.id, "code": code, "reason": reason])
  }

  // MARK: - URLSessionWebSocketDelegate

  func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
    guard let conn = connection(for: webSocketTask) else { return }
    lock.lock()
    conn.opened = true
    let pending = conn.openPromise
    conn.openPromise = nil
    lock.unlock()
    pending?.resolve(nil)
    receiveLoop(conn)
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
    reason: Data?
  ) {
    guard let conn = connection(for: webSocketTask) else { return }
    let text = reason.flatMap { String(data: $0, encoding: .utf8) } ?? ""
    finish(conn, code: closeCode.rawValue, reason: text)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let conn = connection(for: task) else { return }
    if let error = error {
      fail(conn, message: error.localizedDescription)
    } else {
      finish(conn, code: 1000, reason: "")
    }
  }

  // Task-level trust challenge. The session-level variant is deliberately NOT implemented so that
  // URLSession routes server-trust challenges here, where we know which task (and flag) it is for.
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          let trust = space.serverTrust,
          let conn = connection(for: task),
          let allowedHost = conn.relaxedTrustHost,          // only set when allowSelfSignedLan was requested
          let urlHost = task.originalRequest?.url?.host,
          space.host == allowedHost,
          urlHost == allowedHost,
          lanWssIsRfc1918Host(space.host) else {
      completionHandler(.performDefaultHandling, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }
}
